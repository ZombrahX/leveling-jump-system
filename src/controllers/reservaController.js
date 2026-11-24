const prisma = require('../lib/prisma');
const crypto = require('crypto');
const { enviarComprobanteReserva } = require('../services/emailService');

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
 * Genera un código correlativo único para reservas con CSPRNG: RES-2026-XXXX
 */
function generarCodigoSeguimiento() {
  const anio = new Date().getFullYear();
  const random = crypto.randomInt(1000, 10000);
  return `RES-${anio}-${random}`;
}

/**
 * Lazy Expiration Transaccional: Libera automáticamente reservas PENDIENTES sin abono cuya fechaLimite expiró,
 * devolviendo sus unidades físicas de RESERVADO a DISPONIBLE sin intervención manual.
 */
async function liberarReservasExpiradas() {
  try {
    const ahora = new Date();
    const vencidas = await prisma.reserva.findMany({
      where: {
        estadoReserva: 'PENDIENTE',
        montoAdelanto: 0,
        fechaLimite: { lt: ahora }
      },
      select: { id: true, idUnidad: true }
    });

    if (vencidas.length === 0) return 0;

    await prisma.$transaction(async (tx) => {
      const idsReservas = vencidas.map(r => r.id);
      const idsUnidades = vencidas.map(r => r.idUnidad).filter(Boolean);

      await tx.reserva.updateMany({
        where: { id: { in: idsReservas }, estadoReserva: 'PENDIENTE' },
        data: { estadoReserva: 'EXPIRADA' }
      });

      if (idsUnidades.length > 0) {
        await tx.inventarioUnidad.updateMany({
          where: { id: { in: idsUnidades }, estadoStock: 'RESERVADO' },
          data: { estadoStock: 'DISPONIBLE' }
        });
      }
    });

    return vencidas.length;
  } catch (err) {
    console.warn('[ReservaController.liberarReservasExpiradas] Aviso:', err.message);
    return 0;
  }
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

    const esStaffOperador = req.usuario && ['SUPERADMIN', 'ADMIN'].includes(req.usuario.rol);
    const idUsuarioFinal = req.usuario ? Number(req.usuario.id) : (idUsuario ? parseInt(idUsuario) : null);
    const nombreFinal = (!esStaffOperador && req.usuario?.nombre)
      ? req.usuario.nombre.replace(/\s*\((Google|Local)\)/gi, '').trim()
      : (nombreCliente ? nombreCliente.trim() : '');
    const emailFinal = (!esStaffOperador && req.usuario?.email)
      ? req.usuario.email.trim().toLowerCase()
      : (emailCliente ? emailCliente.trim().toLowerCase() : null);

    if (!idProducto) {
      return res.status(400).json({ error: 'El producto a reservar es obligatorio.' });
    }

    if (!nombreFinal) {
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

    // Integridad financiera: el precio total se obtiene exclusivamente de la tabla productos en BD (nunca del body)
    const total = Math.round(parseFloat(producto.precio) * 100) / 100;
    const adelanto = Math.round(parseFloat(montoAdelanto || 0) * 100) / 100;

    if (isNaN(adelanto) || !isFinite(adelanto) || adelanto < 0 || adelanto > total) {
      return res.status(400).json({
        error: `El adelanto (S/ ${adelanto}) no puede ser menor a 0 ni exceder el precio oficial del producto (S/ ${total.toFixed(2)}).`
      });
    }

    const saldo = Math.round((total - adelanto) * 100) / 100;
    const codigoSeguimiento = generarCodigoSeguimiento();
    const estadoInicial = adelanto > 0 ? 'CONFIRMADA' : 'PENDIENTE';
    const estadoPagoInicial = saldo === 0 ? 'COMPLETADO' : (adelanto > 0 ? 'PARCIAL' : 'PENDIENTE');
    const fechaLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
          idUsuario: idUsuarioFinal,
          nombreCliente: nombreFinal,
          telefonoCliente: telefonoCliente.trim(),
          emailCliente: emailFinal,
          montoTotal: total,
          montoAdelanto: adelanto,
          saldoPendiente: saldo,
          estadoReserva: estadoInicial,
          estadoPago: estadoPagoInicial,
          fechaLimite,
          notas: notas ? notas.trim() : null
        },
        include: {
          producto: true,
          unidadInventario: {
            select: { id: true, codigoSerie: true, estadoStock: true }
          }
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
    await liberarReservasExpiradas();
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

    const idReserva = parseInt(id);
    if (isNaN(idReserva) || idReserva <= 0) {
      return res.status(400).json({ error: 'ID de reserva inválido.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: idReserva }
      });

      if (!reserva) {
        const err = new Error('Reserva no encontrada.');
        err.statusCode = 404;
        throw err;
      }

      // 1. Estados finales inmutables: una reserva ENTREGADA o CANCELADA no puede cambiar a otro estado
      if (reserva.estadoReserva === 'ENTREGADA' || reserva.estadoEntrega === 'ENTREGADO') {
        if (estadoReserva !== 'ENTREGADA') {
          const err = new Error('Operación inválida: Un pedido que ya fue ENTREGADO es definitivo y no puede regresar a Pendiente, Confirmada ni Cancelada.');
          err.statusCode = 400;
          throw err;
        }
      }

      if (reserva.estadoReserva === 'CANCELADA') {
        if (estadoReserva !== 'CANCELADA') {
          const err = new Error('Operación inválida: Una reserva CANCELADA ya liberó su unidad física y no puede reactivarse.');
          err.statusCode = 400;
          throw err;
        }
      }

      // 2. Impedir retroceder de CONFIRMADA a PENDIENTE si ya tiene adelanto/abonos registrados
      if (estadoReserva === 'PENDIENTE' && (reserva.estadoReserva === 'CONFIRMADA' || parseFloat(reserva.montoAdelanto || 0) > 0)) {
        const err = new Error('Operación inválida: No se puede regresar a PENDIENTE una reserva que ya está confirmada o tiene abonos registrados.');
        err.statusCode = 400;
        throw err;
      }

      // 3. Transición a ENTREGADA: exigir saldo pendiente = S/ 0.00 y sincronizar unidad física a VENDIDO
      if (estadoReserva === 'ENTREGADA') {
        const saldoActual = parseFloat(reserva.saldoPendiente || 0);
        if (saldoActual > 0) {
          const err = new Error(
            `Operación denegada: No se puede marcar como ENTREGADA una reserva con saldo pendiente de pago (Saldo actual: S/ ${saldoActual.toFixed(2)}). Primero debe completar el pago en "💰 Abonar".`
          );
          err.statusCode = 400;
          throw err;
        }

        if (!reserva.idUnidad) {
          const err = new Error('No se puede entregar una reserva que no cuenta con una unidad física asignada.');
          err.statusCode = 400;
          throw err;
        }

        const unidadActual = await tx.inventarioUnidad.findUnique({
          where: { id: reserva.idUnidad }
        });

        if (!unidadActual) {
          const err = new Error('La unidad física asignada a esta reserva no existe en el inventario.');
          err.statusCode = 409;
          throw err;
        }

        if (unidadActual.estadoStock === 'RESERVADO') {
          const asignacion = await tx.inventarioUnidad.updateMany({
            where: { id: reserva.idUnidad, estadoStock: 'RESERVADO' },
            data: { estadoStock: 'VENDIDO' }
          });

          if (asignacion.count === 0) {
            const err = new Error('Conflicto de inventario: La unidad física ya no se encuentra en estado RESERVADO.');
            err.statusCode = 409;
            throw err;
          }
        } else if (unidadActual.estadoStock !== 'VENDIDO') {
          const err = new Error(
            `Inconsistencia de inventario: La unidad física (Serie: ${unidadActual.codigoSerie}) se encuentra en estado "${unidadActual.estadoStock}".`
          );
          err.statusCode = 409;
          throw err;
        }
      } else if (estadoReserva === 'CANCELADA' && reserva.idUnidad) {
        // Al cancelar, se libera la unidad física a DISPONIBLE de forma condicionada
        await tx.inventarioUnidad.updateMany({
          where: { id: reserva.idUnidad, estadoStock: 'RESERVADO' },
          data: { estadoStock: 'DISPONIBLE' }
        });
      }

      const reservaActualizada = await tx.reserva.update({
        where: { id: idReserva },
        data: {
          estadoReserva,
          ...(estadoReserva === 'ENTREGADA' ? { estadoEntrega: 'ENTREGADO' } : {})
        },
        include: {
          producto: true,
          unidadInventario: true
        }
      });

      return reservaActualizada;
    });

    return res.status(200).json({
      mensaje: `Reserva ${resultado.codigoSeguimiento} actualizada a ${estadoReserva}.`,
      reserva: resultado
    });
  } catch (error) {
    console.error('[ReservaController.actualizarEstadoReserva] Detalle técnico:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: sanitizarError(error, 'Error al actualizar el estado de la reserva.') });
  }
};

