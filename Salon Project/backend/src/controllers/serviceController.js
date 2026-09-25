const serviceService = require("../services/serviceService")

//Create Service Controller

const createServiceController =(async(req,res)=>{
    try{
        const {name ,description ,category ,duration_minutes, price, is_active} = req.body
        const service = await serviceService.createService(name,description,category,duration_minutes,price,is_active)
        return res.status(201).json({
            status: "success",
            service: service.service
        })
    }catch(err){
        return res.status(400).json({
            status: "error",
            error: err.message
        })
    }
})

//Get all Services Controller

const getAllServicesController = (async(req,res)=>{
    try{
        const services  = await serviceService.getAllServices()
        return res.status(200).json({
            status: "success",
            services: services
        })
    }catch(err){
        return res.status(400).json({
            status: "error",
            error: err.message
        })
    }
})

//Get a service controller

const getServiceController = (async(req,res)=>{
    try{
        const {id} = req.params
        const service = await serviceService.getService(id)
        return res.status(200).json({
            status: "success",
            service: service
        })
    }catch(err){
        return res.status(400).json({
            status: "error",
            error: err.message
        })
    }
})



//Delete Service Contoller

const deleteServiceController = (async(req,res)=>{
    try {
        const {id} = req.params
        const service = await serviceService.deleteService(id)
        return res.status(200).json({
            status: "success",
            message: service.message
        })
    }catch(err){
        return res.status(400).json({
            status: "error",
            error: err.message
        })
    }
})


//Update Service Controller

const updateServiceController = (async(req,res)=>{
    try{
        const {id} = req.params
        const {name ,description ,category ,duration_minutes, price, is_active} = req.body
        const service = await serviceService.updateService(id,name,description,category ,duration_minutes,price,is_active)
        return res.status(200).json({
            status: "success",
            service: service.service
        })
    }catch(err){
        return res.status(400).json({
            status: "error",
            error: err.message
        })
    }
})
module.exports = {
    createServiceController,
    getAllServicesController,
    getServiceController,
    deleteServiceController,
    updateServiceController

}