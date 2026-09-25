const pool = require("../config/db")

//Create Service service

const createService = async(name ,description ,category ,duration_minutes, price, is_active) =>{
    try{
        const existingService = await pool.query("select * from services where name =$1",[name])
        if(existingService.rows.length > 0 ){
            throw new Error("Service already exists")
        }

        const service = await pool.query("insert into services(name ,description ,category ,duration_minutes, price, is_active) values ($1,$2,$3,$4,$5,$6) returning *",[name, description, category, duration_minutes, price, is_active])
        return{
            service : service.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}


//Get all services

const getAllServices = async() =>{
    try{
        const service = await pool.query("select * from services ")
        if (service.rows.length === 0 ){
            throw new Error("No services found")
        }
        return{
            service : service.rows
        }

    }catch(err){
        return{
            error:err.message
        }
    }
}

//Get a Service

const getService= async(id) =>{
    try{
        const service = await pool.query("select * from services where id =$1",[id])
        if (service.rows.length === 0 ){
            throw new Error("No services found")
        }
        return{
            service : service.rows
        }
    }catch(err){
        return{
            error:err.message
        }
    }
}


//Delete a service

const deleteService = async(id) =>{
    try{
        const existingService = await pool.query("select * from services where id =$1",[id])
        if (existingService.rows.length === 0 ){
            throw new Error("No services found")
        }
        const service = await pool.query("delete from services where id =$1",[id])
        return{
            message : "Service deleted successfully"
        }
    }catch(err){
        throw new Error("Service deleted failure")
    }
}


//Update Service

const updateService = async(id,name ,description ,category ,duration_minutes, price, is_active ) =>{
    try{
        const service = await pool.query("update services set name = $1, description = $2 , category =$3, duration_minutes = $4, price = $5 , is_active = $6 , updated_at = CURRENT_TIMESTAMP where id = $7 returning *",[name , description , category, duration_minutes, price, is_active ,id])
        return{
            service : service.rows
        }

    }catch(err){
        throw new Error(err.message)
    }
}


module.exports = {
    createService,
    getAllServices,
    getService,
    deleteService,
    updateService
}