const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Genera un código correlativo único para ventas: VTA-2026-XXXX
 */
function generarCodigoVenta() {
  const anio = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
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
  if (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('C:\\') && !error.message.includes('/')) {
    return error.message;
  }
  return defaultMsg;
}

/**
 * HU-05 / Escenario 1 y 2: Registrar una venta multicanal
 * Valida disponibilidad atómica de stock, impide vender unidades reservadas o agotadas,
 * y descuenta el stock pasando las unidades a VENDIDO.
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
    const canalNormalizado = (canal || 'FERIA').toUpperCase();
    if (!canalesValidos.includes(canalNormalizado)) {
      return res.status(400).json({
        error: `Canal de venta no válido. Opciones permitidas: ${canalesValidos.join(', ')}.`
      });
    }

    // Validación básica de medio de pago
    const mediosValidos = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO'];
    const medioNormalizado = (medioPago || 'EFECTIVO').toUpperCase();
    if (!mediosValidos.includes(medioNormalizado)) {
      return res.status(400).json({
        error: `Medio de pago no válido. Opciones permitidas: ${mediosValidos.join(', ')}.`
      });
    }

    // Validación de items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Debe incluir al menos un producto en la venta.'
      });
    }

    // Obtener ID del vendedor si está autenticado en la sesión
    const idUsuarioVendedor = req.usuario ? req.usuario.id : null;

    // Ejecutar la venta en una transacción ACID atómica
    const ventaCreada = await prisma.$transaction(async (tx) => {
      let montoTotalCalculado = 0;
      const preparacionLineas = [];

      // Validar cada producto y verificar disponibilidad de stock real (no reservado)
      for (const item of items) {
        const idProd = parseInt(item.idProducto);
        const cant = parseInt(item.cantidad || 1);

        if (isNaN(idProd) || cant <= 0) {
          throw new Error('Cada producto debe tener un ID válido y una cantidad mayor a cero.');
        }

        const producto = await tx.producto.findUnique({
          where: { id: idProd }
        });

        if (!producto || producto.estado !== 'ACTIVO') {
          throw new Error(`El producto con ID ${idProd} no existe o no está activo en el catálogo.`);
        }

        // HU-05 Escenario 2: Buscar unidades físicas estrictamente DISPONIBLES
        // Si una unidad está en RESERVADO, no será seleccionada
        const unidadesDisponibles = await tx.inventarioUnidad.findMany({
          where: {
            idProducto: idProd,
            estadoStock: 'DISPONIBLE'
          },
          take: cant
        });

        if (unidadesDisponibles.length < cant) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}". Se solicitaron ${cant} unidad(es), pero solo hay ${unidadesDisponibles.length} disponible(s). Las demás unidades pueden estar reservadas por otro cliente o agotadas.`
          );
        }

        const precioUnitario = item.precioUnitario !== undefined 
          ? parseFloat(item.precioUnitario) 
          : parseFloat(producto.precio);

        const subtotal = Math.round(precioUnitario * cant * 100) / 100;
        montoTotalCalculado += subtotal;

        preparacionLineas.push({
          idProducto: idProd,
          cantidad: cant,
          precioUnitario,
          subtotal,
          unidadesIds: unidadesDisponibles.map(u => u.id)
        });
      }

      // Generar código de venta único
      let codigoVenta = generarCodigoVenta();
      let existeCodigo = await tx.venta.findUnique({ where: { codigoVenta } });
      while (existeCodigo) {
        codigoVenta = generarCodigoVenta();
        existeCodigo = await tx.venta.findUnique({ where: { codigoVenta } });
      }

      // Crear la cabecera de la venta
      const venta = await tx.venta.create({
        data: {
          codigoVenta,
          canal: canalNormalizado,
          medioPago: medioNormalizado,
          montoTotal: montoTotalCalculado,
          clienteRef: clienteRef ? clienteRef.trim() : null,
          telefonoCliente: telefonoCliente ? telefonoCliente.trim() : null,
          emailCliente: emailCliente ? emailCliente.trim().toLowerCase() : null,
          observaciones: observaciones ? observaciones.trim() : null,
          idUsuarioVendedor,
          estado: 'COMPLETADA'
        }
      });

      // Crear los detalles y actualizar el inventario a VENDIDO
      for (const linea of preparacionLineas) {
        const detalle = await tx.ventaDetalle.create({
          data: {
            idVenta: venta.id,
            idProducto: linea.idProducto,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            subtotal: linea.subtotal
          }
        });

        // Actualizar las unidades físicas asignadas
        await tx.inventarioUnidad.updateMany({
          where: {
            id: { in: linea.unidadesIds }
          },
          data: {
            estadoStock: 'VENDIDO',
            idVentaDetalle: detalle.id
          }
        });
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
    console.error('[ventaController.registrarVenta] Error:', error);
    return res.status(400).json({
      error: sanitizarError(error, 'No se pudo registrar la venta.')
    });
  }
};

/**
 * HU-05 / Escenario 3: Consultar historial de ventas
 * Permite filtrar por canal, rango de fechas y estado.
 * Devuelve el canal, monto total, fecha, vendedor y las unidades físicas incluidas.
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
        // Incluir todo el día final
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

    // Calcular resumen de totales para el dashboard del admin
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
 * Anular una venta y revertir automáticamente las unidades a DISPONIBLE
 */
const anularVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(id) },
      include: {
        detalles: {
          include: {
            unidadesVendidas: true
          }
        }
      }
    });

    if (!venta) {
      return res.status(404).json({ error: 'La venta a anular no existe.' });
    }

    if (venta.estado === 'ANULADA') {
      return res.status(400).json({ error: 'La venta ya se encuentra anulada.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Obtener todas las IDs de las unidades que fueron vendidas en esta transacción
      const unidadesIds = [];
      for (const detalle of venta.detalles) {
        for (const unidad of detalle.unidadesVendidas) {
          unidadesIds.push(unidad.id);
        }
      }

      // 2. Revertir las unidades a DISPONIBLE y desvincular el detalle de venta
      if (unidadesIds.length > 0) {
        await tx.inventarioUnidad.updateMany({
          where: { id: { in: unidadesIds } },
          data: {
            estadoStock: 'DISPONIBLE',
            idVentaDetalle: null
          }
        });
      }

      // 3. Marcar la venta como ANULADA
      await tx.venta.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'ANULADA',
          observaciones: motivo 
            ? `${venta.observaciones ? venta.observaciones + ' | ' : ''}Anulada: ${motivo}`
            : venta.observaciones
        }
      });
    });

    return res.status(200).json({
      mensaje: 'Venta anulada con éxito y stock revertido a disponible.'
    });
  } catch (error) {
    console.error('[ventaController.anularVenta] Error:', error);
    return res.status(500).json({
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
