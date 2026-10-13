require('dotenv').config()
const pool = require("../config/db")
const saloonOpenTime = process.env.SALOON_OPEN_TIME
const saloonCloseTime = process.env.SALOON_CLOSE_TIME


// BACKEND CHANGE: Added a shared guard that refuses a slot whose start time has
// already passed.
// Reason: Every path validated salon hours and staff conflicts, but none of them
//   compared the requested moment against the current time, so a receptionist
//   could book a stylist for a slot that had already elapsed. Reproduced against
//   the running API at 18:18 IST on 2026-10-13:
//     POST /appointment/avail  {date:"2026-10-13", start:"17:00:00"} -> 200 data:true
//                              ("Staff member is available")
//     POST /appointment       {date:"2026-10-13", start:"17:00:00"} -> 200 CREATED
//     POST /appointment       {date:"2026-10-12", ...} (yesterday)    -> 200 CREATED
//   The comparison is done in SQL so it uses the database clock. Postgres runs
//   with TimeZone=Asia/Calcutta, so `current_date + current_time` is the salon's
//   clock, not the web server's or the visitor's - the booking rules therefore
//   cannot drift with where the request came from. A client cannot be trusted to
//   police its own clock, and the composer only *warns* via /avail.
// Scope: Minimal - one small query helper plus one call in each of the three
//   appointment write/validation paths. No schema change, no new endpoint.
const assertSlotIsBookable = async(appointment_date , start_time)=>{
    const past = await pool.query(
        "select ($1::date + $2::time) <= (current_date + current_time) as elapsed",
        [appointment_date , start_time]
    )
    if (past.rows[0].elapsed){
        throw new Error("Appointment time is in the past.")
    }
}

// BACKEND CHANGE: Added shared guards for (a) double-booking a CUSTOMER and
// (b) booking a deactivated stylist or retired service.
// Reason: The only conflict rule was "this staff member is busy". A customer is
//   one person and cannot sit in two chairs at once, but nothing checked that.
//   Reproduced against the running API with an adversarial suite:
//     customer A already booked 10:00-10:45 with stylist 1
//     POST /appointment {customer:A, staff:stylist 2, 10:00-10:45} -> 200 CREATED
//     POST /appointment {customer:A, staff:stylist 2, 10:30-11:15} -> 200 CREATED
//   So the same client was booked twice concurrently. Two related gaps surfaced
//   in the same run:
//     POST /appointment {staff: <is_active = false>}      -> 200 CREATED
//     POST /appointment {service: <is_active = false>}    -> 200 CREATED
//   `is_active` exists on staff and services precisely to retire them from the
//   book, but only the React dropdown honoured it; the API did not. The UI is
//   not the fix here - these endpoints are directly callable.
// Scope: Minimal - one reusable helper used by the three appointment paths.
//   The staff-conflict rule, error texts for it, the closing/past checks, the
//   response shape and the schema are all unchanged. "customer_id = $5"
//   excludes the appointment being edited so it can still be re-saved onto its
//   own slot, mirroring the existing `id <> $5` on the staff rule.
const assertBookable = async(customer_id , staff_id , service_id , appointment_date , start_time , end_time , id)=>{
    const customerClash = await pool.query(
        "select id from appointments where customer_id = $1 and appointment_date = $2 and start_time < $4 and end_time > $3 and status not in ('CANCELLED', 'NO_SHOW') and id <> $5",
        [customer_id , appointment_date , start_time , end_time , id ?? -1]
    )
    if (customerClash.rows.length > 0){
        throw new Error("Customer already has an appointment at this time.")
    }

    const staffCheck = await pool.query("select is_active from staff where id = $1", [staff_id])
    if (staffCheck.rows.length === 0){
        throw new Error("Staff not found with that id")
    }
    if (staffCheck.rows[0].is_active !== true){
        throw new Error("This staff member is not available for bookings.")
    }

    const serviceCheck = await pool.query("select is_active from services where id = $1", [service_id])
    if (serviceCheck.rows.length === 0){
        throw new Error("Service not found with that id")
    }
    if (serviceCheck.rows[0].is_active !== true){
        throw new Error("This service is not available for bookings.")
    }
}

//Create an appointment

