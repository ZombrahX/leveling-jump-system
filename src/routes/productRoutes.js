const express = require('express');
const router = express.Router();
const { 
    registrarProducto, 
    obtenerProductos, 
    obtenerProductoPorId,
    actualizarProducto 
} = require('../controllers/productController');

// Rutas de productos (Catálogo - HU-03)
router.post('/productos', registrarProducto);               // PTLJ-14: Registro
router.get('/productos', obtenerProductos);                 // PTLJ-15: Listar/Buscar
router.get('/productos/:id', obtenerProductoPorId);         // PTLJ-15: Buscar por ID
router.put('/productos/:id', actualizarProducto);           // PTLJ-16: Actualización

module.exports = router;