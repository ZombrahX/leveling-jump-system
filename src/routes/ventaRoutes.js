const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

// HU-05: Rutas protegidas para Staff (SUPERADMIN y ADMIN)
router.post(
  '/ventas',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  ventaController.registrarVenta
);

router.get(
  '/ventas',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  ventaController.listarVentas
);

router.get(
  '/ventas/:id',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  ventaController.obtenerVentaPorId
);

router.put(
  '/ventas/:id/anular',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  ventaController.anularVenta
);

module.exports = router;
