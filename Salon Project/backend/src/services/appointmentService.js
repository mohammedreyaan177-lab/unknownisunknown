const pool = require("../config/db")

//Create an appointment

const createAppointment = async(customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes) =>{
    try{
        const appointment = await pool.query("insert into appointments (customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning * ", [customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes])
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


//Delete Appointment by id

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
        const appointment = await pool.query("update appointments set customer_id = $1, staff_id=$2, service_id=$3, appointment_date=$4 , start_time=$5 , end_time=$6 , status=$7 , notes=$8) where id=$9",[customer_id , staff_id , service_id , appointment_date , start_time , end_time , status , notes, id])
        return{
            appointment:appointment.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}
module.exports = {
    createAppointment,
    getAllAppointments,
    getAppointmentById,
    deleteAppointment,
    updateAppointment
}