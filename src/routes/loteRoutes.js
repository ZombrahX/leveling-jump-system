const { Router } = require('express');
const { registrarLoteConUnidades, obtenerLotes } = require('../controllers/loteController');
const { verificarToken, requerirRol } = require('../middlewares/authMiddleware');

const router = Router();

// Endpoints de recepción y consulta de lotes protegidos contra BFLA (HU-04 & HU-12 — Solo Staff)
router.post(
  '/lotes',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  registrarLoteConUnidades
);
router.post(
  '/recepciones',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  registrarLoteConUnidades
);
router.get(
  '/lotes',
  verificarToken,
  requerirRol(['SUPERADMIN', 'ADMIN']),
  obtenerLotes
);

module.exports = router;
