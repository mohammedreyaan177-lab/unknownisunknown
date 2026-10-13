const pool = require("../config/db")

//Create Customer

// BACKEND CHANGE: Reject a blank or whitespace-only name/phone on create and update.
// Reason: `customers.name` and `customers.phone` are NOT NULL, but an empty string
//   is not null, so the database stored junk. Reproduced against the running API:
//     POST /customer {name:"",   phone:"95000001"} -> 201, row saved with name=""
//     POST /customer {name:"   ", phone:"95000002"} -> 201, row saved with name="   "
//   The phone case repeated the email defect exactly: the first blank-phone customer
//   saved, and the second was refused by the UNIQUE index with a raw driver message
//   the UI cannot explain -
//     "duplicate key value violates unique constraint \"customers_phone_key\""
//   The form marks these fields required and validates them, but the endpoint is
//   directly callable, so the server must hold the rule.
// Scope: Minimal - guard clauses in the two write paths. No schema change, no new
//   endpoint, and every genuine value continues to work unchanged.
const createCustomer = async(name , phone , email , date_of_birth , notes) =>{
    try{
        if(!name || !String(name).trim()){
            throw new Error("Customer name is required.")
        }
        if(!phone || !String(phone).trim()){
            throw new Error("Phone number is required.")
        }
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
        if(!name || !String(name).trim()){
            throw new Error("Customer name is required.")
        }
        if(!phone || !String(phone).trim()){
            throw new Error("Phone number is required.")
        }
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