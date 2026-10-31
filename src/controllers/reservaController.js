const { PrismaClient } = require('@prisma/client');
const { enviarComprobanteReserva } = require('../services/emailService');

const prisma = new PrismaClient();

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

    // Transacción ACID para asegurar asignación atómica de inventario (P08 / HU-06 CA2)
    const resultado = await prisma.$transaction(async (tx) => {
      // P08: Buscar si hay unidad física disponible en inventario
      const unidadDisponible = await tx.inventarioUnidad.findFirst({
        where: {
          idProducto: parseInt(idProducto),
          estadoStock: 'DISPONIBLE'
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

      // Crear la reserva vinculada obligatoriamente a la unidad física
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
        error: 'El producto se encuentra agotado. No quedan unidades físicas disponibles para reservar (HU-06 / CA2).'
      });
    }
    console.error('[ReservaController.crearReserva] Error:', error);
    return res.status(500).json({ error: 'Error al registrar la reserva: ' + error.message });
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
    return res.status(500).json({ error: 'Error al obtener reservas: ' + error.message });
  }
};

/**
 * Actualizar estado de una reserva (CONFIRMADA, ENTREGADA, CANCELADA)
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

    // Si se cancela y tenía unidad asignada, liberar la unidad a DISPONIBLE
    if (estadoReserva === 'CANCELADA' && reserva.idUnidad) {
      await prisma.inventarioUnidad.update({
        where: { id: reserva.idUnidad },
        data: { estadoStock: 'DISPONIBLE' }
      });
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
    return res.status(500).json({ error: error.message });
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
    console.error('[ReservaController.obtenerMisReservas] Error:', error);
    return res.status(500).json({ error: 'Error al consultar tus reservas: ' + error.message });
  }
};

module.exports = {
  crearReserva,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva
};
