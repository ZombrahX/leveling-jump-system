const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PTLJ-14: Registrar un nuevo producto en el catálogo
const registrarProducto = async (req, res) => {
    try {
        const { codigo, nombre, descripcion, categoria, escala, marca, precio, imagenUrl } = req.body;

        // Validar campos obligatorios básicos
        if (!codigo || !nombre || !precio || !marca) {
            return res.status(400).json({ 
                error: "Los campos codigo, nombre, precio y marca son obligatorios." 
            });
        }

        const nuevoProducto = await prisma.producto.create({
            data: {
                codigo,
                nombre,
                descripcion,
                categoria: categoria || 'MODEL_KITS',
                escala: escala || 'NO_APLICA',
                marca,
                precio: parseFloat(precio),
                imagenUrl: imagenUrl || ''
            }
        });

        return res.status(201).json({
            mensaje: "Producto registrado exitosamente (PTLJ-14)",
            producto: nuevoProducto
        });
    } catch (error) {
        // Manejar error de código SKU duplicado en Prisma
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Ya existe un producto con este código SKU o combinación única." });
        }
        return res.status(500).json({ error: error.message });
    }
};

// PTLJ-15: Obtener todos los productos (con filtros opcionales de búsqueda y categoría)
const obtenerProductos = async (req, res) => {
    try {
        const { busqueda, categoria } = req.query;
        const filtro = {};
        
        if (busqueda) {
            filtro.nombre = { contains: busqueda, mode: 'insensitive' };
        }
        if (categoria) {
            filtro.categoria = categoria;
        }

        const productos = await prisma.producto.findMany({
            where: filtro,
            include: {
                _count: {
                    select: {
                        unidadesInventario: {
                            where: { estadoStock: 'DISPONIBLE' }
                        }
                    }
                }
            },
            orderBy: { id: 'desc' }
        });

        const productosConStock = productos.map(p => ({
            ...p,
            stockDisponible: p._count ? p._count.unidadesInventario : 0
        }));

        return res.status(200).json({
            total: productosConStock.length,
            productos: productosConStock
        });
    } catch (error) {
        return res.status(500).json({
            error: "Error al obtener los productos",
            detalle: error.message
        });
    }
};

// PTLJ-15: Obtener un producto específico por su ID
const obtenerProductoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const producto = await prisma.producto.findUnique({
            where: { id: parseInt(id) }
        });

        if (!producto) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        return res.status(200).json(producto);
    } catch (error) {
        return res.status(500).json({
            error: "Error al buscar el producto",
            detalle: error.message
        });
    }
};

module.exports = {
    registrarProducto,
    obtenerProductos,
    obtenerProductoPorId
};

// PTLJ-16: Actualizar un producto existente en el catálogo
const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, categoria, escala, marca, precio, imagenUrl, estado } = req.body;

        // Verificar si el producto existe antes de actualizar
        const productoExistente = await prisma.producto.findUnique({
            where: { id: parseInt(id) }
        });

        if (!productoExistente) {
            return res.status(404).json({ error: "Producto no encontrado para actualizar." });
        }

        // Realizar la actualización con los campos enviados
        const productoActualizado = await prisma.producto.update({
            where: { id: parseInt(id) },
            data: {
                ...(codigo && { codigo }),
                ...(nombre && { nombre }),
                ...(descripcion !== undefined && { descripcion }),
                ...(categoria && { categoria }),
                ...(escala && { escala }),
                ...(marca && { marca }),
                ...(precio !== undefined && { precio: parseFloat(precio) }),
                ...(imagenUrl && { imagenUrl }),
                ...(estado && { estado })
            }
        });

        return res.status(200).json({
            mensaje: "Producto actualizado exitosamente (PTLJ-16)",
            producto: productoActualizado
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "El código SKU o la combinación única ya pertenece a otro producto." });
        }
        return res.status(500).json({
            error: "Error al actualizar el producto",
            detalle: error.message
        });
    }
};

// No olvides incluir 'actualizarProducto' en el module.exports al final del archivo:
module.exports = {
    registrarProducto,
    obtenerProductos,
    obtenerProductoPorId,
    actualizarProducto
};