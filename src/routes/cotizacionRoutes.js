const express = require('express');
const router = express.Router();
const {
  crearCotizacion,
  obtenerCotizacionPorCodigo,
  obtenerMisCotizaciones,
  listarCotizaciones
} = require('../controllers/cotizacionController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Endpoint público: Solicitar cotización formal (HU-07)
router.post('/cotizaciones', crearCotizacion);

// Endpoint autenticado: Consultar todas las cotizaciones propias del usuario que inició sesión
router.get('/cotizaciones/mis-cotizaciones', verificarToken, obtenerMisCotizaciones);

// Endpoint Staff: Listar todas las cotizaciones emitidas en la tienda
router.get('/cotizaciones', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), listarCotizaciones);

// Endpoint de consulta por código correlativo
router.get('/cotizaciones/:codigo', obtenerCotizacionPorCodigo);

module.exports = router;
