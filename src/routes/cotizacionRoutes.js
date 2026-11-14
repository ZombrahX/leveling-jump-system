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

// Endpoint público: Consultar cotización por código (HU-07)
router.get('/cotizaciones/:codigo', obtenerCotizacionPorCodigo);

// Endpoint Staff: Listar cotizaciones emitidas
router.get('/cotizaciones', verificarToken, requerirRol(['SUPERADMIN', 'ADMIN']), listarCotizaciones);

module.exports = router;
