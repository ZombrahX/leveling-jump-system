const express = require('express');
const router = express.Router();
const {
  crearReserva,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva,
  registrarPagoReserva,
  obtenerHistorialPagos
} = require('../controllers/reservaController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Endpoint público para que clientes reserven una unidad desde el catálogo (HU-06)
router.post('/reservas', crearReserva);

// Endpoint protegido para que el cliente consulte sus propias reservas
router.get('/reservas/mis-reservas', verificarToken, obtenerMisReservas);

// Endpoints de gestión de reservas protegidos para Staff (SUPERADMIN y ADMIN)
router.get('/reservas', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), obtenerReservas);
router.patch('/reservas/:id/estado', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), actualizarEstadoReserva);

// HU-09: Endpoints de gestión de adelantos y saldos
router.post(
  '/reservas/:id/pagos',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  registrarPagoReserva
);

router.get(
  '/reservas/:id/pagos',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  obtenerHistorialPagos
);

module.exports = router;
