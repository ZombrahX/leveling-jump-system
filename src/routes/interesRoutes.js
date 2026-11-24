const express = require('express');
const router = express.Router();
const {
  registrarInteres,
  listarResumenIntereses,
  actualizarEstadoInteres
} = require('../controllers/interesController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Endpoint autenticado: Cliente se anota en lista de espera / notificarme (HU-08)
router.post('/intereses', verificarToken, registrarInteres);

// Endpoint protegido para Staff: Consultar demanda y waitlist para reposición
router.get('/intereses', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), listarResumenIntereses);

// Endpoint protegido para Staff: Actualizar estado de notificación al cliente
router.patch('/intereses/:id/estado', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), actualizarEstadoInteres);

module.exports = router;
