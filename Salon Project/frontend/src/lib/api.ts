import { BUSINESS_TIME_ZONE } from './format'
import type {
  Appointment,
  AppointmentInput,
  AppointmentUpdateInput,
  AvailabilityResponse,
  AuthUser,
  Customer,
  CustomerInput,
  LoginResponse,
  Service,
  ServiceInput,
  Staff,
  StaffCreateInput,
  StaffUpdateInput,
} from '../types'

/* ============================================================
   Transport
   Base URL is relative: the Vite dev/preview server proxies
   /api -> the backend (the Express app ships no CORS middleware,
   so requests are made same-origin through the proxy).
   ============================================================ */

const BASE = import.meta.env.VITE_API_BASE ?? '/api'
const TOKEN_KEY = 'shades360.token'

/** Fired by the transport when the backend rejects the token, so the
 *  session can be cleared no matter which request hit the 401. */
export const UNAUTHORIZED_EVENT = 'shades360:unauthorized'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isAuthError() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }
}

/**
 * Pulls the most specific message the backend actually sent.
 * Raw Postgres text ("invalid input syntax for type date: \"\"") is turned into
 * something a receptionist can act on; domain messages from the services
 * ("The customer already exists", "Saloon is Closed in this time.") pass through
 * untouched because they are the useful part of the contract.
 */
function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['error', 'message'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return humanize(value.trim())
    }
  }
  return fallback
}

function humanize(message: string): string {
  const pgType = message.match(/^invalid input syntax for type (\w+)/i)
  if (pgType) {
    const field = pgType[1].toLowerCase()
    return `That ${field} value is not in a format the salon can store. Check the field and try again.`
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return 'That record already exists. Use a different phone number or email.'
  }
  if (/violates foreign key constraint/i.test(message)) {
    return 'That record is linked to something the salon no longer has.'
  }
  if (/violates check constraint/i.test(message)) {
    return 'One of those values is outside the range the salon allows.'
  }
  if (/null value in column/i.test(message)) {
    return 'A required field was missing. Fill it in and try again.'
  }
  return message
}

function token(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getToken() {
  return token()
}

export function setToken(value: string | null) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')

  const bearer = token()
  if (auth && bearer) headers.set('Authorization', `Bearer ${bearer}`)

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Cannot reach the salon server. Check that the backend is running.', 0)
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null)
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(messageFrom(body, `Request failed (${response.status})`), response.status)
  }

  return body as T
}

/* ============================================================
   Response readers
   The backend wraps results inconsistently per resource, so each
   reader unwraps exactly what its controller emits and nothing else.
   ============================================================ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value.filter(isRecord) as Record<string, unknown>[]) : []
}

/**
 * Digs a single entity row out of a wrapper object, following the given keys
 * in order. A wrapper may hold the row directly (`{ id }`) or as a one-element
 * array (`[{ id }]`), and controllers nest wrappers to differing depths — so
 * the row is identified by carrying an `id` rather than by its position.
 */
function findRow(wrapper: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (Array.isArray(wrapper)) return wrapper.filter(isRecord)[0]
  if (!isRecord(wrapper)) return undefined
  if ('id' in wrapper) return wrapper

  for (const key of keys) {
    if (!(key in wrapper)) continue
    const found = findRow(wrapper[key], keys)
    if (found) return found
  }
  return undefined
}

/**
 * Postgres `date` columns arrive as a JS Date built at *server*-local midnight
 * (the database runs with TimeZone=Asia/Calcutta) and are then serialised to a
 * UTC ISO string — so 1995-04-10 reaches the browser as "1995-04-09T18:30Z".
 * Reading the day off that string in the *browser's* zone would return the
 * wrong calendar day for every visitor not east of Greenwich: the browser in
 * UTC or New York would read back 1995-04-09. The value is therefore rendered
 * in the salon's business timezone, which is the clock it was built on, so the
 * recovered day is identical in every browser. This keeps an appointment on the
 * calendar day the salon actually booked it for.
 */
const businessDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function normalizeDates<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const target = row as Record<string, unknown>
  for (const key of keys) {
    const value = target[key]
    if (typeof value !== 'string') continue
    // Already a plain YYYY-MM-DD — nothing to convert.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) continue
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) continue
    target[key] = businessDay.format(parsed)
  }
  return row
}

const normalize = <T,>(list: Record<string, unknown>[], keys: string[]) =>
  list.map((row) => normalizeDates(row, keys)) as unknown as T[]

export const authApi = {
  async login(email: string, password: string): Promise<AuthUser> {
    const data = await request<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    )
    if (!data?.token) throw new ApiError('The server did not return a session token.', 500)
    setToken(data.token)
    return decodeUser(data.token)
  },
}

/**
 * Reads a customer row from the three shapes the customer controller emits:
 * a bare object (create wraps the service result, so it nests one level
 * deeper than expected), a single-row array under `customer.<key>` (get), or
 * `customer.updated_details` (update). A row is recognised by its shape — it
 * carries an `id` — rather than by which wrapper the controller happened to use.
 */
function readCustomer(data: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined
  return findRow(data.customer, [key, 'customer'])
}

export const customerApi = {
  async list(): Promise<Customer[]> {
    const data = await request<unknown>('/customer')
    if (!isRecord(data)) return []
    const customer = data.customer
    if (!isRecord(customer)) return []
    return normalize<Customer>(rows(customer.customers), ['date_of_birth'])
  },

  async get(id: number): Promise<Customer> {
    const data = await request<unknown>(`/customer/${id}`)
    const first = readCustomer(data, 'customer')
    if (!first) throw new ApiError('That customer no longer exists.', 404)
    return normalize<Customer>([first], ['date_of_birth'])[0]
  },

  async create(input: CustomerInput): Promise<Customer> {
    const data = await request<unknown>('/customer', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const first = readCustomer(data, 'customer')
    if (!first) throw new ApiError('The customer was created but the server returned no record.', 500)
    return normalize<Customer>([first], ['date_of_birth'])[0]
  },

  async update(id: number, input: CustomerInput): Promise<Customer> {
    const data = await request<unknown>(`/customer/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const first = readCustomer(data, 'updated_details')
    if (!first) throw new ApiError('No customer was updated with that id.', 404)
    return normalize<Customer>([first], ['date_of_birth'])[0]
  },

  async remove(id: number): Promise<void> {
    await request(`/customer/${id}`, { method: 'DELETE' })
  },
}

/**
 * The service service-layer returns `{ service: rows }` for reads and writes,
 * and `{ error }` when the catalogue is empty — so an empty catalogue is a
 * successful response with zero rows, not a failure.
 */
function readService(data: unknown): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined
  return findRow(data.service, ['service'])
}

function readServiceList(data: unknown): Service[] {
  if (!isRecord(data) || !isRecord(data.services)) return []
  return rows(data.services.service) as unknown as Service[]
}

export const serviceApi = {
  async list(): Promise<Service[]> {
    return readServiceList(await request<unknown>('/service'))
  },

  async get(id: number): Promise<Service> {
    const first = readService(await request<unknown>(`/service/${id}`))
    if (!first) throw new ApiError('That service no longer exists.', 404)
    return first as unknown as Service
  },

  async create(input: ServiceInput): Promise<Service> {
    const data = await request<unknown>('/service', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const first = readService(data)
    if (!first) throw new ApiError('The service was created but the server returned no record.', 500)
    return first as unknown as Service
  },

  async update(id: number, input: ServiceInput): Promise<Service> {
    const data = await request<unknown>(`/service/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const first = readService(data)
    if (!first) throw new ApiError('No service was updated with that id.', 404)
    return first as unknown as Service
  },

  async remove(id: number): Promise<void> {
    await request(`/service/${id}`, { method: 'DELETE' })
  },
}

/** Staff create/update answer with `{ result: { user, staff } }`. */
function readStaff(data: unknown): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined
  return findRow(data.result, ['staff'])
}

export const staffApi = {
  async list(): Promise<Staff[]> {
    const data = await request<unknown>('/staff')
    if (!isRecord(data)) return []
    return rows(data.users) as unknown as Staff[]
  },

  async get(id: number): Promise<Staff> {
    const data = await request<unknown>(`/staff/${id}`)
    const first = isRecord(data) ? findRow(data.staff, []) : undefined
    if (!first) throw new ApiError('That staff member no longer exists.', 404)
    return first as unknown as Staff
  },

  async create(input: StaffCreateInput): Promise<Staff> {
    const data = await request<unknown>('/staff', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const first = readStaff(data)
    if (!first) throw new ApiError('The staff account was created but no staff record returned.', 500)
    return first as unknown as Staff
  },

  async update(id: number, input: StaffUpdateInput): Promise<Staff> {
    const data = await request<unknown>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const first = readStaff(data)
    if (!first) throw new ApiError('No staff record was updated.', 500)
    return first as unknown as Staff
  },
}

/**
 * Reads an appointment row from any of the shapes the controller emits:
 * `appointment: [row]` (create/update) or `appointment: { appointment: [row] }`
 * (get by id, which the service wraps). Keeping both in one place means a
 * future inconsistency in the backend cannot silently break a flow.
 */
function readAppointment(data: unknown): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined
  return findRow(data.appointment, ['appointment'])
}

export const appointmentApi = {
  async list(): Promise<Appointment[]> {
    const data = await request<unknown>('/appointment')
    if (!isRecord(data)) return []
    const appointments = data.appointments
    if (!isRecord(appointments)) return []
    return normalize<Appointment>(rows(appointments.appointments), ['appointment_date'])
  },

  async get(id: number): Promise<Appointment> {
    const data = await request<unknown>(`/appointment/${id}`)
    const first = readAppointment(data)
    if (!first) throw new ApiError('That appointment no longer exists.', 404)
    return normalize<Appointment>([first], ['appointment_date'])[0]
  },

  async create(input: AppointmentInput): Promise<Appointment> {
    const data = await request<unknown>('/appointment', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const first = readAppointment(data)
    if (!first) throw new ApiError('The appointment was created but no record was returned.', 500)
    return normalize<Appointment>([first], ['appointment_date'])[0]
  },

  async update(id: number, input: AppointmentUpdateInput): Promise<Appointment> {
    const data = await request<unknown>(`/appointment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const first = readAppointment(data)
    if (!first) throw new ApiError('No appointment was updated with that id.', 404)
    return normalize<Appointment>([first], ['appointment_date'])[0]
  },

  async remove(id: number): Promise<void> {
    await request(`/appointment/${id}`, { method: 'DELETE' })
  },

  async checkAvailability(input: {
    /** The server also checks the customer is free — not just the stylist. */
    customer_id?: number
    staff_id: number
    service_id?: number
    appointment_date: string
    start_time: string
    end_time: string
  }): Promise<AvailabilityResponse> {
    const data = await request<AvailabilityResponse>('/appointment/avail', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return {
      status: 'success',
      data: Boolean(data?.data),
      message: data?.message ?? '',
    }
  },
}

/* ============================================================
   JWT payload reader — used for display only (the backend stays
   the authority on identity and permissions).
   ============================================================ */

export function decodeUser(jwt: string): AuthUser {
  try {
    const payload = jwt.split('.')[1]
    if (!payload) throw new Error('malformed token')
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    const claims = JSON.parse(json) as Record<string, unknown>
    return {
      id: Number(claims.id ?? 0),
      email: String(claims.email ?? ''),
      role: String(claims.role ?? 'staff'),
    }
  } catch {
    return { id: 0, email: '', role: 'staff' }
  }
}
