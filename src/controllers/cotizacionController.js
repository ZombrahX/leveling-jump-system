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

    // Validar y consolidar cantidades de productos
    const itemMap = new Map();
    for (const item of items) {
      const idProd = parseInt(item.idProducto);
      const cant = parseInt(item.cantidad);

      if (isNaN(idProd) || idProd <= 0) {
        return res.status(400).json({ error: 'ID de producto inválido en la lista.' });
      }

      if (!Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser un entero positivo.' });
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

    // HU07-P04: Protección de privacidad de datos personales en consulta pública
    const enmascararTelefono = (tel) => {
      if (!tel || tel.length < 5) return tel;
      return tel.slice(0, 3) + ' *** ' + tel.slice(-2);
    };

    const enmascararEmail = (email) => {
      if (!email || !email.includes('@')) return email;
      const [u, d] = email.split('@');
      return u.slice(0, 2) + '***@' + d;
    };

    const cotizacionProtegida = {
      ...cotizacion,
      telefonoCliente: enmascararTelefono(cotizacion.telefonoCliente),
      emailCliente: enmascararEmail(cotizacion.emailCliente)
    };

    return res.status(200).json({
      cotizacion: cotizacionProtegida,
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
