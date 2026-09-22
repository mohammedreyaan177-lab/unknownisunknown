const adminAuthenticate = (req, res, next) => {
    try{
        if (req.user.role !== 'admin'){
            return res.status(403).json({
                message : "Access denied token"
            })
        }

        next()
    }catch(e){
        return res.status(500).json({
            "message": "Error",
            "error": e.message
        })
    }
}

module.exports ={adminAuthenticate}