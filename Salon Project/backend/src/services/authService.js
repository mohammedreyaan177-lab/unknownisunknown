//Imports
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')
require('dotenv').config()




//Register Service

// BACKEND CHANGE: Self-registration can no longer choose its own role.
// Reason: `register` previously inserted whatever `role` the caller put in the
//   request body, and POST /auth/register requires no authentication. Any
//   anonymous caller could therefore create themselves an admin and take the
//   whole salon (staff records are admin-only). Reproduced against the running
//   API with no credentials:
//     POST /auth/register {"name":"X","email":"x@t.local","password":"p","role":"admin"}
//       -> 200, and the new account could then call GET /staff (admin-only).
//   The role is a privilege decision, not user-supplied data, so it must not be
//   readable from the request. Admin accounts are now created out-of-band by the
//   owner through `npm run create-admin` (backend/src/scripts/createAdmin.js),
//   which reads from the environment and has no HTTP surface.
// Scope: Minimal - the `role` parameter is removed and the value is pinned to
//   'staff'. Registration still works exactly as before for staff accounts; login,
//   JWT issuing and every other auth path are untouched.
const register = async(name , email , password ) =>{
    try{
        const existingUser = await pool.query("select * from users where email = $1",[email])
        if(existingUser.rows.length > 0){
            throw new Error(`User already exists in the database`)
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query("insert into users(name , email ,password , role) values ($1,$2,$3,'staff') returning id, name, email, role", [name , email , hashedPassword ])
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