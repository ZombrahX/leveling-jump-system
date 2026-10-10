const { Router } = require('express');
const { registrarLoteConUnidades } = require('../controllers/loteController');

const router = Router();

// Endpoint oficial de lotes (HU-04) y alias de compatibilidad
router.post('/lotes', registrarLoteConUnidades);
router.post('/recepciones', registrarLoteConUnidades);

module.exports = router;