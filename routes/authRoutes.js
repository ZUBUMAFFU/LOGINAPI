const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const validateRegistro =  require('../middlewares/validateRegistro')

router.post('/register',validateRegistro, authController.register)
router.post('/login',authController.login)
router.post('/logout', authController.logout)
router.post('/token', authController.renovarToken)
module.exports = router