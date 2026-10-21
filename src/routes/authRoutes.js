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
  toggleEstadoStaff
} = require('../controllers/authController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Rutas Públicas de Autenticación (HU-11 / PTLJ-43)
router.post('/registro', registro);
router.post('/verificar', verificarCodigo);
router.post('/reenviar-codigo', reenviarCodigo);
router.post('/login', login);
router.post('/google', loginGoogle);

// Rutas Protegidas (HU-11 / Perfil de Usuario y Staff)
router.get('/perfil', verificarToken, obtenerPerfil);
router.put('/perfil', verificarToken, actualizarPerfil);
router.get('/staff', verificarToken, requerirRol(['SUPERADMIN']), listarStaff);
router.post('/staff', verificarToken, requerirRol(['SUPERADMIN']), crearStaff);
router.patch('/staff/:id/toggle', verificarToken, requerirRol(['SUPERADMIN']), toggleEstadoStaff);

module.exports = router;