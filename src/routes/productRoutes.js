const express = require('express');
const router = express.Router();
const {
  registrarProducto,
  obtenerProductos,
  obtenerProductoPorId,
  actualizarProducto
} = require('../controllers/productController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// Rutas públicas de consulta del catálogo comercial (HU-01)
router.get('/productos', obtenerProductos);
router.get('/productos/:id', obtenerProductoPorId);

// Rutas administrativas protegidas contra BFLA (HU-03 — Solo Staff)
router.post(
  '/productos',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  registrarProducto
);
router.put(
  '/productos/:id',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  actualizarProducto
);

module.exports = router;
