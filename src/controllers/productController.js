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

        const precioNum = parseFloat(precio);
        if (isNaN(precioNum) || precioNum <= 0) {
            return res.status(400).json({ error: "El precio debe ser un número mayor a 0." });
        }

        const nuevoProducto = await prisma.producto.create({
            data: {
                codigo,
                nombre,
                descripcion,
                categoria: categoria || 'MODEL_KITS',
                escala: escala || 'NO_APLICA',
                marca,
                precio: precioNum,
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
        console.error("[ProductController.registrarProducto] Detalle técnico:", error);
        return res.status(500).json({ error: "Error interno al registrar el producto." });
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
                },
                unidadesInventario: {
                    select: { costoUnitario: true },
                    where: { costoUnitario: { not: null } },
                    orderBy: { id: 'desc' },
                    take: 1
                }
            },
            orderBy: { id: 'desc' }
        });

        const productosConStock = productos.map(p => {
            const ultimoCosto = p.unidadesInventario && p.unidadesInventario.length > 0
                ? Number(p.unidadesInventario[0].costoUnitario)
                : null;
            return {
                ...p,
                stockDisponible: p._count ? p._count.unidadesInventario : 0,
                costoReferencia: ultimoCosto
            };
        });

        return res.status(200).json({
            total: productosConStock.length,
            productos: productosConStock
        });
    } catch (error) {
        console.error("[ProductController.obtenerProductos] Detalle técnico:", error);
        return res.status(500).json({
            error: "Error interno al obtener los productos"
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
        console.error("[ProductController.obtenerProductoPorId] Detalle técnico:", error);
        return res.status(500).json({
            error: "Error interno al buscar el producto"
        });
    }
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

        // P06: HU-13 / CA1 - Validar que el nuevo precio no sea menor al costo de adquisición registrado
        if (precio !== undefined) {
            const precioNum = parseFloat(precio);
            const unidadConCosto = await prisma.inventarioUnidad.findFirst({
                where: {
                    idProducto: parseInt(id),
                    costoUnitario: { not: null }
                },
                orderBy: { id: 'desc' }
            });

            if (unidadConCosto && unidadConCosto.costoUnitario) {
                const costoNum = parseFloat(unidadConCosto.costoUnitario);
                if (precioNum < costoNum) {
                    return res.status(400).json({
                        error: `No se puede guardar un precio de venta (S/ ${precioNum.toFixed(2)}) inferior al costo de adquisición registrado (S/ ${costoNum.toFixed(2)}). Margen negativo no permitido (HU-13 / CA1).`
                    });
                }
            }
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
        console.error("[ProductController.actualizarProducto] Detalle técnico:", error);
        return res.status(500).json({
            error: "Error interno al actualizar el producto"
        });
    }
};

module.exports = {
    registrarProducto,
    obtenerProductos,
    obtenerProductoPorId,
    actualizarProducto
};
