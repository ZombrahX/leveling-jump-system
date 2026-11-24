const express = require('express');
const router = express.Router();
const {
  registro,
  verificarCodigo,
  reenviarCodigo,
  login,
  loginGoogle,
  obtenerPerfil,
  actualizarPerfil,
  crearStaff,
  listarStaff,
  toggleEstadoStaff,
  buscarUsuarioPorEmail,
  asignarRolStaff
} = require('../controllers/authController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');
const { createRateLimiter } = require('../middlewares/securityMiddleware');

// Limitadores de tasa por IP contra fuerza bruta en login/OTP y abuso de envío de correos
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Demasiados intentos de autenticación desde esta dirección IP. Por favor intenta de nuevo en unos minutos.'
});

const otpResendLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Has superado el límite de reenvíos de código. Por favor revisa tu bandeja de Spam o espera unos minutos.'
});

// Rutas Públicas de Autenticación (HU-11 / PTLJ-43) protegidas con Rate Limiting
router.post('/registro', authLimiter, registro);
router.post('/verificar', authLimiter, verificarCodigo);
router.post('/reenviar-codigo', otpResendLimiter, reenviarCodigo);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, loginGoogle);

// Rutas Protegidas (HU-11 / Perfil de Usuario y Staff)
router.get('/perfil', verificarToken, obtenerPerfil);
router.put('/perfil', verificarToken, actualizarPerfil);
router.get('/usuarios/buscar', verificarToken, requerirRol(['SUPERADMIN']), buscarUsuarioPorEmail);
router.get('/staff', verificarToken, requerirRol(['SUPERADMIN']), listarStaff);
router.post('/staff', verificarToken, requerirRol(['SUPERADMIN']), crearStaff);
router.put('/staff/:id/rol', verificarToken, requerirRol(['SUPERADMIN']), asignarRolStaff);
router.patch('/staff/:id/toggle', verificarToken, requerirRol(['SUPERADMIN']), toggleEstadoStaff);

module.exports = router;
