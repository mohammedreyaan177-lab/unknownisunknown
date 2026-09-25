const express = require('express')
const router = express.Router()

const authMiddleware = require("../middleware/authMiddleware")
const serviceController = require("../controllers/serviceController")


router.post("/", authMiddleware.authenticate, serviceController.createServiceController)
router.get("/", authMiddleware.authenticate, serviceController.getAllServicesController)
router.get("/:id", authMiddleware.authenticate, serviceController.getServiceController)
router.delete("/:id", authMiddleware.authenticate , serviceController.deleteServiceController)
router.put("/:id", authMiddleware.authenticate , serviceController.updateServiceController)

module.exports = router