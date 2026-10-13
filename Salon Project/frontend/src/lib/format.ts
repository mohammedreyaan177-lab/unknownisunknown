/* ============================================================
   Presentation helpers. These format values the API returns and
   derive view-only metrics. No business rules live here — slot
   availability always comes from the backend.
   ============================================================ */

/* ============================================================
   Business timezone.

   The salon's calendar day is an Asia/Kolkata day. The Postgres server runs
   with TimeZone=Asia/Calcutta, so it builds `date` columns and `now()` on that
   clock. Deriving "today" from the *browser's* local time would therefore put a
   visitor outside IST on the wrong business day around midnight, so every
   date-dependent calculation is anchored to the business zone instead. Times
   that are already wall-clock strings ("10:00:00") are left alone.
   ============================================================ */

export const BUSINESS_TIME_ZONE = 'Asia/Kolkata'

/** YYYY-MM-DD for an instant, as seen on the salon clock. */
const businessDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** HH:MM on the salon clock (24h, independent of the browser's locale). */
const businessClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const currencyPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

const longDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: BUSINESS_TIME_ZONE,
})

const mediumDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const weekdayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })

/**
 * Salon opening hours, in minutes from midnight.
 *
 * These mirror SALOON_OPEN_TIME / SALOON_CLOSE_TIME in backend/src/.env. They
 * exist so the booking grid only offers slots the server will actually accept:
 * the grid used to run 08:00-22:00 against a 09:00-20:00 salon, which put six
 * unbookable times in front of the receptionist for every service.
 *
 * The server remains the authority — POST /appointment/avail confirms the slot
 * and POST /appointment re-validates it on save — this only stops the UI from
 * offering what the server will refuse.
 */
export const SALON_OPEN_MINUTES = 9 * 60
export const SALON_CLOSE_MINUTES = 20 * 60

/** "10:00:00" -> "10:00" */
export function time(value: string | null | undefined): string {
  if (!value) return '—'
  const [h = '0', m = '00'] = value.split(':')
  return `${h.padStart(2, '0')}:${m}`
}

/** Minutes since midnight, from "HH:MM" or "HH:MM:SS". */
export function minutesOfDay(value: string): number {
  const [h = '0', m = '0'] = value.split(':')
  return Number(h) * 60 + Number(m)
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM:SS" or "HH:MM" -> "HH:MM:SS" for the Postgres time column. */
export function toApiTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value
}

/**
 * "Today" for the salon, read off the business clock rather than the visitor's
 * timezone. Between 00:00 and 05:30 IST a browser in a western timezone is
 * still on the previous calendar day, which would file today's bookings under
 * yesterday. Passing an explicit `now` keeps this deterministic in tests.
 */
export function todayIso(now: Date = new Date()): string {
  return businessDay.format(now)
}

/**
 * Minutes since midnight on the salon clock, used for the dashboard's
 * "done / still to come" split so it does not drift with the visitor's zone.
 */
export function businessMinutesOfDay(now: Date = new Date()): number {
  const [h = '0', m = '0'] = businessClock.format(now).split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Builds a local Date from a YYYY-MM-DD string. The API layer normalises
 * Postgres `date` columns to this shape, so the first 10 characters are the
 * calendar day — slicing here keeps the formatting helpers safe for any caller.
 */
function parseIsoDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function formatMediumDate(value: string): string {
  return mediumDate.format(parseIsoDate(value))
}

export function formatWeekday(value: string): string {
  return weekdayShort.format(parseIsoDate(value))
}

export function formatDayMonth(value: string): string {
  return dayMonth.format(parseIsoDate(value))
}

export function formatTodayHeading(date = new Date()): string {
  return longDate.format(date)
}

export function formatMoney(value: string | number): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return Number.isInteger(amount) ? currency.format(amount) : currencyPrecise.format(amount)
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function formatAge(isoBirth: string | null): string | null {
  if (!isoBirth) return null
  const birth = parseIsoDate(isoBirth)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDelta = now.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 130 ? String(age) : null
}

export function greeting(now: Date = new Date()): string {
  const hour = Math.floor(businessMinutesOfDay(now) / 60)
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The approximate birthday of someone who is `age` on the salon's current date.
 *
 * The salon records a birthday (the `customers.date_of_birth` column) but the
 * front desk asks for an age, which is all they need. This maps one to the other
 * in the business timezone; the day and month are kept as today so a birthday
 * that has not happened yet this year is not pulled forward a year.
 */
export function dateOfBirthFromAge(age: number, now: Date = new Date()): string {
  const [y, m, d] = todayIso(now).split('-').map(Number)
  const born = new Date((y ?? 1970) - Math.trunc(age), (m ?? 1) - 1, d ?? 1)
  const by = String(born.getFullYear()).padStart(4, '0')
  const bm = String(born.getMonth() + 1).padStart(2, '0')
  const bd = String(born.getDate()).padStart(2, '0')
  return `${by}-${bm}-${bd}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many
}

/** Statuses that still occupy a staff member's calendar. */
export const BLOCKING_STATUSES = new Set(['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'])
