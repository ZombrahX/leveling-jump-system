const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sanitizarError = (error, defaultMsg = 'Error interno en la operación.') => {
  if (process.env.NODE_ENV === 'development') return error.message;
  if (error.statusCode && error.statusCode < 500) return error.message;
  if (error.message && !error.message.includes(':\\') && !error.message.includes('node_modules')) {
    return error.message;
  }
  return defaultMsg;
};

/**
 * HU-07: Generar y registrar una cotización formal
 */
const crearCotizacion = async (req, res) => {
  try {
    const { nombreCliente, telefonoCliente, emailCliente, items, observaciones } = req.body;

    if (!nombreCliente || !nombreCliente.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio para la cotización.' });
    }

    if (!telefonoCliente || !telefonoCliente.trim()) {
      return res.status(400).json({ error: 'El teléfono/WhatsApp del cliente es obligatorio para remitir la cotización.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la cotización.' });
    }

    // Validar y consolidar cantidades de productos estrictamente (HU07-P02: sin parseInt)
    const itemMap = new Map();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: `El ítem en la posición ${i + 1} no es válido.` });
      }

      // Validar idProducto estricto
      const rawId = item.idProducto;
      if (typeof rawId === 'string' && !/^\d+$/.test(rawId.trim())) {
        return res.status(400).json({ error: `ID de producto inválido en la línea ${i + 1} (recibido: "${rawId}").` });
      }
      const idProd = Number(rawId);
      if (!Number.isInteger(idProd) || idProd <= 0) {
        return res.status(400).json({ error: `ID de producto inválido en la línea ${i + 1}.` });
      }

      // HU07-P02: Validar cantidad estricta sin parseInt truncador (rechazar 2.5, 2abc, etc.)
      const rawCant = item.cantidad;
      if (rawCant === undefined || rawCant === null || typeof rawCant === 'boolean') {
        return res.status(400).json({ error: `La cantidad es obligatoria para el producto en la línea ${i + 1}.` });
      }

      if (typeof rawCant === 'string' && !/^\d+$/.test(rawCant.trim())) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idProd} debe ser un número entero positivo sin decimales ni caracteres (recibido: "${rawCant}").`
        });
      }

      const cant = Number(rawCant);
      if (!Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idProd} debe ser un entero positivo mayor a cero (recibido: "${rawCant}").`
        });
      }

      itemMap.set(idProd, (itemMap.get(idProd) || 0) + cant);
    }

    // Obtener información real de los productos desde la BD para garantizar precios oficiales
    const productIds = Array.from(itemMap.keys());
    const productosDB = await prisma.producto.findMany({
      where: { id: { in: productIds } }
    });

    if (productosDB.length !== productIds.length) {
      return res.status(404).json({ error: 'Uno o más productos seleccionados ya no existen en el catálogo.' });
    }

    const prodDict = new Map(productosDB.map(p => [p.id, p]));

    // HU07-P01: Comprobar disponibilidad real en inventario antes de confirmar la cotización
    for (const [idProd, cant] of itemMap.entries()) {
      const prod = prodDict.get(idProd);
      if (prod.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: `El producto "${prod.nombre}" no se encuentra activo para cotización comercial.`
        });
      }

      const unidadesDisponibles = await prisma.inventarioUnidad.count({
        where: {
          idProducto: idProd,
          estadoStock: 'DISPONIBLE',
          reservas: {
            none: {
              estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA'] }
            }
          }
        }
      });

      if (unidadesDisponibles === 0) {
        return res.status(409).json({
          error: `No se puede emitir la cotización: El producto "${prod.nombre}" se encuentra actualmente agotado en almacén.`
        });
      }

      if (unidadesDisponibles < cant) {
        return res.status(409).json({
          error: `Disponibilidad insuficiente para cotizar "${prod.nombre}". Solicitó ${cant} unidad(es), pero solo hay ${unidadesDisponibles} disponible(s) en este momento.`
        });
      }
    }

    let totalCotizacion = 0;
    const detallesData = [];

    for (const [idProd, cant] of itemMap.entries()) {
      const prod = prodDict.get(idProd);
      const precioUnit = parseFloat(prod.precio);
      const subtotal = Math.round(precioUnit * cant * 100) / 100;
      totalCotizacion += subtotal;

      detallesData.push({
        idProducto: idProd,
        nombreProducto: prod.nombre,
        cantidad: cant,
        precioUnitario: precioUnit,
        subtotal: subtotal
      });
    }

    totalCotizacion = Math.round(totalCotizacion * 100) / 100;

    // Generar código único correlativo COT-2026-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const codigoCotizacion = `COT-2026-${randomSuffix}`;

    // Vigencia: 7 días calendario
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);

    const cotizacionCreada = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          codigoCotizacion,
          nombreCliente: nombreCliente.trim(),
          telefonoCliente: telefonoCliente.trim(),
          emailCliente: emailCliente ? emailCliente.trim() : null,
          total: totalCotizacion,
          fechaVencimiento,
          observaciones: observaciones ? observaciones.trim() : null,
          items: {
            create: detallesData
          }
        },
        include: {
          items: true
        }
      });
      return cot;
    });

    return res.status(201).json({
      mensaje: `Cotización formal ${codigoCotizacion} generada exitosamente. Válida por 7 días.`,
      avisoLegal: 'Nota: La cotización comercial no reserva stock físico. Disponibilidad garantizada únicamente con reserva formal o compra.',
      cotizacion: cotizacionCreada
    });
  } catch (error) {
    console.error('[CotizacionController.crearCotizacion] Error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al generar la cotización.')
    });
  }
};

