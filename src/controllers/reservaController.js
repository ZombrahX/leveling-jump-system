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
  if (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('node_modules') && !error.message.includes(':\\')) {
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
    const estadoPagoInicial = saldo === 0 ? 'COMPLETADO' : (adelanto > 0 ? 'PARCIAL' : 'PENDIENTE');

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
          estadoPago: estadoPagoInicial,
          notas: notas ? notas.trim() : null
        },
        include: {
          producto: true,
          unidadInventario: true
        }
      });

      // HU-09: Si se registró adelanto inicial, guardar comprobante de pago
      if (adelanto > 0) {
        await tx.pagoReserva.create({
          data: {
            idReserva: nuevaReserva.id,
            monto: adelanto,
            medioPago: (req.body.medioPago || 'YAPE').toUpperCase(),
            referenciaOperacion: req.body.referenciaOperacion ? req.body.referenciaOperacion.trim() : 'Adelanto inicial de reserva',
            idUsuarioRegistra: idUsuario ? parseInt(idUsuario) : null,
            observaciones: 'Adelanto inicial registrado al crear la reserva'
          }
        });
      }

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

/**
 * HU-09: Registrar un adelanto o abono sobre una reserva confirmada
 * Escenario 1: Registra monto y medio de pago, actualiza el saldo pendiente
 * Escenario 2: Impide pagos mayores al saldo e informa el importe máximo permitido
 * Escenario 3: Si completa el importe acordado, actualiza saldo a 0 y estadoPago a "COMPLETADO"
 */
const registrarPagoReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, medioPago, referenciaOperacion, observaciones } = req.body;

    const idReserva = parseInt(id);
    if (isNaN(idReserva) || idReserva <= 0) {
      return res.status(400).json({ error: 'ID de reserva inválido.' });
    }

    // HU09-P03: Validar precisión monetaria estricta (máximo 2 decimales, no negativos ni strings raros)
    if (typeof monto === 'string' && !/^\d+(\.\d{1,2})?$/.test(monto.trim())) {
      return res.status(400).json({
        error: `El monto del abono debe ser un número positivo con máximo 2 decimales (recibido: "${monto}").`
      });
    }

    const montoNum = Number(monto);
    if (isNaN(montoNum) || !isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({
        error: 'El monto del abono debe ser un número positivo mayor a cero.'
      });
    }

    if (Math.floor(montoNum * 100) !== Math.round(montoNum * 100)) {
      return res.status(400).json({
        error: 'El monto del abono no puede exceder los 2 decimales.'
      });
    }

    const mediosValidos = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];
    const medioNormalizado = (medioPago || 'YAPE').toString().trim().toUpperCase();
    if (!mediosValidos.includes(medioNormalizado)) {
      return res.status(400).json({
        error: `Medio de pago no válido. Opciones permitidas: ${mediosValidos.join(', ')}.`
      });
    }

    const idUsuarioRegistra = req.usuario ? req.usuario.id : null;
    const refOperacionLimpia = (referenciaOperacion || '').toString().trim();

    // HU09-P01 & P02: Clave de idempotencia única garantizada a nivel de base de datos
    const claveIdempotencia = (
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey ||
      (refOperacionLimpia ? `RES-${idReserva}-REF-${refOperacionLimpia}` : null) ||
      `PAY-${idReserva}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    ).toString().trim();

    // Transacción ACID atómica
    const resultado = await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: idReserva }
      });

      if (!reserva) {
        const err = new Error('La reserva solicitada no existe.');
        err.statusCode = 404;
        throw err;
      }

      if (reserva.estadoReserva === 'CANCELADA' || reserva.estadoReserva === 'EXPIRADA') {
        const err = new Error(`No se pueden registrar pagos en una reserva que se encuentra ${reserva.estadoReserva}.`);
        err.statusCode = 400;
        throw err;
      }

      // HU09-P02: Prevención de pagos duplicados por idempotencia de operación
      if (refOperacionLimpia) {
        const pagoDuplicado = await tx.pagoReserva.findFirst({
          where: {
            idReserva,
            referenciaOperacion: refOperacionLimpia
          }
        });
        if (pagoDuplicado) {
          const err = new Error(
            `Operación duplicada: ya existe un abono registrado con la referencia "${refOperacionLimpia}" para esta reserva.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      const saldoActual = parseFloat(reserva.saldoPendiente);

      // HU-09 Escenario 2: Impedir un pago mayor al saldo
      if (montoNum > saldoActual) {
        const err = new Error(
          `El importe ingresado (S/ ${montoNum.toFixed(2)}) supera el saldo pendiente de la reserva (S/ ${saldoActual.toFixed(2)}). El importe máximo que puede registrarse es S/ ${saldoActual.toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const nuevoSaldo = Math.round((saldoActual - montoNum) * 100) / 100;
      const nuevoTotalAdelanto = Math.round((parseFloat(reserva.montoAdelanto) + montoNum) * 100) / 100;

      // HU-09 Escenario 3: Si completa el saldo pendiente a 0, estadoPago -> COMPLETADO
      // HU09-P04: Decisión funcional - El primer abono confirma la reserva PENDIENTE -> CONFIRMADA
      const nuevoEstadoPago = nuevoSaldo === 0 ? 'COMPLETADO' : 'PARCIAL';
      const nuevoEstadoReserva = reserva.estadoReserva === 'PENDIENTE' ? 'CONFIRMADA' : reserva.estadoReserva;

      // 1. Guardar el pago en pagos_reserva con restricción UNIQUE de idempotencia en BD (HU09-P02)
      const nuevoPago = await tx.pagoReserva.create({
        data: {
          idReserva,
          monto: montoNum,
          medioPago: medioNormalizado,
          referenciaOperacion: refOperacionLimpia || null,
          idempotencyKey: claveIdempotencia,
          idUsuarioRegistra,
          observaciones: observaciones ? observaciones.trim() : null
        }
      });

      // 2. HU09-P01: Actualización condicional atómica del saldo (Optimistic Lock)
      // Si otra transacción modificó el saldo en simultáneo, el UPDATE afectará 0 filas y abortará
      const actualizacion = await tx.reserva.updateMany({
        where: {
          id: idReserva,
          saldoPendiente: reserva.saldoPendiente
        },
        data: {
          montoAdelanto: nuevoTotalAdelanto,
          saldoPendiente: nuevoSaldo,
          estadoPago: nuevoEstadoPago,
          estadoReserva: nuevoEstadoReserva
        }
      });

      if (actualizacion.count === 0) {
        const err = new Error(
          'Conflicto de concurrencia: el saldo de la reserva fue modificado simultáneamente por otra operación. Por favor reintente con el saldo vigente.'
        );
        err.statusCode = 409;
        throw err;
      }

      const reservaActualizada = await tx.reserva.findUnique({
        where: { id: idReserva },
        include: {
          producto: {
            select: { id: true, nombre: true, codigo: true, precio: true }
          },
          unidadInventario: {
            select: { id: true, codigoSerie: true, estadoStock: true }
          },
          pagos: {
            orderBy: { fechaPago: 'desc' }
          }
        }
      });

      return { nuevoPago, reservaActualizada };
    });

    return res.status(201).json({
      mensaje: resultado.reservaActualizada.saldoPendiente === 0
        ? '¡Pago completado con éxito! El saldo pendiente de la reserva ha llegado a S/ 0.00.'
        : `Abono de S/ ${montoNum.toFixed(2)} registrado exitosamente. Nuevo saldo pendiente: S/ ${Number(resultado.reservaActualizada.saldoPendiente).toFixed(2)}.`,
      pago: resultado.nuevoPago,
      reserva: resultado.reservaActualizada
    });
  } catch (error) {
    console.error('[ReservaController.registrarPagoReserva] Error:', error.message);
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Operación duplicada: Se detectó una solicitud simultánea o reintento para este mismo pago (violación de clave de idempotencia).'
      });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al registrar el pago de la reserva.')
    });
  }
};

/**
 * HU-09: Consultar historial de pagos de una reserva
 */
const obtenerHistorialPagos = async (req, res) => {
  try {
    const { id } = req.params;
    const idReserva = parseInt(id);

    if (isNaN(idReserva) || idReserva <= 0) {
      return res.status(400).json({ error: 'ID de reserva inválido.' });
    }

    // HU09-P06: Verificar existencia previa de la reserva
    const reservaExiste = await prisma.reserva.findUnique({
      where: { id: idReserva }
    });

    if (!reservaExiste) {
      return res.status(404).json({ error: 'La reserva solicitada no existe.' });
    }

    const pagos = await prisma.pagoReserva.findMany({
      where: { idReserva },
      orderBy: { fechaPago: 'desc' },
      include: {
        usuarioRegistra: {
          select: { id: true, nombre: true, email: true }
        }
      }
    });

    return res.status(200).json({
      total: pagos.length,
      pagos
    });
  } catch (error) {
    console.error('[ReservaController.obtenerHistorialPagos] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al consultar el historial de pagos.')
    });
  }
};

module.exports = {
  crearReserva,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva,
  registrarPagoReserva,
  obtenerHistorialPagos
};
