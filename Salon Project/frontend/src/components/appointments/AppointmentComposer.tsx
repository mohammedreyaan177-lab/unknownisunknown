import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../../context/AuthContext'
import { useSalonData } from '../../context/SalonDataContext'
import { useSalonNow } from '../../hooks/useSalonClock'
import { appointmentApi } from '../../lib/api'
import {
  BLOCKING_STATUSES,
  fromMinutes,
  minutesOfDay,
  SALON_CLOSE_MINUTES,
  SALON_OPEN_MINUTES,
  toApiTime,
} from '../../lib/format'
import { staffNameOf } from '../../lib/staffName'
import type { Appointment, AppointmentInput, AppointmentStatus, Service } from '../../types'
import { Button } from '../ui/Button'
import { SelectField, TextArea } from '../ui/Field'
import { CheckIcon, AlertIcon } from '../ui/Modal'
import { useToast } from '../ui/Toast'

/**
 * Candidate start times shown as a picker.
 *
 * The backend owns salon opening hours and conflict rules — every slot here is
 * confirmed against POST /appointment/avail before it can be chosen, and
 * re-validated on save. This grid only ever *offers* slots the salon could
 * accept, so the receptionist is not shown a time that will bounce:
 *   - inside opening hours (09:00-20:00), matched to backend/.env
 *   - long enough for the service to finish before closing
 *   - not already elapsed, when booking for today
 * A slot the server still refuses is surfaced by the availability verdict.
 */
const SLOT_STEP_MINUTES = 30

/**
 * The earliest slot that is still ahead of the clock AND leaves room for the
 * whole service before closing, rounded up to the 30-minute grid. Returns null
 * when the salon is closed, or when nothing long enough is left today — in which
 * case the receptionist picks a future date instead.
 */