/**
 * HU-07: Consultar cotización por código correlativo (Pública)
 */
const obtenerCotizacionPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ error: 'Código de cotización requerido.' });
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { codigoCotizacion: codigo.trim() },
      include: {
        items: true
      }
    });

    if (!cotizacion) {
      return res.status(404).json({ error: `No se encontró ninguna cotización con el código "${codigo}".` });
    }

    const ahora = new Date();
    const vigente = ahora <= new Date(cotizacion.fechaVencimiento);

    // HU07-P04 & Punto 5 de Brian: Limitar estrictamente los datos de la respuesta pública
    const enmascararNombre = (nom) => {
      if (!nom) return 'Cliente';
      const partes = nom.trim().split(/\s+/);
      if (partes.length === 1) return partes[0];
      return `${partes[0]} ${partes[1].charAt(0)}.`;
    };

    const cotizacionPublica = {
      codigoCotizacion: cotizacion.codigoCotizacion,
      clienteReferencia: enmascararNombre(cotizacion.nombreCliente),
      fechaEmision: cotizacion.fechaEmision,
      fechaVencimiento: cotizacion.fechaVencimiento,
      total: parseFloat(cotizacion.total),
      items: cotizacion.items.map(it => ({
        idProducto: it.idProducto,
        nombreProducto: it.nombreProducto,
        cantidad: it.cantidad,
        precioUnitario: parseFloat(it.precioUnitario),
        subtotal: parseFloat(it.subtotal)
      }))
    };

    return res.status(200).json({
      cotizacion: cotizacionPublica,
      vigente,
      diasRestantes: Math.max(0, Math.ceil((new Date(cotizacion.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24))),
      avisoLegal: 'Nota: La cotización comercial no reserva stock físico.'
    });
  } catch (error) {
    console.error('[CotizacionController.obtenerCotizacionPorCodigo] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al consultar la cotización.')
    });
  }
};

/**
 * HU-07: Listar cotizaciones para Staff
 */
const listarCotizaciones = async (req, res) => {
  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      orderBy: { fechaEmision: 'desc' },
      include: {
        items: true
      },
      take: 50
    });

    return res.status(200).json({ cotizaciones });
  } catch (error) {
    console.error('[CotizacionController.listarCotizaciones] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al listar las cotizaciones.')
    });
  }
};

module.exports = {
  crearCotizacion,
  obtenerCotizacionPorCodigo,
  listarCotizaciones
};