/**
 * Obtener las reservas del cliente autenticado (incluyendo seguimiento de entrega y courier)
 */
const obtenerMisReservas = async (req, res) => {
  try {
    const idUsuario = Number(req.usuario.id);
    const usuarioDB = await prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: { email: true, nombre: true, telefono: true }
    });

    const emailUsuario = (usuarioDB?.email || req.usuario.email || '').trim().toLowerCase();
    const nombreUsuario = (usuarioDB?.nombre || req.usuario.nombre || '')
      .replace(/\s*\((Google|Local)\)/gi, '')
      .trim();
    const telUsuario = (usuarioDB?.telefono || '').replace(/\D/g, '');

    const condicionesOR = [{ idUsuario }];
    if (emailUsuario) {
      condicionesOR.push({ emailCliente: { equals: emailUsuario, mode: 'insensitive' } });
    }
    if (telUsuario && telUsuario.length >= 7) {
      condicionesOR.push({ telefonoCliente: { contains: telUsuario } });
    }
    if (nombreUsuario) {
      condicionesOR.push({ nombreCliente: { equals: nombreUsuario, mode: 'insensitive' } });
    }

    const reservas = await prisma.reserva.findMany({
      where: {
        OR: condicionesOR
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

    // Validar monto
    const montoNum = Number(monto);
    if (isNaN(montoNum) || !isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({
        error: 'El monto del abono debe ser un número positivo mayor a cero.'
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

    // HU-09: Clave de idempotencia determinista y estable por intento de pago
    const refLimpia = referenciaOperacion ? referenciaOperacion.trim().toUpperCase() : null;
    const stableIdempotencyKey = (
      req.headers['idempotency-key'] ||
      req.body.idempotencyKey ||
      (refLimpia ? `pago_${idReserva}_${refLimpia}` : `pago_${idReserva}_${montoNum.toFixed(2)}_${Date.now()}`)
    ).toString().slice(0, 100);

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
      const nuevoEstadoPago = nuevoSaldo === 0 ? 'COMPLETADO' : 'PARCIAL';
      const nuevoEstadoReserva = reserva.estadoReserva === 'PENDIENTE' ? 'CONFIRMADA' : reserva.estadoReserva;

      // HU-09: Protección de concurrencia entre pago y cancelación (Optimistic Locking atómico)
      const updateReserva = await tx.reserva.updateMany({
        where: {
          id: idReserva,
          estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA'] },
          saldoPendiente: reserva.saldoPendiente
        },
        data: {
          montoAdelanto: nuevoTotalAdelanto,
          saldoPendiente: nuevoSaldo,
          estadoPago: nuevoEstadoPago,
          estadoReserva: nuevoEstadoReserva
        }
      });

      if (updateReserva.count === 0) {
        const err = new Error('Conflicto de concurrencia: La reserva fue cancelada o modificada por otra operación simultánea.');
        err.statusCode = 409;
        throw err;
      }

      // 1. Guardar el pago en pagos_reserva con restricción de idempotencia
      const nuevoPago = await tx.pagoReserva.create({
        data: {
          idReserva,
          monto: montoNum,
          medioPago: medioNormalizado,
          referenciaOperacion: refLimpia,
          idUsuarioRegistra,
          idempotencyKey: stableIdempotencyKey,
          observaciones: observaciones ? observaciones.trim() : null
        }
      });

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
        error: 'Conflicto de idempotencia: Ya se registró un pago con la misma referencia o clave de operación.'
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

/**
 * HU-10: Consultar el seguimiento de un pedido por código (Público)
 * Escenario 1: Muestra estado del pedido, fecha estimada y modalidad de entrega
 * Escenario 2: Si el código no existe, informa que no se encontró el pedido
 */
const consultarSeguimientoPublico = async (req, res) => {
  try {
    const { codigo } = req.params;

    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ error: 'Debe ingresar un código de seguimiento válido.' });
    }

    const codigoLimpio = codigo.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,35}$/.test(codigoLimpio)) {
      return res.status(400).json({ error: 'Formato de código de seguimiento inválido.' });
    }

    const reserva = await prisma.reserva.findUnique({
      where: { codigoSeguimiento: codigoLimpio },
      include: {
        producto: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            categoria: true,
            escala: true,
            marca: true,
            precio: true,
            imagenUrl: true
          }
        },
        unidadInventario: {
          select: {
            id: true,
            codigoSerie: true,
            estadoStock: true
          }
        }
      }
    });

    // HU-10 Escenario 2: Consultar un código inexistente
    if (!reserva) {
      return res.status(404).json({
        error: 'No se encontró ningún pedido asociado con el código ingresado. Verifique el código e intente nuevamente.'
      });
    }

    // Modalidad legible para el cliente (sin paréntesis redundantes)
    const modalidadesTexto = {
      RETIRO_FERIA: '🎪 Entrega Presencial',
      RETIRO_TIENDA: '🏪 Retiro en Almacén / Tienda',
      ENVIO_LIMA: '🚕 Envío Local',
      ENVIO_PROVINCIA: '📦 Envío por Agencia / Courier'
    };

    const estadosEntregaTexto = {
      PENDIENTE_PREPARACION: 'En preparación de paquete en almacén',
      LISTO_PARA_ENTREGA: 'Listo para recojo en feria / entrega',
      EN_TRANSITO: 'En camino / Despachado por courier',
      ENTREGADO: 'Entregado al comprador'
    };

    // HU-10 Escenario 1 & HU10-P01: Información estructurada con fecha estimada y modalidad protegida de datos financieros/series privadas
    return res.status(200).json({
      codigoSeguimiento: reserva.codigoSeguimiento,
      estadoReserva: reserva.estadoReserva,
      estadoEntrega: reserva.estadoEntrega,
      estadoEntregaDescripcion: estadosEntregaTexto[reserva.estadoEntrega] || reserva.estadoEntrega,
      modalidadEntrega: reserva.modalidadEntrega,
      modalidadEntregaDescripcion: modalidadesTexto[reserva.modalidadEntrega] || reserva.modalidadEntrega,
      fechaEstimadaEntrega: reserva.fechaEstimadaEntrega,
      guiaCourier: reserva.guiaCourier,
      fechaReserva: reserva.fechaReserva,
      producto: reserva.producto,
      montoTotal: Number(reserva.montoTotal || 0),
      montoAdelanto: Number(reserva.montoAdelanto || 0),
      saldoPendiente: Number(reserva.saldoPendiente || 0),
      estadoPago: reserva.estadoPago
    });
  } catch (error) {
    console.error('[ReservaController.consultarSeguimientoPublico] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al consultar el seguimiento del pedido.')
    });
  }
};

