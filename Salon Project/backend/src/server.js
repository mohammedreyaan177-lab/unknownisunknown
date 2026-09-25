//Express Configuration
require('dotenv').config()
const express = require("express")
const app = express()
const port = process.env.PORT

//App Route Imports
const authRoute = require("./routes/authRoute")
const staffRoute = require("./routes/staffRoute")
const customerRoute = require("./routes/customerRoute")
const serviceRoute = require("./routes/serviceRoute")
const appointmentRoute = require("./routes/appointmentRoute")

//Express app uses
app.use(express.json())
app.use("/auth", authRoute)
app.use("/staff", staffRoute)
app.use("/customer", customerRoute)
app.use("/service",serviceRoute)
app.use("/appointment",appointmentRoute)

app.get("/" ,(req , res) =>{
    res.status(200).json({
        status:"OK",
        message:"Website works fine"
    })
})


app.listen(port, () => {
    console.log("Listening on port " + port)
})