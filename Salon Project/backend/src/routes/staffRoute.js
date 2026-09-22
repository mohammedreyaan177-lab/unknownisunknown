const express = require("express")
const router = express.Router()
const authMiddleware = require("../middleware/authMiddleware")
const adminMiddleware = require("../middleware/adminMiddleware")
const staffController = require("../controllers/staffController")
const {getAllStaffsController} = require("../controllers/staffController");
router.post("/",authMiddleware.authenticate, adminMiddleware.adminAuthenticate ,staffController.createStaffController)
router.get("/", authMiddleware.authenticate, adminMiddleware.adminAuthenticate ,staffController.getAllStaffsController)
router.get("/:id",authMiddleware.authenticate, adminMiddleware.adminAuthenticate, staffController.getStaffByIdController)
router.put("/:id", authMiddleware.authenticate, adminMiddleware.adminAuthenticate, staffController.updateStaffController)
module.exports = router