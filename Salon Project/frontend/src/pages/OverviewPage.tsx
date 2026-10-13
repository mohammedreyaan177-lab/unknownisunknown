import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/ui/Badge'
import { staffNameOf } from '../lib/staffName'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States'
import { useSalonNow } from '../hooks/useSalonClock'
import { useAuth } from '../context/AuthContext'
import { useSalonData } from '../context/SalonDataContext'
import {
  BLOCKING_STATUSES,
  businessMinutesOfDay,
  formatDayMonth,
  formatTodayHeading,
  formatWeekday,
  greeting,
  initials,
  minutesOfDay,
  pluralize,
  time,
  todayIso,
} from '../lib/format'
import type { Appointment, Service, Staff } from '../types'

export function OverviewPage() {
  const { user } = useAuth()
  const { customers, services, staff, appointments, loading, error, staffRestricted, refresh } =
    useSalonData()

  // Re-reads on an interval, so the date, the greeting and the "today"
  // grouping all follow the real clock — including across salon midnight.
  const now = useSalonNow()

  const view = useMemo(
    () => buildView(appointments, customers, services, staff, now.date),
    [appointments, customers, services, staff, now.date],
  )

  return (
    <>
      <header className="head">
        <div className="head__text">
          <span className="head__eyebrow">Salon management</span>
          <h1 className="head__title">
            {greeting(now.date)}, {user?.email?.split('@')[0] ?? 'there'}
          </h1>
          <p className="head__note">{formatTodayHeading(now.date)}</p>
        </div>
        <div className="head__actions">
          <Link to="/appointments">
            <Button variant="primary">Open appointments</Button>
          </Link>
          <Link to="/customers">
            <Button variant="outline">Customers</Button>
          </Link>
        </div>
      </header>

      {error ? (
        <div className="panel">
          <ErrorState
            title="The dashboard could not load"
            message={error}
            onRetry={() => void refresh()}
          />
        </div>
      ) : (
        <>
          <section className="stats" aria-label="Salon at a glance">
            <div className="stat stat--lead">
              <span className="stat__label">Appointments today</span>
              {loading ? (
                <Skeleton height="2.6rem" />
              ) : (
                <span className="stat__value">{pad(view.todayCount)}</span>
              )}
              <span className="stat__foot">
                {view.todayCount === 0
                  ? 'Nothing booked for today'
                  : `${view.todayDone} done · ${view.todayRemaining} to come`}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Customers</span>
              {loading ? <Skeleton height="1.8rem" /> : <span className="stat__value">{pad(customers.length)}</span>}
              <span className="stat__foot">{pluralize(customers.length, 'record')} on file</span>
            </div>
            <div className="stat">
              <span className="stat__label">Services</span>
              {loading ? <Skeleton height="1.8rem" /> : <span className="stat__value">{pad(services.length)}</span>}
              <span className="stat__foot">
                {services.filter((s) => s.is_active).length} bookable
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Staff</span>
              {loading ? (
                <Skeleton height="1.8rem" />
              ) : staffRestricted ? (
                <span className="stat__value">—</span>
              ) : (
                <span className="stat__value">{pad(staff.length)}</span>
              )}
              <span className="stat__foot">
                {staffRestricted ? 'Admins only' : `${staff.filter((s) => s.is_active).length} on the floor`}
              </span>
            </div>
          </section>

          <div className="overview-grid">
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Today&rsquo;s schedule</h2>
                <span className="panel__meta">
                  {view.todayCount} {pluralize(view.todayCount, 'entry', 'entries')}
                </span>
              </div>
              {loading ? (
                <Skeleton rows={4} />
              ) : view.today.length === 0 ? (
                <EmptyState
                  title="No appointments scheduled for today"
                  text="When a booking lands on today's date it will appear here in time order."
                  action={
                    <Link to="/appointments">
                      <Button variant="accent">Book an appointment</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="rail-list">
                  {view.today.map((row) => (
                    <article className="slot-row" key={row.appointment.id}>
                      <p className="slot-row__time tnum">
                        {time(row.appointment.start_time)}
                        <span className="slot-row__end">{time(row.appointment.end_time)}</span>
                      </p>
                      <span className="slot-row__rule" aria-hidden="true" />
                      <div className="slot-row__body">
                        <div className="slot-row__what">
                          <p className="slot-row__who">{row.customerName}</p>
                          <p className="slot-row__what-row">
                            <span>{row.serviceName}</span>
                            <span className="dot-sep">{row.staffName}</span>
                          </p>
                        </div>
                        <StatusBadge status={row.appointment.status} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <section className="panel">
                <div className="panel__head">
                  <h2 className="panel__title">Upcoming</h2>
                  <span className="panel__meta">Next seven days</span>
                </div>
                {loading ? (
                  <Skeleton rows={3} />
                ) : view.upcoming.length === 0 ? (
                  <EmptyState title="Nothing upcoming" text="The next seven days are clear." />
                ) : (
                  <div className="today-list">
                    {view.upcoming.slice(0, 6).map(({ appointment, customerName, serviceName }) => (
                      <Link className="today-row" to="/appointments" key={appointment.id}>
                        <span className="avatar" aria-hidden="true">
                          {initials(customerName)}
                        </span>
                        <span className="today-row__text">
                          <span className="today-row__title">{customerName}</span>
                          <span className="today-row__meta">
                            {formatWeekday(appointment.appointment_date)} {formatDayMonth(appointment.appointment_date)} ·{' '}
                            {serviceName}
                          </span>
                        </span>
                        <span className="today-row__time">{time(appointment.start_time)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel__head">
                  <h2 className="panel__title">Appointment status</h2>
                  <span className="panel__meta">All records</span>
                </div>
                {loading ? (
                  <Skeleton height="9rem" />
                ) : view.statusCounts.length === 0 ? (
                  <EmptyState title="No appointments yet" text="Bookings will be counted here." />
                ) : (
                  <div className="status-breakdown">
                    {view.statusCounts.map(({ status, count }) => (
                      <div className="status-breakdown__row" key={status}>
                        <span className="status-breakdown__label">
                          <StatusBadge status={status} />
                        </span>
                        <span className="status-breakdown__count">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}

interface Row {
  appointment: Appointment
  customerName: string
  serviceName: string
  staffName: string
}

interface OverviewView {
  today: Row[]
  todayCount: number
  todayDone: number
  todayRemaining: number
  upcoming: Row[]
  statusCounts: { status: string; count: number }[]
}

function buildView(
  appointments: Appointment[],
  customers: { id: number; name: string }[],
  services: Service[],
  staff: Staff[],
  now: Date = new Date(),
): OverviewView {
  const customerName = new Map(customers.map((c) => [c.id, c.name]))
  const serviceName = new Map(services.map((s) => [s.id, s.name]))

  const rows: Row[] = appointments.map((appointment) => ({
    appointment,
    customerName: customerName.get(appointment.customer_id) ?? `Customer #${appointment.customer_id}`,
    serviceName: serviceName.get(appointment.service_id) ?? `Service #${appointment.service_id}`,
    staffName: staffNameOf(staff.find((entry) => entry.id === appointment.staff_id) ?? { id: appointment.staff_id }),
  }))

const today = todayIso(now)
  const nowMinutes = businessMinutesOfDay(now)

  const todaysRows = rows
    .filter((row) => row.appointment.appointment_date === today)
    .sort((a, b) => minutesOfDay(a.appointment.start_time) - minutesOfDay(b.appointment.start_time))

  const upcoming = rows
    .filter(
      (row) =>
        row.appointment.appointment_date > today &&
        BLOCKING_STATUSES.has(String(row.appointment.status).toUpperCase()),
    )
    .sort((a, b) =>
      a.appointment.appointment_date === b.appointment.appointment_date
        ? minutesOfDay(a.appointment.start_time) - minutesOfDay(b.appointment.start_time)
        : a.appointment.appointment_date.localeCompare(b.appointment.appointment_date),
    )

  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.appointment.status).toUpperCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return {
    today: todaysRows,
    todayCount: todaysRows.length,
    todayDone: todaysRows.filter((r) => String(r.appointment.status).toUpperCase() === 'COMPLETED').length,
    todayRemaining: todaysRows.filter(
      (r) =>
        String(r.appointment.status).toUpperCase() !== 'COMPLETED' &&
        minutesOfDay(r.appointment.start_time) >= nowMinutes,
    ).length,
    upcoming,
    statusCounts: [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  }
}


function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