/**
 * HU-10 Escenario 3: Actualizar el estado de entrega y modalidad (Staff)
 */
const actualizarEstadoEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const { modalidadEntrega, estadoEntrega, fechaEstimadaEntrega, guiaCourier, direccionEntrega } = req.body;

    const idReserva = parseInt(id);
    if (isNaN(idReserva) || idReserva <= 0) {
      return res.status(400).json({ error: 'ID de reserva inválido.' });
    }

    const modalidadesValidas = ['RETIRO_FERIA', 'RETIRO_TIENDA', 'ENVIO_LIMA', 'ENVIO_PROVINCIA'];
    if (modalidadEntrega && !modalidadesValidas.includes(modalidadEntrega)) {
      return res.status(400).json({
        error: `Modalidad de entrega no válida. Opciones: ${modalidadesValidas.join(', ')}.`
      });
    }

    const estadosValidos = ['PENDIENTE_PREPARACION', 'LISTO_PARA_ENTREGA', 'EN_TRANSITO', 'ENTREGADO'];
    if (estadoEntrega && !estadosValidos.includes(estadoEntrega)) {
      return res.status(400).json({
        error: `Estado de entrega no válido. Opciones: ${estadosValidos.join(', ')}.`
      });
    }

    // HU10-P04: Validar fecha estimada de entrega (formato válido y no anterior a la fecha actual)
    if (fechaEstimadaEntrega) {
      const fParsed = new Date(fechaEstimadaEntrega);
      if (isNaN(fParsed.getTime())) {
        return res.status(400).json({ error: 'La fecha estimada de entrega proporcionada no es válida.' });
      }
      // Comparar por cadena YYYY-MM-DD en zona horaria Perú (UTC-5) para impedir fechas pasadas
      const fechaInputYMD = String(fechaEstimadaEntrega).slice(0, 10);
      const ahoraPeru = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const hoyPeruYMD = ahoraPeru.toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaInputYMD) && fechaInputYMD < hoyPeruYMD) {
        return res.status(400).json({
          error: 'La fecha estimada de entrega no puede ser anterior al día de hoy.'
        });
      }
    }

    const dataToUpdate = {};
    if (modalidadEntrega) dataToUpdate.modalidadEntrega = modalidadEntrega;
    if (estadoEntrega) dataToUpdate.estadoEntrega = estadoEntrega;
    if (fechaEstimadaEntrega !== undefined) dataToUpdate.fechaEstimadaEntrega = fechaEstimadaEntrega ? new Date(fechaEstimadaEntrega) : null;
    if (guiaCourier !== undefined) dataToUpdate.guiaCourier = guiaCourier ? guiaCourier.trim() : null;
    if (direccionEntrega !== undefined) dataToUpdate.direccionEntrega = direccionEntrega ? direccionEntrega.trim() : null;

    const ORDEN_ETAPAS_ENTREGA = {
      PENDIENTE_PREPARACION: 1,
      LISTO_PARA_ENTREGA: 2,
      EN_TRANSITO: 3,
      ENTREGADO: 4
    };

    // Si la entrega pasa a ENTREGADO, sincronizar inventario si aún no está vendido
    const resultado = await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id: idReserva }
      });

      if (!reserva) {
        const err = new Error('La reserva a actualizar no existe.');
        err.statusCode = 404;
        throw err;
      }

      // HU10-P02: Impedir despacho/entrega en reservas canceladas o expiradas
      if (reserva.estadoReserva === 'CANCELADA' || reserva.estadoReserva === 'EXPIRADA') {
        const err = new Error(`No se puede modificar la entrega de una reserva que se encuentra ${reserva.estadoReserva}.`);
        err.statusCode = 400;
        throw err;
      }

      // HU10-P03: Impedir retroceder a cualquier etapa anterior de entrega
      if (estadoEntrega && reserva.estadoEntrega) {
        const etapaActualNum = ORDEN_ETAPAS_ENTREGA[reserva.estadoEntrega] || 1;
        const etapaNuevaNum = ORDEN_ETAPAS_ENTREGA[estadoEntrega] || 1;
        if (etapaNuevaNum < etapaActualNum) {
          const err = new Error(
            reserva.estadoEntrega === 'ENTREGADO'
              ? 'Operación inválida: El pedido ya fue registrado como ENTREGADO. No se puede revertir el estado de entrega.'
              : 'Operación inválida: No se puede retroceder el estado de entrega a una etapa anterior.'
          );
          err.statusCode = 400;
          throw err;
        }
      }

      if (estadoEntrega === 'ENTREGADO') {
        const saldoActual = parseFloat(reserva.saldoPendiente || 0);
        if (saldoActual > 0) {
          const err = new Error(
            `Operación denegada: No se puede registrar el pedido como ENTREGADO mientras tenga saldo pendiente (Saldo actual: S/ ${saldoActual.toFixed(2)}). Primero liquide el saldo en "💰 Abonar".`
          );
          err.statusCode = 400;
          throw err;
        }

        dataToUpdate.estadoReserva = 'ENTREGADA';
        if (!reserva.idUnidad) {
          const err = new Error('No se puede entregar una reserva que no cuenta con una unidad física asignada.');
          err.statusCode = 400;
          throw err;
        }

        const unidadActual = await tx.inventarioUnidad.findUnique({
          where: { id: reserva.idUnidad }
        });

        if (!unidadActual) {
          const err = new Error('La unidad física asignada a esta reserva ya no existe en el inventario.');
          err.statusCode = 409;
          throw err;
        }

        // Si la unidad aún está en RESERVADO, pasarla atómicamente a VENDIDO.
        // Si ya estaba en VENDIDO porque la entrega ya había sido marcada como ENTREGADO antes, permitir actualizar datos sin error.
        if (unidadActual.estadoStock === 'RESERVADO') {
          const asignacion = await tx.inventarioUnidad.updateMany({
            where: {
              id: reserva.idUnidad,
              estadoStock: 'RESERVADO'
            },
            data: { estadoStock: 'VENDIDO' }
          });

          if (asignacion.count === 0) {
            const err = new Error('Conflicto de inventario: La unidad física asignada ya no se encuentra en estado RESERVADO.');
            err.statusCode = 409;
            throw err;
          }
        } else if (unidadActual.estadoStock !== 'VENDIDO') {
          const err = new Error(
            `Inconsistencia de inventario: La unidad física (Serie: ${unidadActual.codigoSerie}) se encuentra en estado "${unidadActual.estadoStock}".`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      const actualizada = await tx.reserva.update({
        where: { id: idReserva },
        data: dataToUpdate,
        include: {
          producto: true,
          unidadInventario: true
        }
      });

      return actualizada;
    });

    return res.status(200).json({
      mensaje: `Seguimiento de entrega actualizado correctamente para el pedido ${resultado.codigoSeguimiento}.`,
      reserva: resultado
    });
  } catch (error) {
    console.error('[ReservaController.actualizarEstadoEntrega] Error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al actualizar el estado de entrega.')
    });
  }
};

