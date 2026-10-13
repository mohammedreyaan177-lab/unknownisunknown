/* ============================================================
   Domain + transport types.
   Shapes mirror the real backend payloads (controllers return
   single-key wrappers around service results, which themselves
   wrap arrays). Nothing here is invented.
   ============================================================ */

/* ---------- Auth ---------- */

export type UserRole = 'admin' | 'staff' | string

export interface User {
  id: number
  email: string
  role: UserRole
}

export interface LoginResponse {
  status: 'success'
  token: string
}

export interface RegisterResponse {
  status: 'success'
  user: User
}

/* ---------- Customers ---------- */

export interface Customer {
  id: number
  name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/* ---------- Services ---------- */

export interface Service {
  id: number
  name: string
  description: string | null
  category: string
  duration_minutes: number
  price: string | number
  is_active: boolean
  created_at: string
  updated_at: string
}

/* ---------- Staff ---------- */

export interface StaffUser {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface Staff {
  id: number
  user_id: number
  phone: string | null
  specialization: string | null
  is_active: boolean
  /** Present on create/update responses; optional so the UI degrades safely. */
  name?: string
  email?: string
  created_at: string
  updated_at: string
}

/* ---------- Appointments ---------- */

export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export interface Appointment {
  id: number
  customer_id: number
  staff_id: number
  service_id: number
  appointment_date: string
  start_time: string
  end_time: string
  status: AppointmentStatus | string
  notes: string | null
  created_at: string
  updated_at: string
}

/* ---------- Availability ---------- */

export interface AvailabilityResponse {
  status: 'success'
  data: boolean
  message: string
}

/* ---------- Authenticated session ---------- */

export interface AuthUser {
  id: number
  email: string
  role: UserRole
}

/* ---------- Request payloads ---------- */

export interface CustomerInput {
  name: string
  phone: string
  /** Null when left blank — the column is nullable and "" would collide
   *  with the server's duplicate-email check. */
  email: string | null
  /** Null when unset — Postgres `date` columns reject an empty string. */
  date_of_birth: string | null
  notes: string | null
}

export interface ServiceInput {
  name: string
  description: string
  category: string
  duration_minutes: number
  price: number
  is_active: boolean
}

export interface StaffCreateInput {
  name: string
  email: string
  password: string
  phone: string
  specialization: string
}

export interface StaffUpdateInput {
  name: string
  email: string
  phone: string
  specialization: string
  is_active: boolean
}

export interface AppointmentInput {
  customer_id: number
  staff_id: number
  service_id: number
  appointment_date: string
  start_time: string
  end_time: string
  notes: string
}

export interface AppointmentUpdateInput extends AppointmentInput {
  status: AppointmentStatus
}
