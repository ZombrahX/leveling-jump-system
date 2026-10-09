const { Router } = require('express');
const { registrarLoteConUnidades } = require('../controllers/loteController');

const router = Router();

router.post('/lotes', registrarLoteConUnidades);

module.exports = router;