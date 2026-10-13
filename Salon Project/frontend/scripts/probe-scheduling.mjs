/**
 * Scheduling validation probe.
 *
 * Exercises POST /appointment/avail and POST /appointment against the running
 * backend to confirm the overlap rule, salon hours, and time-range validation
 * behave as the booking UI assumes. Read-only apart from appointments it
 * creates on a dedicated far-future date, which it deletes on teardown.
 *
 * Usage: node scripts/probe-scheduling.mjs
 * Requires: backend on :3000, an admin token in PROBE_TOKEN.
 */
import { API, ADMIN_TOKEN, call } from './helpers.mjs'

const results = []
const created = []

function check(name, actual, expected) {
  const pass = actual === expected
  results.push({ name, expected, actual, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n        expected: ${expected}\n        actual:   ${actual}`)
}

async function create(appt, label) {
  const res = await call('POST', '/appointment', {
    customer_id: appt.customer_id,
    staff_id: appt.staff_id,
    service_id: appt.service_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    end_time: appt.end_time,
    notes: label,
  })
  if (res.status === 200) created.push(res.body.appointment[0].id)
  return res
}

/** Availability answers are compared by message, since that is what the UI shows. */
async function avail(appt) {
  const res = await call('POST', '/appointment/avail', appt)
  if (res.status !== 200) return `http_${res.status}:${res.body.error || res.body.message}`
  return res.body.data ? 'available' : 'unavailable'
}

async function main() {
  const D = '2027-03-18' // dedicated date, isolated from any real booking
  const base = { customer_id: 2, staff_id: 5, service_id: 4, appointment_date: D }
  // The backend now also refuses to double-book a CUSTOMER, so any case whose
  // point is "the stylist is free" has to use a different customer, otherwise
  // the customer rule (correctly) fires first and the staff rule is never
  // actually exercised.
  const OTHER_CUSTOMER = 3

  // Seed a 10:00-11:00 booking for staff 5 on D.
  const seed = await create({ ...base, start_time: '10:00:00', end_time: '11:00:00' }, 'PROBE seed')
  check('seed booking created', seed.status, 200)

  console.log('\n--- overlap rule (staff 5) ---')
  check(
    'exact overlap rejected',
    await avail({ ...base, start_time: '10:00:00', end_time: '11:00:00' }),
    'unavailable',
  )
  check(
    'partial overlap (starts before) rejected',
    await avail({ ...base, start_time: '09:30:00', end_time: '10:30:00' }),
    'unavailable',
  )
  check(
    'partial overlap (ends after) rejected',
    await avail({ ...base, start_time: '10:30:00', end_time: '11:30:00' }),
    'unavailable',
  )
  check(
    'inside existing booking rejected',
    await avail({ ...base, start_time: '10:15:00', end_time: '10:45:00' }),
    'unavailable',
  )
  check(
    'surrounding existing booking rejected',
    await avail({ ...base, start_time: '09:00:00', end_time: '12:00:00' }),
    'unavailable',
  )
  check(
    'adjacent before (ends exactly at start) allowed',
    await avail({ ...base, start_time: '09:00:00', end_time: '10:00:00' }),
    'available',
  )
  check(
    'adjacent after (starts exactly at end) allowed',
    await avail({ ...base, start_time: '11:00:00', end_time: '12:00:00' }),
    'available',
  )

  console.log('\n--- different staff / different date ---')
  check(
    'different staff same time allowed',
    // Different stylist AND a different customer: the same customer cannot sit
    // in two chairs at once, so reusing customer 2 here would test the customer
    // rule rather than the stylist rule.
    await avail({ ...base, customer_id: OTHER_CUSTOMER, staff_id: 6, start_time: '10:00:00', end_time: '11:00:00' }),
    'available',
  )
  check(
    'different date same staff allowed',
    await avail({ ...base, appointment_date: '2027-03-19', start_time: '10:00:00', end_time: '11:00:00' }),
    'available',
  )

  console.log('\n--- salon hours (09:00 - 20:00) ---')
  check(
    'before opening rejected',
    await avail({ ...base, start_time: '08:00:00', end_time: '09:00:00' }),
    'http_400:Saloon is Closed in this time.',
  )
  check(
    'starting exactly at open allowed',
    await avail({ ...base, start_time: '09:00:00', end_time: '10:00:00' }),
    'available',
  )
  // SALOON_CLOSE_TIME is 20:00, so "ending exactly at close" means ending at
  // 20:00. This fixture used 20:30, which is half an hour after closing and is
  // correctly rejected — the check could never pass. A different customer so it
  // exercises the closing rule rather than the customer-clash rule.
  const closing = await avail({ ...base, customer_id: OTHER_CUSTOMER, start_time: '19:00:00', end_time: '20:00:00' })
  check('ending exactly at close allowed', closing, 'available')
  check(
    'ending 30 minutes after close rejected',
    await avail({ ...base, customer_id: OTHER_CUSTOMER, start_time: '19:30:00', end_time: '20:30:00' }),
    'http_400:Saloon is Closed in this time.',
  )
  check(
    'ending after close rejected',
    await avail({ ...base, start_time: '19:00:00', end_time: '21:00:00' }),
    'http_400:Saloon is Closed in this time.',
  )

  console.log('\n--- time range ---')
  check(
    'start equal to end rejected',
    await avail({ ...base, start_time: '14:00:00', end_time: '14:00:00' }),
    'http_400:Start time must be before end time',
  )
  check(
    'end before start rejected',
    await avail({ ...base, start_time: '14:00:00', end_time: '13:00:00' }),
    'http_400:Start time must be before end time',
  )

  console.log('\n--- booking actually persists the conflict rule ---')
  // A different customer, so the STYLIST rule is the one under test here.
  const conflict = await create({ ...base, customer_id: OTHER_CUSTOMER, start_time: '10:30:00', end_time: '11:30:00' }, 'PROBE conflict')
  check('conflicting booking rejected on create', conflict.body.error, 'Staff already booked on this time.')

  // And the customer rule itself: same customer, a different stylist, same time.
  const custConflict = await create({ ...base, staff_id: 6, start_time: '10:30:00', end_time: '11:30:00' }, 'PROBE customer conflict')
  check('same customer double-booked rejected', custConflict.body.error, 'Customer already has an appointment at this time.')
  const okBooking = await create({ ...base, start_time: '13:00:00', end_time: '14:00:00' }, 'PROBE ok')
  check('non-conflicting booking accepted', okBooking.status, 200)

  console.log('\n--- cancelled appointment frees the slot ---')
  const cancelledId = created[created.length - 1]
  const upd = await call('PUT', `/appointment/${cancelledId}`, {
    customer_id: 2,
    staff_id: 5,
    service_id: 4,
    appointment_date: D,
    start_time: '13:00:00',
    end_time: '14:00:00',
    status: 'CANCELLED',
    notes: 'PROBE cancelled',
  })
  check('status updated to CANCELLED', upd.status, 200)
  check(
    'cancelled slot no longer blocks',
    await avail({ ...base, start_time: '13:00:00', end_time: '14:00:00' }),
    'available',
  )

  console.log('\n--- update vs other bookings ---')
  const target = created[0]
  const updSelf = await call('PUT', `/appointment/${target}`, {
    customer_id: 2,
    staff_id: 5,
    service_id: 4,
    appointment_date: D,
    start_time: '10:00:00',
    end_time: '11:00:00',
    status: 'BOOKED',
    notes: 'PROBE seed',
  })
  check('updating an appointment onto its own slot is allowed', updSelf.status, 200)

  const otherId = created[1] // the 13:00 booking, still BOOKED at this point
  const updOntoOther = await call('PUT', `/appointment/${otherId}`, {
    customer_id: 2,
    staff_id: 5,
    service_id: 4,
    appointment_date: D,
    start_time: '10:30:00',
    end_time: '11:30:00',
    status: 'BOOKED',
    notes: 'PROBE overlap-attempt',
  })
  check(
    'UPDATE onto an overlapping booking is rejected',
    updOntoOther.status === 400,
    true,
  )
  if (updOntoOther.status !== 400) {
    console.log('        WARNING: the update accepted an overlapping slot.')
  }

  console.log('\n--- teardown ---')
  for (const id of created) await call('DELETE', `/appointment/${id}`)
  const checkGone = await call('GET', '/appointment')
  const remaining = checkGone.body.appointments.appointments.filter((a) => a.notes?.startsWith('PROBE'))
  check('all probe appointments removed', remaining.length, 0)

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('FAILED:')
    for (const f of failed) console.log(`  - ${f.name}: expected ${f.expected}, got ${f.actual}`)
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('probe crashed:', e.message)
  process.exit(2)
})

export { API, ADMIN_TOKEN }