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
 * HU-08: Registrar interés en producto futuro o agotado (Waitlist)
 */
const registrarInteres = async (req, res) => {
  try {
    const { idProducto, nombreCliente, telefonoCliente, emailCliente, notas } = req.body;

    const idProd = parseInt(idProducto);
    if (isNaN(idProd) || idProd <= 0) {
      return res.status(400).json({ error: 'ID de producto inválido.' });
    }

    if (!nombreCliente || !nombreCliente.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    if (!telefonoCliente || !telefonoCliente.trim()) {
      return res.status(400).json({ error: 'El teléfono/WhatsApp es obligatorio para poder notificarte.' });
    }

    // Verificar existencia del producto
    const producto = await prisma.producto.findUnique({
      where: { id: idProd }
    });

    if (!producto) {
      return res.status(404).json({ error: 'El producto seleccionado no existe.' });
    }

    // Prevención de duplicados (CA2)
    const interesExistente = await prisma.interesProducto.findFirst({
      where: {
        idProducto: idProd,
        telefonoCliente: telefonoCliente.trim()
      }
    });

    if (interesExistente) {
      return res.status(409).json({
        error: `Ya registraste tu interés en "${producto.nombre}". Te notificaremos por WhatsApp apenas esté disponible.`
      });
    }

    const nuevoInteres = await prisma.interesProducto.create({
      data: {
        idProducto: idProd,
        nombreCliente: nombreCliente.trim(),
        telefonoCliente: telefonoCliente.trim(),
        emailCliente: emailCliente ? emailCliente.trim() : null,
        notas: notas ? notas.trim() : null
      },
      include: {
        producto: { select: { nombre: true, marca: true, precio: true } }
      }
    });

    return res.status(201).json({
      mensaje: `¡Listo! Te avisaremos por WhatsApp apenas recibamos stock de "${producto.nombre}".`,
      interes: nuevoInteres
    });
  } catch (error) {
    console.error('[InteresController.registrarInteres] Error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al registrar tu interés en el producto.')
    });
  }
};

/**
 * HU-08: Listar resumen de demanda e interés por producto (Staff)
 */
const listarResumenIntereses = async (req, res) => {
  try {
    const intereses = await prisma.interesProducto.findMany({
      orderBy: { fechaRegistro: 'desc' },
      include: {
        producto: {
          select: { id: true, nombre: true, marca: true, precio: true, stockActual: true }
        }
      }
    });

    // Agrupar por producto para análisis de demanda
    const agrupado = {};
    for (const item of intereses) {
      const pid = item.idProducto;
      if (!agrupado[pid]) {
        agrupado[pid] = {
          producto: item.producto,
          totalInteresados: 0,
          clientes: []
        };
      }
      agrupado[pid].totalInteresados++;
      agrupado[pid].clientes.push({
        id: item.id,
        nombre: item.nombreCliente,
        telefono: item.telefonoCliente,
        email: item.emailCliente,
        fecha: item.fechaRegistro,
        estado: item.estado
      });
    }

    return res.status(200).json({
      resumenDemanda: Object.values(agrupado),
      totalRegistros: intereses.length
    });
  } catch (error) {
    console.error('[InteresController.listarResumenIntereses] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al obtener la lista de espera.')
    });
  }
};

/**
 * HU-08: Actualizar estado del interés (Staff notifica al cliente)
 */
const actualizarEstadoInteres = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const idInteres = parseInt(id);
    if (isNaN(idInteres) || idInteres <= 0) {
      return res.status(400).json({ error: 'ID de registro inválido.' });
    }

    const estadosValidos = ['PENDIENTE', 'NOTIFICADO', 'CONVERTIDO_RESERVA', 'CANCELADO'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
    }

    const actualizado = await prisma.interesProducto.update({
      where: { id: idInteres },
      data: { estado }
    });

    return res.status(200).json({
      mensaje: `Registro actualizado a estado ${estado}.`,
      interes: actualizado
    });
  } catch (error) {
    console.error('[InteresController.actualizarEstadoInteres] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al actualizar el estado del interés.')
    });
  }
};

module.exports = {
  registrarInteres,
  listarResumenIntereses,
  actualizarEstadoInteres
};
