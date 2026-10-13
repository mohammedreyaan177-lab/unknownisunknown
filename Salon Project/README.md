# SHADES 360 — Salon Management Platform

React 19 + TypeScript front end, Express 5 + PostgreSQL back end.

```
frontend/   React 19 + TS + Vite          (port 5173)
backend/    Express 5 + pg                (port 3000)
```

---

## Running it

**Back end** (reads `backend/src/.env` for DB + JWT config):

```bash
cd "Salon Project/backend/src"
npm install
npm start
#   -> Listening on port 3000
```

**Front end** (separate terminal):

```bash
cd "Salon Project/frontend"
npm install
npm run dev
#   -> http://localhost:5173
```

Checks: `npm run typecheck` · `npm run lint` · `npm run build`

---

## Roles

| | staff | admin |
|---|---|---|
| Customers, services, appointments — view/create/edit | ✅ | ✅ |
| Staff list | ❌ 403 | ✅ |
| Create / edit staff | ❌ 403 | ✅ |
| **Book an appointment** | ❌ *blocked in the UI* | ✅ |

A staff account **cannot book anything**, because the composer's stylist dropdown
loads from the admin-only `GET /staff` and shows "Admin-only". See V2 backlog.

### Creating the first admin

Self-registration always creates `staff` — there is deliberately no way to
register as admin over HTTP. Admins are created from the owner's machine:

```
# 1. fill these into backend/src/.env (uncomment them)
ADMIN_NAME=Your Name
ADMIN_EMAIL=you@salon.com
ADMIN_PASSWORD=a-long-unique-password

# 2.
cd "Salon Project/backend/src"
npm run create-admin
```

The script refuses to run once any admin exists. To add another on purpose:
`npm run create-admin -- --force`.

Prefer not to put a password in `.env`? Promote an existing account instead:

```sql
UPDATE users SET role = 'admin' WHERE email = 'the.person@salon.com';
```

---

## Appointment status

Clicking **Status** opens a dialog with a dropdown. It is a **select-then-Save**
— nothing changes until **Save status** is pressed.

| Status | Meaning | Blocks the stylist's slot? |
|---|---|---|
| `BOOKED` | Made, not yet confirmed | yes |
| `CONFIRMED` | Client confirmed they'll come | yes |
| `IN_PROGRESS` | Happening now | yes |
| `COMPLETED` | Done | yes |
| `CANCELLED` | Not happening | **no — frees the slot** |
| `NO_SHOW` | Client didn't turn up | **no — frees the slot** |

The six values are enforced by a database `CHECK` constraint, so an invalid
status such as `PENDING` is rejected with a 400.

### What a status change actually does

It sends the **whole appointment** back, not just the status:

```http
PUT /api/appointment/:id
{"customer_id":2,"staff_id":6,"service_id":47,
 "appointment_date":"2026-10-13","start_time":"19:30:00",
 "end_time":"19:40:00","status":"COMPLETED","notes":""}
```

On the server only the `status` column is written — date, time, customer,
stylist, service and notes are re-saved unchanged. Status and moving a booking
share one code path, which is why the full row travels.

Visible effects, all applied without a page reload:

- the row's status badge changes colour
- `CANCELLED` / `NO_SHOW` drop out of the **Upcoming** filter
- the dashboard's *Appointments today* splits into "done" / "to come"
- the dashboard's *Appointment status* counts shift
- the freed slot becomes bookable again
- other open browsers pick the change up within ~45s (polling)

### What a status change does **not** do

Status is a label only. It does not send anything, and it does not touch money:

- no notification or reminder to the client
- no cancellation email
- no billing, invoice or receipt
- no revenue recorded anywhere

---

## Mobile

The layout is responsive at 1180 / 960 / 720 / 640px. Below 720px the sidebar
becomes a slide-in drawer (hamburger, top-right), data tables restyle as cards,
and filter toolbars stack one control per row.

Interactive targets are **44px minimum on touch screens** (Apple HIG / Material
minimum), enforced by a `@media (pointer: coarse), (max-width: 720px)` block.
The same controls stay compact at their desktop size for mouse users.

---

## Customer history

The **Visits** column on the Customers page is a button. It opens a full history
for that client: every appointment with its date, weekday, time range, service,
stylist, notes, status badge and price — newest first.

Above the list it summarises:

- **Visits** — delivered appointments, excluding cancelled and no-show
- **Total spend** — summed from the service prices, same exclusions
- **Upcoming** — still to come and still blocking the calendar
- **Last visit** and **usual choice** (shown when repeated)

