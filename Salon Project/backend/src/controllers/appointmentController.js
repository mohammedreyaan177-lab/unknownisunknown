const appointmentService = require("../services/appointmentService")

//Create appointment controller

const createAppointmentController = async (req, res) => {
    try{
        const {customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes} = req.body
        if(!customer_id || !staff_id || !service_id || !appointment_date || !start_time ){
            return res.status(400).json({
                message:"Please fill all fields"
            })
        }
        const appointment = await appointmentService.createAppointment(customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes)
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
module.exports = {
    createAppointmentController,
    getAllAppointmentsController,
    getAppointmentByIdController,
    deleteAppointmentController,
    updateAppointmentController
}