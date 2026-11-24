const prisma = require('../lib/prisma');
const crypto = require('crypto');

/**
 * Genera un código correlativo único para ventas con CSPRNG: VTA-2026-XXXX
 */
function generarCodigoVenta() {
  const anio = new Date().getFullYear();
  const random = crypto.randomInt(1000, 10000);
  return `VTA-${anio}-${random}`;
}

/**
 * Sanitiza mensajes de error técnicos para no exponer detalles internos
 */
function sanitizarError(error, defaultMsg = 'Ocurrió un error al procesar la venta.') {
  if (error.code === 'P2002') {
    return 'Conflicto de unicidad al registrar la venta. Intente nuevamente.';
  }
  if (error.code && error.code.startsWith('P')) {
    return 'Inconsistencia en la base de datos al registrar la transacción.';
  }
  // Si es un mensaje de validación o regla de negocio explícita, entregarlo al usuario
  if (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('node_modules') && !error.message.includes(':\\')) {
    return error.message;
  }
  return defaultMsg;
}

/**
 * HU-05 / PTLJ-3: Registrar venta multicanal
 * Cumple con P01 (Concurrencia atómica), P02 (Validación de precio y regla HU-13),
 * P03 (Validación estricta de cantidad), P04 (Consolidación de items repetidos),
 * P05 (Trazabilidad inmutable de series) y P11 (Códigos HTTP diferenciados).
 */