const createAppointment = async(customer_id , staff_id , service_id , appointment_date , start_time , end_time ,  notes) =>{
    try{

        if (start_time < saloonOpenTime || end_time > saloonCloseTime){
            throw new Error("Saloon is Closed in this time.")
        }
        await assertSlotIsBookable(appointment_date , start_time)
        await assertBookable(customer_id , staff_id , service_id , appointment_date , start_time , end_time)
        const overlapQuery = await pool.query("select id from appointments where staff_id = $1 and appointment_date = $2 and start_time < $4 and end_time >$3 and status not in ('CANCELLED', 'NO_SHOW')", [staff_id, appointment_date, start_time , end_time])
        if (overlapQuery.rows.length > 0 ){
            throw new Error("Staff already booked on this time.")
        }
        const appointment = await pool.query("insert into appointments (customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning * ", [customer_id , staff_id , service_id , appointment_date , start_time , end_time , "BOOKED" ,notes])
        return{
            appointment:appointment.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}

//Get all Appointments

const getAllAppointments = async() =>{
    try{
        const appointment = await pool.query("select * from appointments")
        return {
            appointments : appointment.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}

//Get appointment by id

const getAppointmentById = async(id) =>{
    try{
        const existingAppointment = await pool.query("select * from appointments where id=$1",[id])
        if(existingAppointment.rows.length === 0){
            throw new Error("Appointment not found with id "+id)
        }
        return {
            appointment : existingAppointment.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}


// BACKEND CHANGE: Restored the deleted `deleteAppointment` service function.
// Reason: The DELETE /appointment/:id route (routes/appointmentRoute.js) and
//   `deleteAppointmentController` (controllers/appointmentController.js) both
//   still call `appointmentService.deleteAppointment`, but an earlier working-tree
//   edit replaced that function with `checkAvailability` and dropped it from
//   `module.exports`. Every delete therefore failed at runtime with
//   "appointmentService.deleteAppointment is not a function" (HTTP 400), and the
//   appointment row was left in place. Reproduced against the running API:
//     DELETE /appointment/24 -> 400 {"error":"appointmentService.deleteAppointment is not a function"}
//     GET    /appointment/24 -> 200 (still present)
//   This is not a frontend-reachable problem: the route is unreachable from any
//   client once the handler throws, so no request shape could avoid it.
// Scope: Minimal - re-adds the function exactly as committed at HEAD (a
//   404-style guard plus a DELETE) and re-exports it. No other behaviour,
//   validation, response shape or schema is touched.
const deleteAppointment = async(id) =>{
    try{
        const existingAppointment = await pool.query("select * from appointments where id = $1",[id])
        if(existingAppointment.rows.length === 0){
            throw new Error("Appointment not found with id "+id)
        }

        const appointment = await pool.query("delete from appointments where id = $1", [id])
        return{
            message : "Appointment deleted"
        }
    }catch(err){
        throw new Error(err.message)
    }
}

//Update Appointment Controller
const updateAppointment = async(customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes ,id) =>{
    try{
        if (start_time < saloonOpenTime || end_time > saloonCloseTime){
            throw new Error("Saloon is Closed in this time.")
        }
        // BACKEND CHANGE: the "was this booking moved?" test is now done in SQL.
        // Reason: it was previously computed in JS with
        //     String(row.appointment_date).slice(0,10) !== String(appointment_date).slice(0,10)
        // but the pg driver returns a `date` column as a JS Date, so
        // String(row.appointment_date) is "Mon Oct 13 2026 00:00:00 GMT+0530 ..."
        // and the comparison was ALWAYS unequal. Every update was therefore treated
        // as a move and ran the elapsed-slot check. Reproduced live while marking a
        // booking COMPLETED:
        //     PUT /appointment/100 {appointment_date:"2026-10-13",
        //       start_time:"19:30:00", status:"COMPLETED"}  (clock 20:03)
        //       -> 400 "Appointment time is in the past."
        // So a receptionist could not mark today's appointment COMPLETED,
        // NO_SHOW or CANCELLED once it had started - the exact thing the status
        // button exists for. Comparing inside Postgres avoids the driver's date
        // conversion entirely and is exact for both date and time.
        // Scope: Minimal - the SELECT now returns a precomputed boolean. The
        //   existing_row fetch is kept because the status default below reads it.
        const existingRow = await pool.query(
            `select appointment_date, start_time, status,
                    (appointment_date <> $2::date or start_time <> $3::time) as moved
             from appointments where id = $1`,
            [id , appointment_date , start_time]
        )
        const movedSlot = existingRow.rows.length === 0 || existingRow.rows[0].moved === true
        if (movedSlot){
            await assertSlotIsBookable(appointment_date , start_time)
        }
        // Same customer / inactive-record guards as create, plus the status default.
        // BACKEND CHANGE: an update that omits `status` keeps the row's current
        // status instead of writing NULL.
        // Reason: `updateAppointment` wrote `status = $7` straight from the
        //   request body, and `appointments.status` is NOT NULL. A partial PUT
        //   therefore failed with a raw driver error:
        //     PUT /appointment/:id {customer_id, staff_id, service_id,
        //       appointment_date, start_time, end_time} (no status)
        //       -> 400 null value in column "status" ... violates not-null constraint
        //   The salon UI always sends a status, so this was invisible there, but
        //   any other client doing a field-level edit got a crash instead of a
        //   working update. Defaulting to the stored value is also what "update
        //   these fields" means.
        // Scope: Minimal - one fallback expression in the argument list.
        const nextStatus = status || existingRow.rows[0]?.status || 'BOOKED'
        await assertBookable(customer_id , staff_id , service_id , appointment_date , start_time , end_time , id)
        // BACKEND CHANGE: Reject an update that lands on a slot the same staff
        // member already has.
        // Reason: `createAppointment` has always run this overlap check, but
        //   `updateAppointment` never did, so moving an existing appointment with
        //   PUT /appointment/:id silently double-booked the stylist. Reproduced
        //   against the running API: a BOOKED 16:00-16:45 booking was moved to
        //   10:00-10:45, which another booking already occupied, and the server
        //   answered 200. The repository's own probe (frontend/scripts/
        //   probe-scheduling.mjs) asserts this case is rejected and prints
        //   "WARNING: the update accepted an overlapping slot" otherwise.
        //   The UI cannot be the fix: the endpoint is directly callable, and the
        //   frontend composer only *warns* via POST /appointment/avail, which is
        //   advisory and does not block the save.
        // Scope: Minimal - the same predicate and the same error text as
        //   createAppointment, plus `and id <> $5` so an appointment can still be
        //   re-saved onto its own slot. No new endpoint, no schema change.
        const overlapOnUpdate = await pool.query("select id from appointments where staff_id = $1 and appointment_date = $2 and start_time < $4 and end_time > $3 and status not in ('CANCELLED', 'NO_SHOW') and id <> $5", [staff_id, appointment_date, start_time , end_time, id])
        if (overlapOnUpdate.rows.length > 0 ){
            throw new Error("Staff already booked on this time.")
        }
        const appointment = await pool.query("update appointments set customer_id = $1, staff_id=$2, service_id=$3, appointment_date=$4 , start_time=$5 , end_time=$6 , status=$7 , notes=$8 where id=$9 returning *",[customer_id , staff_id , service_id , appointment_date , start_time , end_time , nextStatus , notes, id])
        if (appointment.rows.length === 0 ){
               throw new Error( "The Appointment with this id does not exist")
        }
        return{
            appointment:appointment.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}


//Check Availability


// BACKEND CHANGE: The advisory availability check now also reports customer
// clashes and retired stylist/service records.
// Reason: `checkAvailability` only asked "is this stylist free?". Two further
//   reasons a slot cannot be booked went unreported, so the composer showed
//   "Staff member is available" and the receptionist only discovered the clash
//   after pressing Confirm:
//     - the customer already had a booking at that time (any stylist)
//     - the stylist or the service had been retired (is_active = false)
//   Both are now surfaced here.
// Scope: Minimal - extra lookups inside the existing function. A slot that
//   cannot be booked still answers 200 with `data:false` and an explanatory
//   `message`, exactly as a staff conflict always has; only malformed requests
//   (bad hours, elapsed slot, end <= start, unknown ids) remain 400. The
//   response shape is unchanged, so existing clients keep working.
const checkAvailability = async(customer_id , staff_id , service_id , appointment_date , start_time , end_time) =>{
    try{
        if (start_time < saloonOpenTime || end_time > saloonCloseTime){
            throw new Error("Saloon is Closed in this time.")
        }
        await assertSlotIsBookable(appointment_date , start_time)
        const verifyStaff = await pool.query("select is_active from staff where id = $1", [staff_id])
        if (verifyStaff.rows.length === 0 ){
            throw new Error("Staff not found with that id")
        }
        if (verifyStaff.rows[0].is_active !== true){
            return { available : false , message : "This staff member is not available for bookings." }
        }
        if (start_time >= end_time){
            throw new Error("Start time must be before end time")
        }

        if (service_id !== undefined && service_id !== null && service_id !== '') {
            const verifyService = await pool.query("select is_active from services where id = $1", [service_id])
            if (verifyService.rows.length === 0 ){
                throw new Error("Service not found with that id")
            }
            if (verifyService.rows[0].is_active !== true){
                return { available : false , message : "This service is not available for bookings." }
            }
        }

        if (customer_id !== undefined && customer_id !== null && customer_id !== '') {
            const customerClash = await pool.query(
                "select id from appointments where customer_id = $1 and appointment_date = $2 and start_time < $4 and end_time > $3 and status not in ('CANCELLED', 'NO_SHOW')",
                [customer_id , appointment_date , start_time , end_time]
            )
            if (customerClash.rows.length > 0){
                return { available : false , message : "This customer already has an appointment at this time." }
            }
        }

        const availability = await pool.query("select id from appointments where staff_id = $1 and appointment_date = $2 and start_time < $4 and end_time > $3 and status not in ('CANCELLED', 'NO_SHOW')", [staff_id, appointment_date, start_time, end_time])
        if (availability.rows.length >0 ){
            return {
                available : false,
                message : "Staff member not available during this time."
            }
        }

        return {
            available : true,
            message : "Staff member is available"

        }
    }catch(err){
        throw new Error(err.message)
    }
}

//Get The appointments of specific staffs


module.exports = {
    createAppointment,
    getAllAppointments,
    getAppointmentById,
    deleteAppointment,
    updateAppointment,
    checkAvailability
}