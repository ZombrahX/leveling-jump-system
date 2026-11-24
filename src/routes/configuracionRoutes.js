const express = require('express');
const router = express.Router();
const {
  obtenerConfiguracion,
  actualizarConfiguracion
} = require('../controllers/configuracionController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Consulta pública para que botones de WhatsApp y proformas obtengan el número oficial de la tienda
router.get('/configuracion', obtenerConfiguracion);

// Actualización protegida para Staff administrativo (SUPERADMIN y ADMIN)
router.put(
  '/configuracion',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  actualizarConfiguracion
);

module.exports = router;