/**
 * HU-02 & HU-06: Registro atómico de reservas múltiples (all-or-nothing sin confirmaciones parciales)
 */
const crearReservasEnMasa = async (req, res) => {
  try {
    const { items, nombreCliente, telefonoCliente, emailCliente, notas, idUsuario: bodyIdUsuario } = req.body;

    const esStaffOperador = req.usuario && ['SUPERADMIN', 'ADMIN'].includes(req.usuario.rol);
    const idUsuario = req.usuario ? Number(req.usuario.id) : (bodyIdUsuario && Number.isInteger(Number(bodyIdUsuario)) ? Number(bodyIdUsuario) : null);
    const nombreFinal = (!esStaffOperador && req.usuario?.nombre)
      ? req.usuario.nombre.replace(/\s*\((Google|Local)\)/gi, '').trim()
      : (nombreCliente ? nombreCliente.trim() : '');
    const emailFinal = (!esStaffOperador && req.usuario?.email)
      ? req.usuario.email.trim().toLowerCase()
      : (emailCliente ? emailCliente.trim().toLowerCase() : null);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La lista de productos para reservar no puede estar vacía.' });
    }

    if (!nombreFinal) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    if (!telefonoCliente || !telefonoCliente.trim()) {
      return res.status(400).json({ error: 'El teléfono/WhatsApp es obligatorio.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const reservasCreadas = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const idProd = parseInt(item.idProducto || item.id);
        if (isNaN(idProd) || idProd <= 0) {
          const err = new Error(`ID de producto inválido en el ítem #${i + 1}.`);
          err.statusCode = 400;
          throw err;
        }

        const producto = await tx.producto.findUnique({
          where: { id: idProd }
        });

        if (!producto) {
          const err = new Error(`El producto #${idProd} no existe.`);
          err.statusCode = 404;
          throw err;
        }

        // Buscar una unidad DISPONIBLE
        const unidadDisponible = await tx.inventarioUnidad.findFirst({
          where: {
            idProducto: idProd,
            estadoStock: 'DISPONIBLE',
            reservas: {
              none: { estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA'] } }
            }
          }
        });

        if (!unidadDisponible) {
          const err = new Error(
            `No se pudo completar la reserva múltiple: el kit "${producto.nombre}" ya no cuenta con unidades disponibles en stock. Toda la operación fue cancelada para evitar confirmaciones parciales.`
          );
          err.statusCode = 400;
          throw err;
        }

        // Asignación atómica de la unidad
        const asignacion = await tx.inventarioUnidad.updateMany({
          where: {
            id: unidadDisponible.id,
            estadoStock: 'DISPONIBLE'
          },
          data: { estadoStock: 'RESERVADO' }
        });

        if (asignacion.count === 0) {
          const err = new Error(`Conflicto de concurrencia al reservar "${producto.nombre}". Intente nuevamente.`);
          err.statusCode = 409;
          throw err;
        }

        const precio = Math.round(parseFloat(producto.precio) * 100) / 100;
        const rawAdelanto = item.adelantoAsignado ?? item.montoAdelanto ?? 0;
        const adelanto = Math.round(Number(rawAdelanto) * 100) / 100;
        if (isNaN(adelanto) || !isFinite(adelanto) || adelanto < 0 || adelanto > precio) {
          const err = new Error(`Adelanto inválido para "${producto.nombre}". Debe estar entre S/ 0.00 y S/ ${precio.toFixed(2)}.`);
          err.statusCode = 400;
          throw err;
        }
        const saldo = Math.round((precio - adelanto) * 100) / 100;
        const codigoSeguimiento = `RES-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 1000)}`;

        const estadoInicial = adelanto > 0 ? 'CONFIRMADA' : 'PENDIENTE';
        const estadoPagoInicial = saldo === 0 ? 'COMPLETADO' : (adelanto > 0 ? 'PARCIAL' : 'PENDIENTE');
        const fechaLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const nuevaReserva = await tx.reserva.create({
          data: {
            codigoSeguimiento,
            idProducto: idProd,
            idUnidad: unidadDisponible.id,
            idUsuario,
            nombreCliente: nombreFinal,
            telefonoCliente: telefonoCliente.trim(),
            emailCliente: emailFinal,
            montoTotal: precio,
            montoAdelanto: adelanto,
            saldoPendiente: saldo,
            estadoReserva: estadoInicial,
            estadoPago: estadoPagoInicial,
            fechaLimite,
            notas: notas ? notas.trim() : null
          },
          include: {
            producto: true,
            unidadInventario: {
              select: { id: true, codigoSerie: true, estadoStock: true }
            }
          }
        });

        if (adelanto > 0) {
          await tx.pagoReserva.create({
            data: {
              idReserva: nuevaReserva.id,
              monto: adelanto,
              medioPago: (item.medioPago || 'YAPE').toUpperCase(),
              referenciaOperacion: `Adelanto inicial múltiple`,
              idUsuarioRegistra: idUsuario,
              idempotencyKey: `bulk_init_${nuevaReserva.id}_${Date.now()}_${i}`
            }
          });
        }

        reservasCreadas.push(nuevaReserva);
      }

      return reservasCreadas;
    });

    return res.status(201).json({
      mensaje: `¡Reserva múltiple procesada exitosamente! Se confirmaron ${resultado.length} unidades sin reservas parciales.`,
      reservas: resultado
    });
  } catch (error) {
    console.error('[ReservaController.crearReservasEnMasa] Error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al procesar la reserva múltiple.')
    });
  }
};

module.exports = {
  crearReserva,
  crearReservasEnMasa,
  obtenerReservas,
  obtenerMisReservas,
  actualizarEstadoReserva,
  registrarPagoReserva,
  obtenerHistorialPagos,
  consultarSeguimientoPublico,
  actualizarEstadoEntrega
};
