const staffService = require("../services/staffService")
const createStaffController = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            specialization
        } = req.body;

        if (!name || !email || !password || !phone || !specialization) {
            return res.status(400).json({
                success: false,
                message: "Please enter all credentials"
            });
        }

        const result = await staffService.createStaff(
            name,
            email,
            password,
            phone,
            specialization
        );

        return res.status(201).json({
            success: true,
            message: "Staff Created Successfully",
            result: result
        });

    } catch (err) {
        return res.status(400).json({
            success: false,
            message: "Staff Created Failed",
            result: err.message
        });
    }
};

const getAllStaffsController = async (req, res) => {
    try{
        const getAllStaffs = await staffService.getAllStaffs()
        return res.status(200).json(getAllStaffs);
    }catch(err){
        return res.status(400).json({
            success: false,
            message: "Staff List Failed",
        })
    }
}

const getStaffByIdController = async (req, res) => {
    try{
        const {id} = req.params
        if(!id){
            return res.status(404).json({
                success: false,
                message:"No ID Provided"
            })
        }
        const getStaffById = await staffService.getStaffById(id)
        return res.status(200).json(getStaffById)
    }catch(err){
        return res.status(400).json({
            success: false,
            message: "Staff List Failed",
        })
    }
}


const updateStaffController = async (req, res) => {
    try{
        const {id} = req.params
        const {name, email, phone , specialization, is_active} = req.body
        if(!id){
            return res.status(404).json({
                success: false,
                message:"No ID Provided"
            })
        }

        const updateStaff = await staffService.updateStaffDetails(id , name, email, phone, specialization,is_active)
        return res.status(200).json({
            success: true,
            message: "Staff Updated Successfully",
            result: updateStaff
        })
    }catch(err){
        return res.status(400).json({
            success: false,
            message: "Staff Updated Failed",
            error:err.message
        })
    }
}
module.exports = {
    createStaffController,
    getAllStaffsController,
    getStaffByIdController,
    updateStaffController
};