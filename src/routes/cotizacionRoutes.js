const express = require('express');
const router = express.Router();
const {
  crearCotizacion,
  obtenerCotizacionPorCodigo,
  listarCotizaciones
} = require('../controllers/cotizacionController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Endpoint público: Solicitar cotización formal (HU-07)
router.post('/cotizaciones', crearCotizacion);

// Endpoint Staff: Listar cotizaciones emitidas (declarado antes de /:codigo para evitar colisión de rutas)
router.get('/cotizaciones', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), listarCotizaciones);

// Endpoint público: Consultar cotización por código (HU-07)
router.get('/cotizaciones/:codigo', obtenerCotizacionPorCodigo);

module.exports = router;
