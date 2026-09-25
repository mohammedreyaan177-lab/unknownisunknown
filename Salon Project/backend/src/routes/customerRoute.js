const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/authMiddleware')
const customerController = require('../controllers/customerController')

router.post("/", authMiddleware.authenticate, customerController.createCustomerController)
router.get("/", authMiddleware.authenticate , customerController.getAllCustomersController)
router.get("/:id", authMiddleware.authenticate, customerController.getCustomerController)
router.delete("/:id" , authMiddleware.authenticate , customerController.deleteCustomerController)
router.put("/:id", authMiddleware.authenticate, customerController.updateCustomerController)

module.exports = router