It is derived from data the app already loads (`/appointment`, `/service`,
`/staff`), so opening it makes **no extra request**. A staff-role user, who
cannot read `/staff`, sees `Staff #id` instead of a name.

---

## Booking rules

Enforced on the server; the UI never replaces these checks.

| Rule | Error returned |
|---|---|
| Slot must be inside salon hours | `Saloon is Closed in this time.` |
| Slot must not already have passed | `Appointment time is in the past.` |
| End must be after start | `Start time must be before end time` |
| Stylist must be free | `Staff already booked on this time.` |
| **Customer must be free** (any stylist) | `Customer already has an appointment at this time.` |
| Stylist must be active | `This staff member is not available for bookings.` |
| Service must be active | `This service is not available for bookings.` |
| Customer / stylist / service must exist | foreign-key 400 |

Overlaps are detected for every case: exact, partial from either side, fully
inside, and fully containing. **Back-to-back bookings are allowed** — a 10:00–10:45
booking does not block a 10:45–11:30 one. `CANCELLED` and `NO_SHOW` never block.

Salon hours live in `backend/src/.env`:

```
SALOON_OPEN_TIME=09:00:00
SALOON_CLOSE_TIME=20:00:00
```

Both must be written as `HH:MM:SS`. They are compared as **strings** against
Postgres `time` values, which always arrive in that form — `20:00` and `20.00`
both sort *before* `20:00:00` and would reject a booking ending exactly at close.

---

## Tests

`frontend/scripts/` holds the standing harness. `probe-scheduling.mjs` needs a
running back end and writes only to a dedicated far-future date, which it
deletes on teardown.

```bash
# back end must be running on :3000
cd "Salon Project/frontend"
PROBE_EMAIL=<admin email> PROBE_PASSWORD=<password> node scripts/probe-scheduling.mjs
```

It covers opening and closing boundaries, the overlap matrix, time-range
validation, the staff and customer clash rules, and that a probe-created
booking is really persisted and cleaned up.

---

## V2 backlog

### Security — do these before going live

- [ ] **Rotate `JWT_SECRET`.** It is currently the literal string
      `blabberrandomidiot` — a guessable phrase, and anyone who guesses it can
      forge an admin token. Generate with
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
      **Do not hash it** — JWT needs the original value back to verify
      signatures, so hashing breaks every login.
- [ ] **Rate-limit `/auth/login`.** There is no lockout, so passwords can be
      brute-forced.
- [ ] **Serve over HTTPS.**
- [ ] **Reset `qa.admin@shades360.test`**, a shared test account.

### Booking

- [ ] **Enforce service duration server-side.** `end_time` is whatever the client
      sends, so a 90-minute service can be stored as 10 minutes. Consider a
      `CHECK` or trigger deriving `end_time` from the service.
- [ ] **Single source of truth for salon hours.** They are duplicated in
      `backend/src/.env` *and* `frontend/src/lib/format.ts`, and they already
      drifted once (the `20.00` bug). A read-only `GET /appointment/hours` would
      remove the duplication.
- [ ] **Customer deactivate.** `customers` has no `is_active` column, so the only
      removal is a hard delete.
- [ ] **DELETE endpoint for staff.** Deactivate-only today.

### Staff

- [ ] **Let the staff role book.** `GET /staff` is admin-only, which starves the
      booking composer of its stylist list. Consider a lighter endpoint that any
      signed-in user can read.
- [ ] **Staff information edit.** `PUT /staff/:id` requires the full record to be
      resent; a partial update is rejected rather than merged.

### Customers

- [ ] **Deleting a customer destroys their booking history.** `appointments.customer_id`
      is `ON DELETE CASCADE`, so `DELETE /customer/:id` removes every appointment
      that customer ever had and still answers `200 "User Deleted Successfully"`.
      The UI now states the count before you confirm, but there is no way to keep
      the history and drop only the customer — that needs either a soft-delete
      column or an explicit "delete and keep history" decision.
      **Decide this deliberately: in many jurisdictions appointment records must be
      retained even after a client asks to be removed.**
- [ ] **Customer 6 (`Nilowfa`) stores `email = ''`.** Harmless now that the client
      sends `null` for a blank email, but any API client sending `""` would still
      collide on the duplicate-email check.

### Platform

- [ ] **Cross-user live updates are polling, not push.** There is no WebSocket or
      SSE in the back end. Visibility-aware polling every 45s is the current
      approach; real-time would need a transport added.
- [ ] **Status automation** — client notifications on confirm/cancel, reminder
      emails, and any billing integration. See the status section above.
- [ ] **Dashboard revenue.** Appointment value is deliberately *not* labelled
      collected revenue anywhere; there is no payment capture.