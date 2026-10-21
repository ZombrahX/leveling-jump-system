const { Router } = require('express');
const { registrarLoteConUnidades, obtenerLotes } = require('../controllers/loteController');

const router = Router();

// Endpoints de recepción de lotes (HU-04 & HU-12)
router.post('/lotes', registrarLoteConUnidades);
router.post('/recepciones', registrarLoteConUnidades);
router.get('/lotes', obtenerLotes);

module.exports = router;