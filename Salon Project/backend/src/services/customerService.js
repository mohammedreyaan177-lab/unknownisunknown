const pool = require("../config/db")

//Create Customer

const createCustomer = async(name , phone , email , date_of_birth , notes) =>{
    try{
        const customer = await pool.query("select * from customers where email = $1",[email])
        if(customer.rows.length > 0){
            throw new Error("The customer already exists")
        }

        //Actual customer creation

        const result = await pool.query("insert into customers (name , phone , email , date_of_birth , notes) values ($1,$2,$3,$4,$5) returning *" ,[name , phone , email , date_of_birth , notes])
        const currentUser = result.rows[0]

        return{
            customer  : currentUser
        }
    }catch(err){
    throw new Error(err.message)
    }
}


//Get All customers

const getAllCustomers=async() =>{
    try{
        const customers = await pool.query("select * from customers")
        return{
            customers : customers.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}

//Get Single Customer

const getCustomer = async(id) =>{
    try{
        const customer = await pool.query("select * from customers where id = $1", [id])
        if (customer.rows.length ===0 ){
            return{
                "message":"No customers found"
            }
        }
        return{
            customer  : customer.rows
        }
}catch(err){
        throw new Error(err.message)
    }
}


//Delete Customers

const deleteCustomer = async(id) =>{
    try{
        const customer = await pool.query("delete from customers where id =$1", [id])
        return{
            "message":"User Deleted Successfully"
        }
    }catch(err){
        throw new Error(err.message)
    }
}


//Update Customer Details

const updateCustomer = async(name , phone , email , date_of_birth , notes, id) =>{
    try{
        const customer = await pool.query("update customers set name = $1, phone = $2 , email =$3 , date_of_birth =$4 , notes = $5,updated_at =CURRENT_TIMESTAMP where id = $6 returning *",[name ,phone , email , date_of_birth , notes ,id])
        if (customer.rows.length === 0) {
            return{
                "message":"No customers found"
            }
        }
        return {
            updated_details:customer.rows
        }
    }catch(err){
        throw new Error(err.message)
    }
}
module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomer,
    deleteCustomer,
    updateCustomer
}