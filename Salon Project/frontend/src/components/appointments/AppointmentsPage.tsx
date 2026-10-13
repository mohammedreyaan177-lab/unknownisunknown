import { useMemo, useState } from 'react'
import { errorMessage } from '../../context/AuthContext'
import { useSalonData } from '../../context/SalonDataContext'
import { appointmentApi } from '../../lib/api'
import {
  BLOCKING_STATUSES,
  formatMediumDate,
  initials,
  minutesOfDay,
  pluralize,
  time,
  todayIso,
} from '../../lib/format'
import type { Appointment, AppointmentStatus } from '../../types'
import { APPOINTMENT_STATUSES } from '../../types'
import { StatusBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SelectField } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { SearchInput } from '../ui/SearchInput'
import { staffNameOf } from '../../lib/staffName'
import { EmptyState, ErrorState, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import { AppointmentComposer } from './AppointmentComposer'


type Scope = 'upcoming' | 'today' | 'past' | 'all'

export function AppointmentsPage() {
  const { appointments, customers, services, staff, staffRestricted, loading, error, refresh, removeAppointment, upsertAppointment } =
    useSalonData()
  const toast = useToast()

  const [scope, setScope] = useState<Scope>('upcoming')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | AppointmentStatus>('')
  const [booking, setBooking] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null)
  const [removing, setRemoving] = useState<Appointment | null>(null)
  const [busy, setBusy] = useState(false)

  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])
  const serviceName = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services])

  const visible = useMemo(() => {
    const today = todayIso()
    const needle = query.trim().toLowerCase()

    return appointments
      .filter((appointment) => {
        const status = String(appointment.status).toUpperCase()
        if (statusFilter && status !== statusFilter) return false

        if (scope === 'today' && appointment.appointment_date !== today) return false
        if (scope === 'upcoming' && !BLOCKING_STATUSES.has(status)) return false
        if (scope === 'upcoming' && appointment.appointment_date < today) return false
        if (scope === 'past' && appointment.appointment_date >= today) return false

        if (needle) {
          const name = customerName.get(appointment.customer_id) ?? ''
          const service = serviceName.get(appointment.service_id) ?? ''
          const member = staff.find((s) => s.id === appointment.staff_id)
          const staffText = member ? staffNameOf(member) : `Staff #${appointment.staff_id}`
          return [name, service, staffText, appointment.notes ?? '', time(appointment.start_time)].some(
            (value) => value.toLowerCase().includes(needle),
          )
        }
        return true
      })
      .sort((a, b) =>
        a.appointment_date === b.appointment_date
          ? minutesOfDay(a.start_time) - minutesOfDay(b.start_time)
          : scope === 'past'
            ? b.appointment_date.localeCompare(a.appointment_date)
            : a.appointment_date.localeCompare(b.appointment_date),
      )
  }, [appointments, scope, query, statusFilter, customerName, serviceName, staff])

  const changeStatus = async (appointment: Appointment, status: AppointmentStatus) => {
    if (busy) return
    setBusy(true)
    try {
      const saved = await appointmentApi.update(appointment.id, {
        customer_id: appointment.customer_id,
        staff_id: appointment.staff_id,
        service_id: appointment.service_id,
        appointment_date: appointment.appointment_date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status,
        notes: appointment.notes ?? '',
      })
      upsertAppointment(saved)
      setStatusTarget(null)
      toast.success(`Marked ${status.replace(/_/g, ' ').toLowerCase()}`, 'The schedule has been refreshed.')
    } catch (err) {
      toast.error('Could not update the status', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const confirmRemove = async () => {
    if (!removing || busy) return
    setBusy(true)
    try {
      await appointmentApi.remove(removing.id)
      removeAppointment(removing.id)
      setRemoving(null)
      toast.success('Appointment deleted', 'The slot is free again.')
    } catch (err) {
      toast.error('Could not delete the appointment', errorMessage(err))
      setBusy(false)
    }
  }

  const today = todayIso()

  return (
    <>
      <PageHeader
        eyebrow="The book"
        title="Appointments"
        note="Bookings, availability and status across the salon floor."
        actions={
          <Button variant="primary" onClick={() => setBooking(true)}>
            New appointment
          </Button>
        }
      />

      {error ? (
        <div className="panel">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="visually-hidden" htmlFor="appt-search">
              Search appointments
            </label>
            <SearchInput
              id="appt-search"
              value={query}
              onChange={setQuery}
              placeholder="Search client, service or staff"
            />
            <div className="filters">
              <label className="visually-hidden" htmlFor="appt-status">
                Filter by status
              </label>
              <select
                id="appt-status"
                className="field__control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | AppointmentStatus)}
              >
                <option value="">Any status</option>
                {APPOINTMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <div className="seg" role="group" aria-label="Filter by date">
                {(['upcoming', 'today', 'past', 'all'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`seg__item ${scope === key ? 'seg__item--on' : ''}`}
                    aria-pressed={scope === key}
                    onClick={() => setScope(key)}
                  >
                    {key === 'today' ? 'Today' : key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <span className="result-count">
                {loading ? 'Loading' : `${visible.length} ${pluralize(visible.length, 'booking')}`}
              </span>
            </div>
          </div>

          <div className="tablewrap">
            {loading ? (
              <Skeleton rows={5} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={emptyTitle(scope, query, statusFilter, today)}
                text={emptyText(scope, query, statusFilter)}
                action={
                  query || statusFilter || scope !== 'upcoming' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery('')
                        setStatusFilter('')
                        setScope('upcoming')
                      }}
                    >
                      Reset filters
                    </Button>
                  ) : (
                    <Button variant="accent" onClick={() => setBooking(true)}>
                      Book an appointment
                    </Button>
                  )
                }
              />
            ) : (
              <div className="tablescroll">
                <table className="data">
                  <caption className="visually-hidden">{visible.length} appointments</caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Client</th>
                      <th scope="col">Service</th>
                      <th scope="col">Professional</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((appointment) => {
                      const name = customerName.get(appointment.customer_id) ?? `Customer #${appointment.customer_id}`
                      const member = staff.find((s) => s.id === appointment.staff_id)
                      const svc = serviceName.get(appointment.service_id) ?? `Service #${appointment.service_id}`
                      return (
                        <tr key={appointment.id}>
                          <td className="num" data-label="When">
                            <strong>{time(appointment.start_time)}</strong>
                            <span className="cellname__sub">
                              {formatMediumDate(appointment.appointment_date)}
                            </span>
                          </td>
                          <td data-label="">
                            <span className="cellname">
                              <span className="avatar" aria-hidden="true">
                                {initials(name)}
                              </span>
                              <span className="cellname__text">
                                <span className="cellname__title">{name}</span>
                                <span className="cellname__sub">{time(appointment.end_time)} finish</span>
                              </span>
                            </span>
                          </td>
                          <td className="muted" data-label="Service">
                            {svc}
                          </td>
                          <td className="muted" data-label="Professional">
                            {member ? staffNameOf(member) : `Staff #${appointment.staff_id}`}
                          </td>
                          <td data-label="Status">
                            <StatusBadge status={appointment.status} />
                          </td>
                          <td className="actions-cell" data-label="">
                            <div className="actions">
                              <Button size="sm" variant="ghost" onClick={() => setStatusTarget(appointment)}>
                                Status
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditing(appointment)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete appointment for ${name}`}
                                onClick={() => setRemoving(appointment)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={booking}
        title="New appointment"
        subtitle="Customer, service, professional, then a time the server confirms."
        onClose={() => setBooking(false)}
        wide
      >
        {customers.length === 0 ? (
          <EmptyState
            title="Add a customer first"
            text="An appointment needs a customer record. Add one, then come back to book."
          />
        ) : services.length === 0 ? (
          <EmptyState
            title="Add a service first"
            text="An appointment needs a service so the duration and price are known."
          />
        ) : staffRestricted ? (
          <EmptyState
            title="The team list is admin-only"
            text="An administrator account is needed to see staff and assign a professional."
          />
        ) : (
          <AppointmentComposer onCancel={() => setBooking(false)} onSaved={() => setBooking(false)} />
        )}
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit appointment"
        subtitle={editing ? `Booking #${editing.id}` : undefined}
        onClose={() => setEditing(null)}
        wide
      >
        {editing && (
          <AppointmentComposer
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        title="Update status"
        subtitle={statusTarget ? `Currently ${String(statusTarget.status).replace(/_/g, ' ').toLowerCase()}` : undefined}
        onClose={() => setStatusTarget(null)}
      >
        {statusTarget && (
          <StatusForm
            current={String(statusTarget.status).toUpperCase()}
            busy={busy}
            onPick={(status) => void changeStatus(statusTarget, status)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(removing)}
        title="Delete this appointment?"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmRemove()}>
              Delete appointment
            </Button>
          </>
        }
      >
        <p className="confirm__text">
          The booking on <strong>{removing && formatMediumDate(removing.appointment_date)}</strong> at{' '}
          <strong>{removing && time(removing.start_time)}</strong> will be removed and the slot freed.
        </p>
      </Modal>
    </>
  )
}

function StatusForm({
  current,
  busy,
  onPick,
}: {
  current: string
  busy: boolean
  onPick: (status: AppointmentStatus) => void
}) {
  const [choice, setChoice] = useState<AppointmentStatus>(
    (APPOINTMENT_STATUSES.find((s) => s === current) ?? 'BOOKED') as AppointmentStatus,
  )

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <SelectField
        label="New status"
        value={choice}
        onChange={(e) => setChoice(e.target.value as AppointmentStatus)}
        disabled={busy}
        hint="Cancelled and no-show appointments free the slot for rebooking."
      >
        {APPOINTMENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status.replace(/_/g, ' ')}
          </option>
        ))}
      </SelectField>
      <div className="head__actions" style={{ justifyContent: 'flex-end' }}>
        <Button variant="primary" loading={busy} onClick={() => onPick(choice)}>
          Save status
        </Button>
      </div>
    </div>
  )
}

function emptyTitle(scope: Scope, query: string, status: string, today: string): string {
  if (query) return 'No appointments match that search'
  if (status) return `No ${status.replace(/_/g, ' ').toLowerCase()} appointments`
  if (scope === 'today') return 'No appointments scheduled for today'
  if (scope === 'upcoming') return 'Nothing upcoming'
  if (scope === 'past') return 'No past appointments'
  return `No appointments on ${formatMediumDate(today)}`
}

function emptyText(scope: Scope, query: string, status: string): string {
  if (query) return 'Try a different client, service or staff member.'
  if (status) return 'Clear the status filter to see the rest of the book.'
  if (scope === 'today') return 'New bookings for today will appear here in time order.'
  if (scope === 'upcoming') return 'Booked and confirmed appointments from today onwards show here.'
  return 'Appointments will build up here as the salon operates.'
}
