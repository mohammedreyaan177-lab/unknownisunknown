//Imports
const authService = require("../services/authService")



//Register Controller

const registerController = (async(req,res)=>{
    try{
        // BACKEND CHANGE: The controller no longer reads `role` from the body.
        // Reason: Any anonymous caller could POST {"role":"admin"} and be granted
        //   admin, because the value flowed unchecked into the INSERT and admin
        //   gates the whole staff module. Reproduced live: an unauthenticated
        //   register with role:"admin" returned 200. A client cannot be trusted
        //   to decide its own privilege, so the field is dropped here and the
        //   service pins the role to 'staff'.
        // Scope: Minimal - drops one destructured field and the "Role is required"
        //   check that only existed because the field was attacker-controlled.
        //   Name/email/password validation and the response shape are unchanged.
        const {name , email, password} = req.body
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
        const registerService = await authService.register(name, email, password)
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