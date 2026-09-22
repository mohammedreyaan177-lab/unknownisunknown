//Auth Middleware
const jwt = require("jsonwebtoken")
const authenticate = (async (req,res,next)=>{
    try{
        const authHeader = req.headers.authorization
        if(!authHeader){
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            })
        }
        const token = authHeader.split(' ')[1]
        if(!token){
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            })
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decodedToken
        next()
    }catch(error){
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        })
    }
})

module.exports = {authenticate}