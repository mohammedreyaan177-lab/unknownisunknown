//Imports

const bcrypt = require('bcrypt')
const pool = require('../config/db')

//Create Staff in both tables (Admin only Function)

const createStaff = async(name , email , password , phone , specialization) =>{
    const client = await pool.connect()

    try{
        await client.query("BEGIN")

        //Create User First
        const existingUser = await client.query("select * from users where email =$1", [email])
        if(existingUser.rows.length > 0){
            throw new Error("Email already exists")
        }
        const hashedPass = await bcrypt.hash(password , 10)
        const result = await client.query(`INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`, [name, email, hashedPass, "staff"])

        const user = result.rows[0];

        //Create Staff

        const createStaff = await client.query("insert into staff (user_id , phone , specialization) values ($1,$2,$3) returning *",[user.id, phone , specialization])
        await client.query("COMMIT")
        return{
            user :user,
            staff : createStaff.rows[0]
        }
    }catch(err){
        await client.query("ROLLBACK")
        throw new Error(err.message)
    }finally{
        client.release()
    }
}

const getAllStaffs = async() =>{
    try{
        const staff = await pool.query("select * from public.staff")
        return {
            users : staff.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}

const getStaffById = async(id) =>{
    try{
        const getStaff = await pool.query("select * from staff WHERE id = $1", [id])
        return {
            "staff": getStaff.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}


const updateStaffDetails = async (
    staffId,
    name,
    email,
    phone,
    specialization,
    is_active
) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Find staff
        const staffResult = await client.query(
            "SELECT user_id FROM staff WHERE id = $1",
            [staffId]
        );

        if (staffResult.rows.length === 0) {
            throw new Error("No such staff");
        }

        const userId = staffResult.rows[0].user_id;

        // Update users table
        const userResult = await client.query(
            `UPDATE users
             SET
                name = $1,
                email = $2,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, name, email, role`,
            [name, email, userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error("User linked to staff not found");
        }

        // Update staff table
        const staffUpdateResult = await client.query(
            `UPDATE staff
             SET
                phone = $1,
                specialization = $2,
                is_active = $3,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [
                phone,
                specialization,
                is_active,
                staffId
            ]
        );

        if (staffUpdateResult.rows.length === 0) {
            throw new Error("Staff update failed");
        }

        await client.query("COMMIT");

        return {
            user: userResult.rows[0],
            staff: staffUpdateResult.rows[0]
        };

    } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(err.message);

    } finally {
        client.release();
    }
};
module.exports = {
    createStaff,
    getAllStaffs,
    getStaffById,
    updateStaffDetails
}
