const express = require('express');
const router = express.Router();
const {
  crearCotizacion,
  obtenerCotizacionPorCodigo,
  obtenerMisCotizaciones,
  listarCotizaciones,
  confirmarORecalcularCotizacion,
  eliminarCotizacion
} = require('../controllers/cotizacionController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// HU-07: Endpoint para generar una cotización formal (sin reservar stock)
router.post('/cotizaciones', crearCotizacion);

// Endpoint protegido para que el cliente autenticado consulte todas sus cotizaciones
router.get('/cotizaciones/mis-cotizaciones', verificarToken, obtenerMisCotizaciones);

// HU-07: Consultar una cotización específica por su código correlativo (COT-2026-XXXX)
router.get('/cotizaciones/:codigo', obtenerCotizacionPorCodigo);

// HU-07 Escenario 1 y 3: Confirmar o recalcular cotización según disponibilidad real de stock
router.patch('/cotizaciones/:id/confirmar', verificarToken, confirmarORecalcularCotizacion);

// HU-07 Escenario 3: Eliminar cotización (cuando un producto quedó sin stock o ya no se requiere)
router.delete('/cotizaciones/:id', verificarToken, eliminarCotizacion);

// HU-07: Listar historial de cotizaciones (Solo Staff)
router.get(
  '/cotizaciones',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN', 'VENDEDOR', 'OPERADOR']),
  listarCotizaciones
);

module.exports = router;
