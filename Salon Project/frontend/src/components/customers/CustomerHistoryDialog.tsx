import { useMemo } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/States'
import { StatusBadge } from '../ui/Badge'
import { staffNameOf } from '../../lib/staffName'
import {
  BLOCKING_STATUSES,
  formatMediumDate,
  formatMoney,
  formatWeekday,
  initials,
  pluralize,
  time,
  todayIso,
} from '../../lib/format'
import type { Appointment, Customer, Service, Staff } from '../../types'

interface HistoryProps {
  customer: Customer | null
  appointments: Appointment[]
  services: Service[]
  staff: Staff[]
  onClose: () => void
}

interface Visit {
  appointment: Appointment
  serviceName: string
  staffName: string
  price: number
}

// Punctuation kept as named constants so the copy is readable in source and no
// stray encoding can mangle it.
const DOT = ' · ' // separator between facts
const DASH = '–' // between start and end time
const EMDASH = '—' // placeholder when a value is unknown

/**
 * Everything a client has ever booked: what they had, when, with whom, what it
 * cost and how it ended.
 *
 * Derived entirely from data the app already loads (`GET /appointment`,
 * `GET /service`, `GET /staff`) so opening it makes no extra request.
 */
export function CustomerHistoryDialog({
  customer,
  appointments,
  services,
  staff,
  onClose,
}: HistoryProps) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])

  const visits = useMemo<Visit[]>(() => {
    if (!customer) return []
    return appointments
      .filter((a) => a.customer_id === customer.id)
      .map((appointment) => {
        const service = serviceById.get(appointment.service_id)
        const member = staffById.get(appointment.staff_id)
        return {
          appointment,
          serviceName: service?.name ?? `Service #${appointment.service_id}`,
          // Staff are only readable by an admin, so a staff-role user still gets
          // a sensible label rather than a blank.
          staffName: member ? staffNameOf(member) : `Staff #${appointment.staff_id}`,
          price: Number(service?.price ?? 0),
        }
      })
      .sort((a, b) =>
        a.appointment.appointment_date === b.appointment.appointment_date
          ? time(b.appointment.start_time).localeCompare(time(a.appointment.start_time))
          : b.appointment.appointment_date.localeCompare(a.appointment.appointment_date),
      )
  }, [customer, appointments, serviceById, staffById])

  const summary = useMemo(() => {
    // Cancelled and no-show visits were never delivered, so they are excluded
    // from spend and from the visits figure.
    const delivered = visits.filter(
      (v) => !['CANCELLED', 'NO_SHOW'].includes(String(v.appointment.status).toUpperCase()),
    )
    const spend = delivered.reduce((total, v) => total + v.price, 0)

    const favourites = new Map<string, { name: string; count: number }>()
    for (const v of delivered) {
      const entry = favourites.get(v.serviceName) ?? { name: v.serviceName, count: 0 }
      entry.count += 1
      favourites.set(v.serviceName, entry)
    }
    const favourite = [...favourites.values()].sort((a, b) => b.count - a.count)[0]

    return {
      delivered: delivered.length,
      cancelled: visits.length - delivered.length,
      spend,
      last: delivered[0] ?? null,
      favourite: favourite && favourite.count > 1 ? favourite : null,
      upcoming: visits.filter(
        (v) =>
          v.appointment.appointment_date >= todayIso() &&
          BLOCKING_STATUSES.has(String(v.appointment.status).toUpperCase()),
      ).length,
    }
  }, [visits])

  if (!customer) return null

  return (
    <Modal
      open
      wide
      title="Visit history"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="history">
        <div className="history__who">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(customer.name)}
          </span>
          <div>
            <p className="history__name">{customer.name}</p>
            <p className="history__contact">
              {customer.phone}
              {customer.email ? `${DOT}${customer.email}` : ''}
            </p>
          </div>
        </div>

        {visits.length === 0 ? (
          <EmptyState
            title="No visits on record"
            text={`${customer.name} has not booked anything yet.`}
          />
        ) : (
          <>
            <dl className="history__stats">
              <div>
                <dt>Visits</dt>
                <dd>{summary.delivered}</dd>
              </div>
              <div>
                <dt>Total spend</dt>
                <dd>{formatMoney(summary.spend)}</dd>
              </div>
              {summary.upcoming > 0 && (
                <div>
                  <dt>Upcoming</dt>
                  <dd>{summary.upcoming}</dd>
                </div>
              )}
              {summary.cancelled > 0 && (
                <div>
                  <dt>Cancelled</dt>
                  <dd>{summary.cancelled}</dd>
                </div>
              )}
            </dl>

            {summary.last && (
              <p className="history__last">
                Last visit <strong>{formatMediumDate(summary.last.appointment.appointment_date)}</strong>
                {DOT}
                {summary.last.serviceName} with {summary.last.staffName}
              </p>
            )}
            {summary.favourite && (
              <p className="history__last">
                Usual choice <strong>{summary.favourite.name}</strong> ({summary.favourite.count}{' '}
                visits)
              </p>
            )}

            <ol className="history__list">
              {visits.map(({ appointment, serviceName, staffName, price }) => {
                const status = String(appointment.status).toUpperCase()
                return (
                  <li key={appointment.id} className="history__item">
                    <div className="history__when">
                      <span className="history__day">
                        {formatMediumDate(appointment.appointment_date)}
                      </span>
                      <span className="history__weekday">
                        {formatWeekday(appointment.appointment_date)}
                      </span>
                    </div>
                    <div className="history__what">
                      <span className="history__service">{serviceName}</span>
                      <span className="history__meta">
                        {time(appointment.start_time)} {DASH} {time(appointment.end_time)}
                        {DOT}
                        {staffName}
                      </span>
                      {appointment.notes?.trim() ? (
                        <span className="history__note">{appointment.notes}</span>
                      ) : null}
                    </div>
                    <div className="history__tail">
                      <StatusBadge status={status} />
                      <span className="history__price">
                        {price > 0 ? formatMoney(price) : EMDASH}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>

            <p className="history__foot">
              {pluralize(visits.length, 'appointment')} on file. Cancelled and no-show visits are
              excluded from spend.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}