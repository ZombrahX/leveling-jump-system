const express = require('express');
const router = express.Router();
const {
  crearReserva,
  crearReservasEnMasa,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva,
  registrarPagoReserva,
  obtenerHistorialPagos,
  consultarSeguimientoPublico,
  actualizarEstadoEntrega
} = require('../controllers/reservaController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Endpoint protegido para que usuarios autenticados reserven una unidad desde el catálogo (HU-06)
router.post('/reservas', verificarToken, crearReserva);

// HU-02 & HU-06: Endpoint atómico autenticado para reservas múltiples desde carrito (evita confirmaciones parciales e inyección de cuentas)
router.post('/reservas/en-masa', verificarToken, crearReservasEnMasa);

// HU-10: Endpoint público para rastrear el pedido por código correlativo (Escenario 1 y 2)
router.get('/reservas/seguimiento/:codigo', consultarSeguimientoPublico);

// Endpoint protegido para que el cliente consulte sus propias reservas
router.get('/reservas/mis-reservas', verificarToken, obtenerMisReservas);

// Endpoints de gestión de reservas protegidos para Staff (SUPERADMIN y ADMIN)
router.get('/reservas', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), obtenerReservas);
router.patch('/reservas/:id/estado', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), actualizarEstadoReserva);

// HU-10: Actualizar modalidad y avance de entrega (Escenario 3)
router.patch(
  '/reservas/:id/entrega',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  actualizarEstadoEntrega
);

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
