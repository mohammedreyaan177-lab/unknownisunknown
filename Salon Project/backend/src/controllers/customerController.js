const customerService = require("../services/customerService")

//Create Customer Controller

const createCustomerController = (async(req,res)=>{
    try{
        const {name , phone , email , date_of_birth , notes} = req.body
        const customer = await customerService.createCustomer(name ,phone , email , date_of_birth , notes)
        return res.status(201).json({
            "message":"success",
            "customer":customer
        })
    }catch(err){
        return res.status(400).json({
            "message":"error",
            "error":err.message
        })
    }
})

//View all customers

const getAllCustomersController = (async(req,res)=>{
    try{
        const customers = await customerService.getAllCustomers()
        return res.status(200).json({
            "message":"success",
            "customer":customers
        })
    }catch(err){
        return res.status(400).json({
            "message":"error",
            "error":err.message
        })
    }
})

//Get Single Customer

const getCustomerController = (async(req,res)=>{
    try{
        const {id} = req.params
        const customer = await customerService.getCustomer(id)
        return res.status(200).json({
            "message":"success",
            "customer":customer
        })

    }catch (err){
        return res.status(400).json({
            "message":"error",
            "error":err.message
        })
    }
})


//Delete customer controller

const deleteCustomerController = (async(req,res)=>{
    try{
        const {id} = req.params
        const customer = await customerService.deleteCustomer(id)
        return res.status(200).json({
            message:customer.message
        })
    }catch(err){
        return res.status(400).json({
            "message":"error",
            "error":err.message
        })
    }
})

//Update Customer Controller

const updateCustomerController = (async(req,res)=>{
    try{
        const {id} = req.params
        const {name , phone , email , date_of_birth , notes} = req.body
        const customer = await customerService.updateCustomer(name , phone ,email , date_of_birth , notes ,id)
        return res.status(200).json({
            message:"success",
            customer:customer.updated_details
        })

    }catch(err){
        return res.status(400).json({
            "message":"error",
            "error":err.message
        })
    }
})
module.exports = {
    createCustomerController,
    getAllCustomersController,
    getCustomerController,
    deleteCustomerController,
    updateCustomerController
}