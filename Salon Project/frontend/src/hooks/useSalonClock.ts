import { useEffect, useState } from 'react'
import { BUSINESS_TIME_ZONE, businessMinutesOfDay, todayIso } from '../lib/format'

/** One shared tick for the whole app — see SalonDataProvider's poller. */
const TICK_MS = 30_000

/**
 * A live reading of the salon's wall clock.
 *
 * Re-reads on an interval so a desk left open overnight does not keep showing
 * yesterday's date, and "today" rolls over at salon midnight (Asia/Kolkata)
 * rather than at the visitor's midnight. The interval is created in an effect
 * and torn down on unmount, so nothing leaks and nothing is scheduled during
 * render.
 *
 * `initial` seeds the first render so tests can drive the clock instead of
 * waiting for real time to pass.
 */
export function useSalonClock(initial: Date = new Date()): Date {
  const [now, setNow] = useState(initial)

  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), TICK_MS)
    return () => window.clearInterval(handle)
  }, [])

  return now
}

/** Today's business date plus the time on the salon clock, for display. */
export function useSalonNow(): { date: Date; today: string; minutes: number } {
  const now = useSalonClock()
  return { date: now, today: todayIso(now), minutes: businessMinutesOfDay(now) }
}

export { BUSINESS_TIME_ZONE, TICK_MS }