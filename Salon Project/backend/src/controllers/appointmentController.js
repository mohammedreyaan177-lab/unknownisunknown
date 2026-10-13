const appointmentService = require("../services/appointmentService")
const {checkAvailability} = require("../services/appointmentService");


//Create appointment controller

const createAppointmentController = async (req, res) => {
    try{
        const {customer_id , staff_id , service_id , appointment_date , start_time , end_time , notes} = req.body
        if(!customer_id || !staff_id || !service_id || !appointment_date || !start_time ){
            return res.status(400).json({
                message:"Please fill all fields"
            })
        }
        const appointment = await appointmentService.createAppointment(customer_id , staff_id , service_id , appointment_date , start_time , end_time , notes)
        return res.status(200).json({
            status: "success",
            appointment : appointment.appointment
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
}


//Get All Appointments Controller

const getAllAppointmentsController= async (req, res) => {
    try{
        const appointments = await appointmentService.getAllAppointments()
        return res.status(200).json({
            status: "success",
            appointments : appointments
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
}

//Get an appointment controller

const getAppointmentByIdController = async (req, res) => {
    try{
        const {id} = req.params
        const appointment = await appointmentService.getAppointmentById(id)
        return res.status(200).json({
            status: "success",
            appointment : appointment
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
}

//Delete appointment controller

const deleteAppointmentController = async (req, res) => {
    try{
        const {id} = req.params
        const appointment = await appointmentService.deleteAppointment(id)
        return res.status(200).json({
            status: "success",
            appointment : appointment.message
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
}

//Update appointment Controller

const updateAppointmentController = async (req, res) => {
    try{
        const {id} = req.params
        const {customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes} = req.body
        const appointment = await appointmentService.updateAppointment(customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes,id)
        return res.status(200).json({
            status: "success",
            appointment : appointment.appointment
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
}


//Check Availability controller

const checkAvailabilityController = (async(req , res) =>{
    try{
        // BACKEND CHANGE: forward customer_id and service_id to checkAvailability.
        // Reason: the availability check answers "can this slot be booked?", which
        //   depends on the whole appointment, not just the stylist. Without these
        //   two fields the endpoint was blind to two ways a slot is still unusable:
        //   the customer already having a booking then, and the stylist or service
        //   being retired. The composer asks before every save, so this is where a
        //   clash is flagged early rather than only at submit time.
        // Scope: Minimal - two extra destructured fields and two extra arguments.
        //   The response shape ({status, data, message}) is unchanged.
        const {customer_id , staff_id , service_id , appointment_date , start_time , end_time} = req.body
        const availability = await checkAvailability(customer_id , staff_id , service_id , appointment_date , start_time , end_time)
        return res.status(200).json({
            status: "success",
            data : availability.available,
            message : availability.message
        })
    }catch(err){
        return res.status(400).json({
            message:"Something went wrong",
            error:err.message
        })
    }
})
module.exports = {
    createAppointmentController,
    getAllAppointmentsController,
    getAppointmentByIdController,
    deleteAppointmentController,
    updateAppointmentController,
    checkAvailabilityController
}