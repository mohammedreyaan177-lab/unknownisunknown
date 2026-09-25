const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/authMiddleware')
const appointmentController = require('../controllers/appointmentController')

router.post("/", authMiddleware.authenticate , appointmentController.createAppointmentController)
router.get("/", authMiddleware.authenticate , appointmentController.getAllAppointmentsController)
router.get("/:id" , authMiddleware.authenticate , appointmentController.getAppointmentByIdController)
router.delete("/:id" , authMiddleware.authenticate , appointmentController.deleteAppointmentController)
router.put("/:id", authMiddleware.authenticate , appointmentController.updateAppointmentController)

module.exports = router