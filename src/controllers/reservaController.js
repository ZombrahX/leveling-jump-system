const { PrismaClient } = require('@prisma/client');
const { enviarComprobanteReserva } = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Sanitiza los errores técnicos o de Prisma para evitar exponer rutas o fallas internas al cliente
 */
function sanitizarError(error, defaultMsg = 'Ocurrió un error al procesar la reserva.') {
  if (error.code === 'P2002') {
    return 'Conflicto de unicidad: la unidad o código ya cuenta con un registro activo.';
  }
  if (error.code && error.code.startsWith('P')) {
    return 'Inconsistencia en la base de datos al procesar la reserva.';
  }
  if (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('C:\\') && !error.message.includes('/')) {
    return error.message;
  }
  return defaultMsg;
}

/**
 * Genera un código correlativo único para reservas: RES-2026-XXXX
 */
function generarCodigoSeguimiento() {
  const anio = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RES-${anio}-${random}`;
}

/**
 * PTLJ-4 / HU-06: Registrar reserva de unidad con adelanto manual flexible
 */
const crearReserva = async (req, res) => {
  try {
    const {
      idProducto,
      nombreCliente,
      telefonoCliente,
      emailCliente,
      montoTotal,
      montoAdelanto,
      notas,
      idUsuario
    } = req.body;

    if (!idProducto) {
      return res.status(400).json({ error: 'El producto a reservar es obligatorio.' });
    }

    if (!nombreCliente || !nombreCliente.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    if (!telefonoCliente || !telefonoCliente.trim()) {
      return res.status(400).json({ error: 'El teléfono o WhatsApp de contacto es obligatorio.' });
    }

    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(idProducto) }
    });

    if (!producto) {
      return res.status(404).json({ error: 'El producto seleccionado no existe.' });
    }

    const total = parseFloat(montoTotal || producto.precio);
    const adelanto = parseFloat(montoAdelanto || 0);

    if (adelanto < 0 || adelanto > total) {
      return res.status(400).json({ 
        error: `El adelanto (S/ ${adelanto}) no puede ser menor a 0 ni exceder el total (S/ ${total}).` 
      });
    }

    const saldo = Math.max(0, total - adelanto);
    const codigoSeguimiento = generarCodigoSeguimiento();
    const estadoInicial = adelanto > 0 ? 'CONFIRMADA' : 'PENDIENTE';

    // Transacción ACID para asegurar asignación atómica de inventario (P08 / P09 / HU-06 CA2)
    const resultado = await prisma.$transaction(async (tx) => {
      // P08 / P09: Buscar si hay unidad física disponible que no tenga reservas activas
      const unidadDisponible = await tx.inventarioUnidad.findFirst({
        where: {
          idProducto: parseInt(idProducto),
          estadoStock: 'DISPONIBLE',
          reservas: {
            none: {
              estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA'] }
            }
          }
        }
      });

      // P08: Si no hay unidad disponible, rechazar la reserva de inmediato
      if (!unidadDisponible) {
        throw new Error('PRODUCTO_AGOTADO');
      }

      // P08: Apartar la unidad física de forma atómica para evitar sobreventa concurrente
      const asignacion = await tx.inventarioUnidad.updateMany({
        where: {
          id: unidadDisponible.id,
          estadoStock: 'DISPONIBLE'
        },
        data: { estadoStock: 'RESERVADO' }
      });

      if (asignacion.count === 0) {
        throw new Error('PRODUCTO_AGOTADO');
      }

      // P09: Crear la reserva vinculada a la unidad física (permite historial 1:N sin conflicto P2002)
      const nuevaReserva = await tx.reserva.create({
        data: {
          codigoSeguimiento,
          idProducto: parseInt(idProducto),
          idUnidad: unidadDisponible.id,
          idUsuario: idUsuario ? parseInt(idUsuario) : null,
          nombreCliente: nombreCliente.trim(),
          telefonoCliente: telefonoCliente.trim(),
          emailCliente: emailCliente ? emailCliente.trim().toLowerCase() : null,
          montoTotal: total,
          montoAdelanto: adelanto,
          saldoPendiente: saldo,
          estadoReserva: estadoInicial,
          notas: notas ? notas.trim() : null
        },
        include: {
          producto: true,
          unidadInventario: true
        }
      });

      return nuevaReserva;
    });

    // Enviar correo de comprobante si se proporcionó email
    if (resultado.emailCliente) {
      try {
        await enviarComprobanteReserva(resultado.emailCliente, resultado.nombreCliente, {
          codigoSeguimiento: resultado.codigoSeguimiento,
          nombreProducto: producto.nombre,
          montoTotal: total,
          montoAdelanto: adelanto,
          saldoPendiente: saldo
        });
      } catch (errEmail) {
        console.warn('[ReservaController] No se pudo enviar el correo de confirmación:', errEmail.message);
      }
    }

    return res.status(201).json({
      mensaje: `Reserva registrada con éxito. Código de seguimiento: ${resultado.codigoSeguimiento}`,
      reserva: resultado
    });

  } catch (error) {
    if (error.message === 'PRODUCTO_AGOTADO') {
      return res.status(400).json({
        error: 'El producto se encuentra agotado. No quedan unidades físicas disponibles para reservar.'
      });
    }
    console.error('[ReservaController.crearReserva] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al registrar la reserva.') });
  }
};

/**
 * PTLJ-4 / HU-06: Obtener todas las reservas con filtros opcionales
 */
const obtenerReservas = async (req, res) => {
  try {
    const { estado, busqueda } = req.query;
    const filtro = {};

    if (estado) {
      filtro.estadoReserva = estado;
    }

    if (busqueda) {
      filtro.OR = [
        { codigoSeguimiento: { contains: busqueda, mode: 'insensitive' } },
        { nombreCliente: { contains: busqueda, mode: 'insensitive' } },
        { telefonoCliente: { contains: busqueda } }
      ];
    }

    const reservas = await prisma.reserva.findMany({
      where: filtro,
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true, precio: true, imagenUrl: true }
        },
        unidadInventario: {
          select: { id: true, codigoSerie: true, estadoStock: true }
        }
      },
      orderBy: { fechaReserva: 'desc' }
    });

    return res.status(200).json({
      total: reservas.length,
      reservas
    });
  } catch (error) {
    console.error('[ReservaController.obtenerReservas] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al obtener la lista de reservas.') });
  }
};

/**
 * P09 / HU-06: Actualizar estado de una reserva (CONFIRMADA, ENTREGADA, CANCELADA)
 * Sincroniza atómicamente el estado del inventario físico:
 * - CANCELADA -> DISPONIBLE
 * - ENTREGADA -> VENDIDO
 * - CONFIRMADA / PENDIENTE -> RESERVADO
 */
const actualizarEstadoReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoReserva } = req.body;

    const estadosValidos = ['PENDIENTE', 'CONFIRMADA', 'ENTREGADA', 'CANCELADA', 'EXPIRADA'];
    if (!estadosValidos.includes(estadoReserva)) {
      return res.status(400).json({ error: 'Estado de reserva no válido.' });
    }

    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(id) }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    // P09: Manejo coordinado del ciclo de vida del stock físico
    if (reserva.idUnidad) {
      if (estadoReserva === 'CANCELADA') {
        // Al cancelar, se libera la unidad física a DISPONIBLE para ser re-reservada
        await prisma.inventarioUnidad.update({
          where: { id: reserva.idUnidad },
          data: { estadoStock: 'DISPONIBLE' }
        });
      } else if (estadoReserva === 'ENTREGADA') {
        // Al entregar el kit al comprador, la unidad física pasa definitivamente a VENDIDO
        await prisma.inventarioUnidad.update({
          where: { id: reserva.idUnidad },
          data: { estadoStock: 'VENDIDO' }
        });
      } else if (estadoReserva === 'CONFIRMADA' || estadoReserva === 'PENDIENTE') {
        // Si se reactiva, la unidad física vuelve a estar reservada
        await prisma.inventarioUnidad.update({
          where: { id: reserva.idUnidad },
          data: { estadoStock: 'RESERVADO' }
        });
      }
    }

    const reservaActualizada = await prisma.reserva.update({
      where: { id: parseInt(id) },
      data: { estadoReserva }
    });

    return res.status(200).json({
      mensaje: `Reserva ${reserva.codigoSeguimiento} actualizada a ${estadoReserva}.`,
      reserva: reservaActualizada
    });
  } catch (error) {
    console.error('[ReservaController.actualizarEstadoReserva] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al actualizar el estado de la reserva.') });
  }
};

/**
 * Obtener las reservas del cliente autenticado
 */
const obtenerMisReservas = async (req, res) => {
  try {
    const idUsuario = req.usuario.id;
    const emailUsuario = (req.usuario.email || '').trim().toLowerCase();

    const reservas = await prisma.reserva.findMany({
      where: {
        OR: [
          { idUsuario: idUsuario },
          ...(emailUsuario ? [{ emailCliente: emailUsuario }] : [])
        ]
      },
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true, precio: true, imagenUrl: true, marca: true, categoria: true }
        },
        unidadInventario: {
          select: { id: true, codigoSerie: true, estadoStock: true }
        }
      },
      orderBy: { fechaReserva: 'desc' }
    });

    return res.status(200).json({
      total: reservas.length,
      reservas
    });
  } catch (error) {
    console.error('[ReservaController.obtenerMisReservas] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al consultar tus reservas.') });
  }
};

module.exports = {
  crearReserva,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva
};