function nextBookableMinute(now: number, duration: number, date: string, today: string): number | null {
  if (date !== today) {
    return duration > 0 && SALON_OPEN_MINUTES + duration <= SALON_CLOSE_MINUTES ? SALON_OPEN_MINUTES : null
  }
  const earliest = Math.max(Math.ceil(now / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES, SALON_OPEN_MINUTES)
  const last = SALON_CLOSE_MINUTES - duration
  return earliest <= last ? earliest : null
}

interface Verdict {
  state: 'idle' | 'checking' | 'free' | 'busy' | 'error'
  message: string
}

/** The backend's answer for one specific staff/date/time combination. */
interface VerdictResult {
  key: string
  state: 'free' | 'busy' | 'error'
  message: string
}

export function AppointmentComposer({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Appointment
  onSaved: (appointment: Appointment, mode: 'created' | 'updated') => void
  onCancel: () => void
}) {
  const { customers, services, staff, staffRestricted, appointments, upsertAppointment } = useSalonData()
  const toast = useToast()
  // Live salon clock: drives the default date, the earliest bookable slot, and
  // the "already elapsed" filter on today's grid.
  const now = useSalonNow()

  const [customerId, setCustomerId] = useState(() => String(initial?.customer_id ?? ''))
  const [serviceId, setServiceId] = useState(() => String(initial?.service_id ?? ''))
  const [staffId, setStaffId] = useState(() => String(initial?.staff_id ?? ''))
  const [date, setDate] = useState(() => initial?.appointment_date ?? now.today)
  const [startTime, setStartTime] = useState(() => (initial ? initial.start_time.slice(0, 5) : ''))
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [result, setResult] = useState<VerdictResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // The form is a long scrolling column while Confirm sits in the sticky
  // summary, so a rejection has to be brought back into view or the click looks
  // like it did nothing.
  const errorRef = useRef<HTMLDivElement>(null)
  const blockerRef = useRef<HTMLDivElement>(null)

  const service: Service | null = useMemo(
    () => services.find((item) => item.id === Number(serviceId)) ?? null,
    [services, serviceId],
  )

  const staffMember = useMemo(() => staff.find((item) => item.id === Number(staffId)) ?? null, [staff, staffId])

  // End time follows the service duration unless the user typed one.
  const endTime = useMemo(() => {
    if (startTime && service) {
      return fromMinutes(minutesOfDay(startTime) + service.duration_minutes)
    }
    return ''
  }, [startTime, service])

  /**
   * Re-picks a start time whenever the service or date changes, because both
   * decide which times can still fit inside opening hours — a 90-minute service
   * has no room at 19:00, a 45-minute one does. Falls back to clearing the field
   * when nothing today is long enough to book.
   */
  const repickStartTime = useCallback(
    (nextDuration: number, nextDate: string) => {
      const next = nextBookableMinute(now.minutes, nextDuration, nextDate, now.today)
      setStartTime(next === null ? '' : fromMinutes(next))
    },
    [now.minutes, now.today],
  )

  // Existing bookings for this staff member on this date (real API data).
  const dayConflicts = useMemo(() => {
    if (!staffId || !date) return []
    const staffNumber = Number(staffId)
    return appointments.filter(
      (appointment) =>
        appointment.staff_id === staffNumber &&
        appointment.appointment_date === date &&
        appointment.id !== initial?.id &&
        BLOCKING_STATUSES.has(String(appointment.status).toUpperCase()),
    )
  }, [appointments, staffId, date, initial?.id])

  const duration = service?.duration_minutes ?? 0
  const slots = useMemo(() => {
    // Must finish before closing, must start after opening.
    const last = SALON_CLOSE_MINUTES - duration
    const list: number[] = []
    for (let m = SALON_OPEN_MINUTES; m <= last; m += SLOT_STEP_MINUTES) list.push(m)

    // Booking for today: a start time that has already passed can never be
    // accepted by the server, so it is not offered. When editing, the slot the
    // appointment already holds is kept so its own time stays selectable.
    if (date === now.today) {
      const keep = initial ? minutesOfDay(initial.start_time) : -1
      return list.filter((m) => m > now.minutes || m === keep)
    }
    return list
  }, [duration, date, now.today, now.minutes, initial])

  const conflictsWith = useCallback(
    (slotStart: number) => {
      const slotEnd = slotStart + duration
      return dayConflicts.some(
        (appointment) =>
          minutesOfDay(appointment.start_time) < slotEnd && minutesOfDay(appointment.end_time) > slotStart,
      )
    },
    [dayConflicts, duration],
  )

  const canCheck = Boolean(staffId && date && startTime && endTime && duration > 0)

  const queryKey = canCheck ? `${staffId}|${date}|${startTime}|${endTime}` : ''

  // The verdict is derived from the answer that matches the current query, so
  // changing any input shows "checking" without a render pass of its own.
  const verdict: Verdict = useMemo<Verdict>(() => {
    if (!canCheck) return { state: 'idle', message: '' }
    if (!result || result.key !== queryKey) return { state: 'checking', message: 'Checking availability…' }
    return { state: result.state, message: result.message }
  }, [canCheck, queryKey, result])

  // Ask the backend about the chosen slot. Debounced so picking a date or a
  // time does not fire a request per interaction.
  useEffect(() => {
    if (!canCheck) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const response = await appointmentApi.checkAvailability({
          // The customer is sent too: one person cannot be in two chairs at
          // once, and the server warns about that clash before Confirm is pressed.
          customer_id: customerId ? Number(customerId) : undefined,
          staff_id: Number(staffId),
          service_id: serviceId ? Number(serviceId) : undefined,
          appointment_date: date,
          start_time: toApiTime(startTime),
          end_time: toApiTime(endTime),
        })
        if (cancelled) return
        setResult({
          key: queryKey,
          state: response.data ? 'free' : 'busy',
          message: response.message || (response.data ? 'Staff member is available' : 'Staff member is not available'),
        })
      } catch (err) {
        if (cancelled) return
        setResult({
          key: queryKey,
          state: 'error',
          message: errorMessage(err, 'Availability could not be checked.'),
        })
      }
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  // customerId and serviceId are part of the question being asked: the server
  // also refuses a slot when this customer is already booked then, or the
  // service has been retired. Leaving them out meant picking the customer after
  // the time showed a stale "available" verdict.
  }, [canCheck, queryKey, staffId, customerId, serviceId, date, startTime, endTime])

  const chooseSlot = (minutes: number) => {
    setStartTime(fromMinutes(minutes))
    setFormError(null)
  }

  const blockedByConflict = !initial && verdict.state === 'busy'

  // Scroll both copies of the refusal back into view whenever a submit is
  // refused, so the receptionist sees why instead of watching a button do
  // nothing. The summary copy is the one beside the button they actually
  // pressed, so it is brought in last.
  useEffect(() => {
    if (!formError) return
    errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const id = window.setTimeout(
      () => blockerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      350,
    )
    return () => window.clearTimeout(id)
  }, [formError])

  const submit = async () => {
    if (saving) return
    setFormError(null)

    const block = (message: string) => {
      setFormError(message)
      return
    }
    if (!customerId) return block('Choose a customer for this appointment.')
    if (!serviceId) return block('Choose a service.')
    if (!staffId) return block('Choose a staff member.')
    if (!date) return block('Choose a date.')
    if (!startTime || !endTime) return block('Choose a start time.')
    if (minutesOfDay(endTime) <= minutesOfDay(startTime))
      return block('The end time must be after the start time.')
    if (date === now.today && minutesOfDay(startTime) <= now.minutes)
      return block(`It is ${fromMinutes(now.minutes)} now, so ${startTime} has already passed. Choose a later time or another date.`)
    if (minutesOfDay(endTime) > SALON_CLOSE_MINUTES)
      return block(
        `The salon closes at ${fromMinutes(SALON_CLOSE_MINUTES)}. A ${duration} min service starting at ${startTime} would finish at ${endTime}, after closing. Start by ${fromMinutes(SALON_CLOSE_MINUTES - duration)} at the latest.`,
      )
    if (minutesOfDay(startTime) < SALON_OPEN_MINUTES)
      return block(
        `The salon opens at ${fromMinutes(SALON_OPEN_MINUTES)}, so it cannot take a booking at ${startTime}.`,
      )

    setSaving(true)
    try {
      const payload: AppointmentInput = {
        customer_id: Number(customerId),
        staff_id: Number(staffId),
        service_id: Number(serviceId),
        appointment_date: date,
        start_time: toApiTime(startTime),
        end_time: toApiTime(endTime),
        notes: notes.trim(),
      }

      const saved = initial
        ? await appointmentApi.update(initial.id, {
            ...payload,
            status: (String(initial.status).toUpperCase() as AppointmentStatus) || 'BOOKED',
          })
        : await appointmentApi.create(payload)

      upsertAppointment(saved)
      onSaved(saved, initial ? 'updated' : 'created')
      toast.success(
        initial ? 'Appointment updated' : 'Appointment booked',
        initial ? 'The schedule has been refreshed.' : `${payload.start_time.slice(0, 5)} on ${payload.appointment_date}`,
      )
    } catch (err) {
      setFormError(errorMessage(err, 'The appointment could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const noBookableServices = services.filter((item) => item.is_active).length === 0

  return (
    <div className="appt-layout">
      <div className="flow">
        <div ref={errorRef}>
          <FormError message={formError} />
        </div>

        <section className="flow__section">
          <Legend index="01" text="Client" />
          <SelectField
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={saving}
            placeholder="Choose a customer"
            required
          >
            {[...customers]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
          </SelectField>
        </section>

        <section className="flow__section">
          <Legend index="02" text="Service" />
          <SelectField
            label="Service"
            value={serviceId}
            onChange={(e) => {
              const id = e.target.value
              setServiceId(id)
              const picked = services.find((item) => item.id === Number(id))
              repickStartTime(picked?.duration_minutes ?? 0, date)
            }}
            disabled={saving}
            placeholder="Choose a service"
            hint={noBookableServices ? 'No active services are available to book.' : undefined}
            required
          >
            {[...services]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => (
                <option key={item.id} value={item.id} disabled={!item.is_active}>
                  {item.name} · {item.duration_minutes} min{item.is_active ? '' : ' (inactive)'}
                </option>
              ))}
          </SelectField>
        </section>

        <section className="flow__section">
          <Legend index="03" text="Professional" />
          <SelectField
            label="Staff member"
            value={staffId}
onChange={(e) => {
              const id = e.target.value
              setStaffId(id)
              repickStartTime(duration, date)
            }}
            disabled={saving || staffRestricted}
            placeholder={staffRestricted ? 'Admin-only' : 'Choose a staff member'}
            hint={staffRestricted ? 'An admin account is needed to see the team list.' : undefined}
            required
          >
            {[...staff]
              .sort((a, b) => staffNameOf(a).localeCompare(staffNameOf(b)))
              .map((member) => (
                <option key={member.id} value={member.id} disabled={!member.is_active}>
                  {staffNameOf(member)}
                  {member.is_active ? '' : ' (inactive)'}
                </option>
              ))}
          </SelectField>
        </section>

        <section className="flow__section">
          <Legend index="04" text="When" />
          <div className="grid-2">
            <label className="field">
              <span className="field__label">
                Date
                <span className="field__req" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                type="date"
                className="field__control"
                value={date}
                min={now.today}
                onChange={(e) => {
                  const picked = e.target.value
                  setDate(picked)
                  repickStartTime(duration, picked)
                }}
                disabled={saving}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Start time</span>
              <input
                type="time"
                step={300}
                className="field__control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={saving || !service}
              />
            </label>
          </div>

          {duration > 0 && (
            <div className="field">
              <span className="field__label">Available start times</span>
              {slots.length === 0 ? (
                <p className="field__hint">
                  {duration > SALON_CLOSE_MINUTES - SALON_OPEN_MINUTES
                    ? 'This service is longer than the salon day; enter a start time directly and the server will check it.'
                    : `There is not enough of the salon day left for a ${duration} min service. Pick another date, or choose a shorter service.`}
                </p>
              ) : (
                <>
                  <div className="slotgrid" role="group" aria-label="Available start times">
                    {slots.map((minutes) => {
                      const label = fromMinutes(minutes)
                      const busy = conflictsWith(minutes)
                      return (
                        <button
                          key={minutes}
                          type="button"
                          className={`slot ${startTime === label ? 'slot--on' : ''}`}
                          onClick={() => chooseSlot(minutes)}
                          disabled={saving || busy}
                          aria-pressed={startTime === label}
                          title={busy ? 'Already booked' : undefined}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="slot-note">
                    {dayConflicts.length > 0
                      ? `${dayConflicts.length} existing ${dayConflicts.length === 1 ? 'booking' : 'bookings'} for this professional on this date. Struck-through times are taken; the salon server confirms every slot.`
                      : 'The salon server confirms every time you pick.'}
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="flow__section">
          <Legend index="05" text="Notes" />
          <TextArea
            label="Notes for the team"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            placeholder="Hair length, preferences, anything the stylist should know."
          />
        </section>
      </div>

      {/*
        The summary sits after the time picker on purpose: on a stacked layout
        the availability verdict is the last thing read before confirming, so
        it can never be stranded above a submit button.
      */}
      <aside className="summary" aria-label="Appointment summary">
        <h2 className="summary__title">Summary</h2>
        <div className="summary__list">
          <Row label="Customer" value={customers.find((c) => c.id === Number(customerId))?.name ?? '—'} />
          <Row label="Service" value={service ? service.name : '—'} />
          <Row label="Duration" value={duration ? `${duration} min` : '—'} />
          <Row label="Professional" value={staffMember ? staffNameOf(staffMember) : '—'} />
          <Row label="Date" value={date || '—'} />
          <Row label="Time" value={startTime ? `${startTime} – ${endTime}` : '—'} />
        </div>
        <div className="summary__total">
          <span className="summary__key">Price</span>
          <span className="summary__total-value">
            {service ? `₹${Number(service.price).toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        <div className="summary__verdict">
          <AvailabilityVerdict verdict={verdict} blocked={blockedByConflict} />
        </div>
        {/* The same refusal, next to the button that was pressed, so a blocked
            booking is never a silent no-op. */}
        {formError && (
          <div className="summary__blocker" role="alert" ref={blockerRef}>
            <span className="summary__blocker-icon" aria-hidden="true">
              <AlertIcon />
            </span>
            <span>{formError}</span>
          </div>
        )}
        <div className="summary__actions">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {saving ? 'Saving' : initial ? 'Save changes' : 'Confirm booking'}
          </Button>
        </div>
      </aside>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary__row">
      <span className="summary__key">{label}</span>
      <span className="summary__val">{value}</span>
    </div>
  )
}

function Legend({ index, text }: { index: string; text: string }) {
  return (
    <div className="flow__legend">
      <span className="flow__legend-index" aria-hidden="true">
        {index}
      </span>
      <span className="flow__legend-text">{text}</span>
    </div>
  )
}

function AvailabilityVerdict({ verdict, blocked }: { verdict: Verdict; blocked: boolean }) {
  if (verdict.state === 'idle') {
    return (
      <p className="verdict verdict--wait">
        <span className="verdict__icon" aria-hidden="true">
          <AlertIcon />
        </span>
        Pick a professional, date and time to check availability.
      </p>
    )
  }
  if (verdict.state === 'checking') {
    return (
      <p className="verdict verdict--wait" role="status">
        <span className="btn__spin verdict__icon" aria-hidden="true" />
        Checking availability…
      </p>
    )
  }
  if (verdict.state === 'free') {
    return (
      <p className="verdict verdict--ok" role="status">
        <span className="verdict__icon" aria-hidden="true">
          <CheckIcon />
        </span>
        {verdict.message}
      </p>
    )
  }
  if (verdict.state === 'error') {
    return (
      <p className="verdict verdict--no" role="alert">
        <span className="verdict__icon" aria-hidden="true">
          <AlertIcon />
        </span>
        {verdict.message}
      </p>
    )
  }
  return (
    <p className="verdict verdict--no" role="alert">
      <span className="verdict__icon" aria-hidden="true">
        <AlertIcon />
      </span>
      {verdict.message}
      {blocked ? ' Choose another time or professional.' : ''}
    </p>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="alert alert--danger" role="alert">
      <span className="alert__icon" aria-hidden="true">
        <AlertIcon />
      </span>
      <span>{message}</span>
    </div>
  )
}
