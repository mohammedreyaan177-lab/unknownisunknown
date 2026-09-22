//Imports
const authService = require("../services/authService")



//Register Controller

const registerController = (async(req,res)=>{
    try{
        const {name , email, password , role} = req.body
        if(!name){
            return res.status(400).json({
                message : "Name is required"
            })
        }
        if(!email){
            return res.status(400).json({
                message : "Email is required"
            })
        }
        if(!password ){
            return res.status(400).json({
                message : "Password is required"
            })
        }
        if(!role){
            return res.status(400).json({
                message : "Role is required"
            })
        }
        const registerService = await authService.register(name, email, password,role)
        return res.status(200).json({
            status: 'success',
            user: registerService
        })
    }catch(err){
        return res.status(400).json({
            status: 'error',
            error: err.message
        })
    }
})


//Login Controller

const loginController = (async(req,res)=>{
    try{
        const {email, password} = req.body
        if(!email){
            return res.status(400).json({
                message : "Email is required"
            })
        }
        if(!password ){
            return res.status(400).json({
                message : "Password is required"
            })
        }
        const loginService = await authService.login(email, password)
        return res.status(200).json({
            status: 'success',
            token: loginService.token
        })
    }catch(err){
        return res.status(400).json({
            status: 'error',
            error: err.message
        })
    }
})

module.exports = {
    registerController,
    loginController
}