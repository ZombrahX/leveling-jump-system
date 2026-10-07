const express = require('express');
const router = express.Router();
const { register } = require('../controllers/authController');

// Ruta POST para el registro: /api/auth/register
router.post('/register', register);

module.exports = router;