const registrarVenta = async (req, res) => {
  try {
    const {
      canal,
      medioPago,
      clienteRef,
      telefonoCliente,
      emailCliente,
      observaciones,
      items
    } = req.body;

    // Validación básica de canal
    const canalesValidos = ['TIKTOK', 'FACEBOOK', 'FERIA', 'WEB', 'WHATSAPP', 'OTRO'];
    const canalNormalizado = (canal || 'FERIA').toString().trim().toUpperCase();
    if (!canalesValidos.includes(canalNormalizado)) {
      return res.status(400).json({
        error: `Canal de venta no válido. Opciones permitidas: ${canalesValidos.join(', ')}.`
      });
    }

    // Validación básica de medio de pago
    const mediosValidos = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];
    const medioNormalizado = (medioPago || 'EFECTIVO').toString().trim().toUpperCase();
    if (!mediosValidos.includes(medioNormalizado)) {
      return res.status(400).json({
        error: `Medio de pago no válido. Opciones permitidas: ${mediosValidos.join(', ')}.`
      });
    }

    // Validación estructural de items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Debe incluir al menos un producto en la venta.'
      });
    }

    // P03 & P04: Consolidación y validación estricta de items
    // Evita truncamiento por parseInt (ej: "2abc", 2.5, 0) y agrupa productos repetidos
    const mapaConsolidado = new Map();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          error: `El producto en la línea ${i + 1} tiene un formato inválido.`
        });
      }

      // Validar idProducto como entero positivo
      const rawId = item.idProducto;
      const idNum = Number(rawId);
      if (!Number.isInteger(idNum) || idNum <= 0) {
        return res.status(400).json({
          error: `El ID de producto en la línea ${i + 1} debe ser un número entero positivo (recibido: "${rawId}").`
        });
      }

      // P03: Validar cantidad estricta (no parseInt ni || 1)
      const rawCant = item.cantidad;
      if (rawCant === undefined || rawCant === null || typeof rawCant === 'boolean') {
        return res.status(400).json({
          error: `La cantidad es obligatoria para el producto en la línea ${i + 1}.`
        });
      }

      // Rechazar strings que contengan letras, decimales o valores no finitos
      if (typeof rawCant === 'string' && !/^\d+$/.test(rawCant.trim())) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idNum} debe ser un número entero positivo sin decimales ni caracteres (recibido: "${rawCant}").`
        });
      }

      const cantNum = Number(rawCant);
      if (!Number.isInteger(cantNum) || cantNum <= 0) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idNum} debe ser un número entero mayor a cero (recibido: "${rawCant}").`
        });
      }

      // P02: Validar precio unitario si se especifica manualmente
      let precioManual = null;
      if (item.precioUnitario !== undefined && item.precioUnitario !== null && item.precioUnitario !== '') {
        const pNum = Number(item.precioUnitario);
        if (isNaN(pNum) || !isFinite(pNum) || pNum <= 0) {
          return res.status(400).json({
            error: `El precio unitario para el producto ID ${idNum} debe ser un número positivo finito (recibido: "${item.precioUnitario}").`
          });
        }
        precioManual = Math.round(pNum * 100) / 100;
      }

      // P04: Consolidar para evitar doble selección de las mismas unidades físicas
      if (mapaConsolidado.has(idNum)) {
        const existente = mapaConsolidado.get(idNum);
        existente.cantidad += cantNum;
        if (precioManual !== null && existente.precioManual !== null && existente.precioManual !== precioManual) {
          return res.status(400).json({
            error: `Conflicto de precios para el producto ID ${idNum}: se enviaron precios diferentes en distintas líneas. Consolide la solicitud.`
          });
        }
        if (precioManual !== null) existente.precioManual = precioManual;
      } else {
        mapaConsolidado.set(idNum, {
          idProducto: idNum,
          cantidad: cantNum,
          precioManual
        });
      }
    }

    const itemsAProcesar = Array.from(mapaConsolidado.values());
    const idUsuarioVendedor = req.usuario ? req.usuario.id : null;

    // Transacción ACID atómica
    const ventaCreada = await prisma.$transaction(async (tx) => {
      let montoTotalCalculado = 0;
      const detallesAInsertar = [];

      for (const item of itemsAProcesar) {
        // Verificar producto en catálogo
        const producto = await tx.producto.findUnique({
          where: { id: item.idProducto }
        });

        if (!producto || producto.estado !== 'ACTIVO') {
          const err = new Error(`El producto con ID ${item.idProducto} no existe o se encuentra inactivo.`);
          err.statusCode = 404;
          throw err;
        }

        // HU-05 Escenario 2 & P01: Buscar unidades físicas estrictamente DISPONIBLES y sin reservas activas
        const unidadesDisponibles = await tx.inventarioUnidad.findMany({
          where: {
            idProducto: item.idProducto,
            estadoStock: 'DISPONIBLE',
            reservas: {
              none: {
                estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA'] }
              }
            }
          },
          take: item.cantidad
        });

        if (unidadesDisponibles.length < item.cantidad) {
          const err = new Error(
            `Stock disponible insuficiente para "${producto.nombre}". Se solicitaron ${item.cantidad} unidad(es), pero solo hay ${unidadesDisponibles.length} disponible(s). Las demás unidades pueden estar reservadas por otro cliente o agotadas.`
          );
          err.statusCode = 409; // HTTP 409 Conflict
          throw err;
        }

        // P02: Validar precio de venta vs costo de adquisición específico de las unidades asignadas (HU-13 / P02)
        let precioFinal = item.precioManual !== null ? item.precioManual : parseFloat(producto.precio);

        for (const u of unidadesDisponibles) {
          let costoRef = null;
          if (u.costoUnitario) {
            costoRef = parseFloat(u.costoUnitario);
          } else if (producto.costoUnitario) {
            costoRef = parseFloat(producto.costoUnitario);
          }

          if (costoRef !== null && precioFinal < costoRef) {
            const err = new Error(
              `El precio de venta (S/ ${precioFinal.toFixed(2)}) para "${producto.nombre}" (Serie: ${u.codigoSerie}) no puede ser inferior a su costo de adquisición (S/ ${costoRef.toFixed(2)}) conforme a la política de margen (HU-13).`
            );
            err.statusCode = 400;
            throw err;
          }
        }

        const subtotal = Math.round(precioFinal * item.cantidad * 100) / 100;
        montoTotalCalculado += subtotal;

        // P05: Registrar series físicas inmutables para trazabilidad histórica
        const codigosSeries = unidadesDisponibles.map(u => u.codigoSerie);

        detallesAInsertar.push({
          idProducto: item.idProducto,
          nombreProducto: producto.nombre,
          cantidad: item.cantidad,
          precioUnitario: precioFinal,
          subtotal,
          unidadesIds: unidadesDisponibles.map(u => u.id),
          seriesVendidas: codigosSeries.join(', ')
        });
      }

      // Generar código único de venta VTA-2026-XXXX
      let codigoVenta = generarCodigoVenta();
      let existeCodigo = await tx.venta.findUnique({ where: { codigoVenta } });
      while (existeCodigo) {
        codigoVenta = generarCodigoVenta();
        existeCodigo = await tx.venta.findUnique({ where: { codigoVenta } });
      }

      // 1. Crear cabecera de la venta
      const venta = await tx.venta.create({
        data: {
          codigoVenta,
          canal: canalNormalizado,
          medioPago: medioNormalizado,
          montoTotal: Math.round(montoTotalCalculado * 100) / 100,
          clienteRef: clienteRef ? clienteRef.trim() : null,
          telefonoCliente: telefonoCliente ? telefonoCliente.trim() : null,
          emailCliente: emailCliente ? emailCliente.trim().toLowerCase() : null,
          observaciones: observaciones ? observaciones.trim() : null,
          idUsuarioVendedor,
          estado: 'COMPLETADA'
        }
      });

      // 2. Crear detalles y actualizar stock con verificación atómica de concurrencia (P01)
      for (const detalleInfo of detallesAInsertar) {
        const detalle = await tx.ventaDetalle.create({
          data: {
            idVenta: venta.id,
            idProducto: detalleInfo.idProducto,
            cantidad: detalleInfo.cantidad,
            precioUnitario: detalleInfo.precioUnitario,
            subtotal: detalleInfo.subtotal,
            seriesVendidas: detalleInfo.seriesVendidas
          }
        });

        // P01: Actualizar estrictamente verificando que sigan en DISPONIBLE al momento del UPDATE
        const asignacion = await tx.inventarioUnidad.updateMany({
          where: {
            id: { in: detalleInfo.unidadesIds },
            estadoStock: 'DISPONIBLE'
          },
          data: {
            estadoStock: 'VENDIDO',
            idVentaDetalle: detalle.id
          }
        });

        // Si alguna unidad fue tomada concurrentemente por otra transacción, abortar inmediatamente
        if (asignacion.count !== detalleInfo.unidadesIds.length) {
          const err = new Error(
            `Conflicto de concurrencia: una o más unidades de "${detalleInfo.nombreProducto}" fueron vendidas o reservadas en simultáneo por otra operación. Se abortó la transacción para evitar doble asignación.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      return venta;
    });

    // Retornar la venta completa con relaciones
    const ventaCompleta = await prisma.venta.findUnique({
      where: { id: ventaCreada.id },
      include: {
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                categoria: true,
                escala: true,
                marca: true,
                imagenUrl: true
              }
            },
            unidadesVendidas: {
              select: {
                id: true,
                codigoSerie: true
              }
            }
          }
        },
        vendedor: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true
          }
        }
      }
    });

    return res.status(201).json({
      mensaje: 'Venta registrada exitosamente y stock descontado.',
      venta: ventaCompleta
    });
  } catch (error) {
    console.error('[ventaController.registrarVenta] Detalle:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'No se pudo completar el registro de la venta.')
    });
  }
};

/**
 * HU-05 / Escenario 3: Consultar historial de ventas
 */
const listarVentas = async (req, res) => {
  try {
    const { canal, fechaInicio, fechaFin, estado } = req.query;

    const where = {};

    if (canal && canal !== 'TODOS') {
      where.canal = canal.toUpperCase();
    }

    if (estado && estado !== 'TODOS') {
      where.estado = estado.toUpperCase();
    }

    if (fechaInicio || fechaFin) {
      where.fechaVenta = {};
      if (fechaInicio) {
        where.fechaVenta.gte = new Date(fechaInicio);
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        where.fechaVenta.lte = fin;
      }
    }

    const ventas = await prisma.venta.findMany({
      where,
      orderBy: { fechaVenta: 'desc' },
      include: {
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                categoria: true,
                escala: true,
                marca: true,
                imagenUrl: true
              }
            },
            unidadesVendidas: {
              select: {
                id: true,
                codigoSerie: true
              }
            }
          }
        },
        vendedor: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    });

    const totalMonto = ventas
      .filter(v => v.estado === 'COMPLETADA')
      .reduce((acc, curr) => acc + Number(curr.montoTotal), 0);

    const totalUnidades = ventas
      .filter(v => v.estado === 'COMPLETADA')
      .reduce((acc, v) => acc + v.detalles.reduce((dAcc, d) => dAcc + d.cantidad, 0), 0);

    return res.status(200).json({
      totalRegistros: ventas.length,
      resumen: {
        totalMontoRecaudado: Math.round(totalMonto * 100) / 100,
        totalUnidadesVendidas: totalUnidades
      },
      ventas
    });
  } catch (error) {
    console.error('[ventaController.listarVentas] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al consultar el historial de ventas.')
    });
  }
};

/**
 * Obtener detalle de una venta por ID o Código
 */
const obtenerVentaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const where = !isNaN(parseInt(id))
      ? { id: parseInt(id) }
      : { codigoVenta: id.toUpperCase() };

    const venta = await prisma.venta.findUnique({
      where,
      include: {
        detalles: {
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
            unidadesVendidas: {
              select: {
                id: true,
                codigoSerie: true,
                costoUnitario: true
              }
            }
          }
        },
        vendedor: {
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true
          }
        }
      }
    });

    if (!venta) {
      return res.status(404).json({ error: 'La venta solicitada no existe.' });
    }

    return res.status(200).json(venta);
  } catch (error) {
    console.error('[ventaController.obtenerVentaPorId] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al obtener la venta.')
    });
  }
};

/**
 * P06: Anular una venta con motivo obligatorio, protección de concurrencia y conservación de series
 */
const anularVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const idVenta = parseInt(id);
    if (isNaN(idVenta) || idVenta <= 0) {
      return res.status(400).json({ error: 'ID de venta inválido para anulación.' });
    }

    // P06: Motivo obligatorio en backend para auditoría
    if (!motivo || !motivo.toString().trim()) {
      return res.status(400).json({
        error: 'El motivo de anulación es obligatorio para registrar la trazabilidad de la operación.'
      });
    }

    const motivoLimpio = motivo.toString().trim();

    await prisma.$transaction(async (tx) => {
      // P06: Actualización condicional atómica para evitar anulación simultánea doble
      const transicion = await tx.venta.updateMany({
        where: {
          id: idVenta,
          estado: 'COMPLETADA'
        },
        data: {
          estado: 'ANULADA',
          observaciones: motivoLimpio
        }
      });

      if (transicion.count === 0) {
        // Verificar motivo del fallo
        const ventaActual = await tx.venta.findUnique({ where: { id: idVenta } });
        if (!ventaActual) {
          const err = new Error('La venta que intenta anular no existe.');
          err.statusCode = 404;
          throw err;
        }
        if (ventaActual.estado === 'ANULADA') {
          const err = new Error('Esta venta ya se encuentra anulada. No se puede anular nuevamente.');
          err.statusCode = 409;
          throw err;
        }
        const err = new Error('No se puede anular la venta en su estado actual.');
        err.statusCode = 400;
        throw err;
      }

      // Obtener las unidades físicas que actualmente siguen asignadas a esta venta
      const detalles = await tx.ventaDetalle.findMany({
        where: { idVenta },
        include: { unidadesVendidas: true }
      });

      const unidadesIdsParaLiberar = [];
      for (const det of detalles) {
        for (const u of det.unidadesVendidas) {
          unidadesIdsParaLiberar.push(u.id);
        }
      }

      // P05: Revertir las unidades físicas a DISPONIBLE, pero VentaDetalle.seriesVendidas
      // conserva la lista inmutable de códigos de serie para auditoría histórica
      if (unidadesIdsParaLiberar.length > 0) {
        await tx.inventarioUnidad.updateMany({
          where: {
            id: { in: unidadesIdsParaLiberar },
            estadoStock: 'VENDIDO'
          },
          data: {
            estadoStock: 'DISPONIBLE',
            idVentaDetalle: null
          }
        });
      }
    });

    return res.status(200).json({
      mensaje: 'Venta anulada con éxito y stock devuelto a Disponible. Se conservó el registro histórico de las series.'
    });
  } catch (error) {
    console.error('[ventaController.anularVenta] Error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al anular la venta.')
    });
  }
};

module.exports = {
  registrarVenta,
  listarVentas,
  obtenerVentaPorId,
  anularVenta
};
