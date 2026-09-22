//Imports
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')
require('dotenv').config()




//Register Service

const register = async(name , email , password , role ) =>{
    try{
        const existingUser = await pool.query("select * from users where email = $1",[email])
        if(existingUser.rows.length > 0){
            throw new Error(`User already exists in the database`)
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query("insert into users(name , email ,password , role) values ($1,$2,$3,$4)", [name , email , hashedPassword , role ])
        return result.rows[0]
    }catch(err){
        throw new Error(err.message)
    }
}

//Login Service

const login = async(email , password) =>{
    try{
        const existingUser = await pool.query("select * from users where email = $1",[email])
        if(existingUser.rows.length ===0){
            throw new Error(`User doesn't exist in the database`)
        }

        const match = await bcrypt.compare(password, existingUser.rows[0].password)
        if(!match){
            throw new Error('Invalid password or email')
        }

        const user = existingUser.rows[0];

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return {
            user:{
                id : existingUser.rows[0].id,
                email : existingUser.rows[0].email,
                role : existingUser.rows[0].role
            },
            token : token
        }
    }catch(err){
        throw new Error(err.message)
    }
}


module.exports = {
    login,
    register
}