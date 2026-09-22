const express = require('express')
const authController = require('../controllers/authController')
const router = express.Router()


router.post('/register', authController.registerController)
router.post('/login',authController.loginController )

module.exports = router