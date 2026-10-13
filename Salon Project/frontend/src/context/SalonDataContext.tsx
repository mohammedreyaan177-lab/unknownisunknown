import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, appointmentApi, customerApi, serviceApi, staffApi } from '../lib/api'
import type { Appointment, Customer, Service, Staff } from '../types'
import { useAuth } from './AuthContext'

interface SalonData {
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  appointments: Appointment[]
  loading: boolean
  error: string | null
  /** Staff routes are admin-only; a 403 here is expected, not an error. */
  staffRestricted: boolean
  refresh: () => Promise<void>
  refreshAppointments: () => Promise<void>
  upsertCustomer: (customer: Customer) => void
  removeCustomer: (id: number) => void
  upsertService: (service: Service) => void
  removeService: (id: number) => void
  upsertStaff: (staff: Staff) => void
  upsertAppointment: (appointment: Appointment) => void
  removeAppointment: (id: number) => void
}

const SalonContext = createContext<SalonData | null>(null)

/**
 * How often a visible desk re-reads the book. Long enough to be cheap for a
 * single-branch salon, short enough that a booking made at the next till shows
 * up while the receptionist is still looking at the screen.
 */
const POLL_MS = 45_000

export function SalonDataProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, invalidate } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staffRestricted, setStaffRestricted] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [customersResult, servicesResult, appointmentsResult] = await Promise.allSettled([
      customerApi.list(),
      serviceApi.list(),
      appointmentApi.list(),
    ])

    setCustomers(settled(customersResult, []))
    setServices(settled(servicesResult, []))
    setAppointments(settled(appointmentsResult, []))

    const failure = [customersResult, servicesResult, appointmentsResult].find(
      (r) => r.status === 'rejected',
    )
    if (failure && failure.status === 'rejected' && failure.reason instanceof ApiError) {
      if (failure.reason.isAuthError) invalidate()
      else setError(failure.reason.message)
    }

    // Staff is admin-gated; ask only when the token says it will be allowed.
    if (isAdmin) {
      try {
        setStaff(await staffApi.list())
        setStaffRestricted(false)
      } catch (err) {
        setStaff([])
        if (err instanceof ApiError && err.isForbidden) setStaffRestricted(true)
        else if (err instanceof ApiError && err.isAuthError) invalidate()
      }
    } else {
      setStaff([])
      setStaffRestricted(true)
    }

    setLoading(false)
  }, [isAdmin, invalidate])

  const refreshAppointments = useCallback(async () => {
    try {
      setAppointments(await appointmentApi.list())
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) invalidate()
    }
  }, [invalidate])

  // `loadAll` sets state, so it runs from an event-free effect only when the
  // session actually changes — never on an intermediate render.
  useEffect(() => {
    if (!user) return
    const handle = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(handle)
  }, [user, loadAll])

  /**
   * Cross-user visibility.
   *
   * The backend offers no WebSocket, SSE or notification channel — the only
   * transport is plain REST — so another desk's booking cannot arrive without a
   * request. This polls while the tab is visible, pauses when it is hidden, and
   * refetches immediately when the tab comes back so a desk that was in the
   * background is never left showing a stale book.
   *
   * Guards: the effect is keyed on the session, so it never runs for a signed
   * out user; an in-flight flag stops requests overlapping when a poll is slower
   * than the interval; a failed poll leaves the last good data in place and only
   * surfaces the message, so a blip does not blank the screen.
   */
  useEffect(() => {
    if (!user) return

    let stopped = false
    let inFlight = false
    let timer: number | undefined

    const poll = async () => {
      if (stopped || inFlight) return
      inFlight = true
      try {
        const [nextAppointments, nextCustomers, nextServices] = await Promise.all([
          appointmentApi.list(),
          customerApi.list(),
          serviceApi.list(),
        ])
        if (stopped) return
        setAppointments(nextAppointments)
        setCustomers(nextCustomers)
        setServices(nextServices)
        setError(null)
      } catch (err) {
        // Keep the last valid data; only report if the session really died.
        if (!stopped && err instanceof ApiError && err.isAuthError) invalidate()
      } finally {
        inFlight = false
      }
    }

    const schedule = () => {
      if (stopped) return
      timer = window.setTimeout(async () => {
        await poll()
        schedule()
      }, POLL_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        window.clearTimeout(timer)
        timer = undefined
        return
      }
      window.clearTimeout(timer)
      timer = undefined
      void poll().then(schedule)
    }

    if (document.visibilityState === 'visible') schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, invalidate])

  const value = useMemo<SalonData>(
    () => ({
      customers,
      services,
      staff,
      appointments,
      loading,
      error,
      staffRestricted,
      refresh: loadAll,
      refreshAppointments,
      upsertCustomer: (customer) =>
        setCustomers((list) => replaceById(list, customer)),
      removeCustomer: (id) => setCustomers((list) => list.filter((c) => c.id !== id)),
      upsertService: (service) => setServices((list) => replaceById(list, service)),
      removeService: (id) => setServices((list) => list.filter((s) => s.id !== id)),
      upsertStaff: (next) => setStaff((list) => replaceById(list, next)),
      upsertAppointment: (appointment) =>
        setAppointments((list) => replaceById(list, appointment)),
      removeAppointment: (id) => setAppointments((list) => list.filter((a) => a.id !== id)),
    }),
    [customers, services, staff, appointments, loading, error, staffRestricted, loadAll, refreshAppointments],
  )

  return <SalonContext.Provider value={value}>{children}</SalonContext.Provider>
}

function settled<T>(result: PromiseSettledResult<T[]>, fallback: T[]): T[] {
  return result.status === 'fulfilled' ? result.value : fallback
}

function replaceById<T extends { id: number }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index === -1) return [...list, item]
  const next = [...list]
  next[index] = item
  return next
}

export function useSalonData(): SalonData {
  const ctx = useContext(SalonContext)
  if (!ctx) throw new Error('useSalonData must be used inside SalonDataProvider')
  return ctx
}
