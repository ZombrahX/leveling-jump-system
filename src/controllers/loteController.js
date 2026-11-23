const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * PTLJ-26, PTLJ-27, PTLJ-28 & HU-12: Registrar la recepción de un lote con uno o múltiples productos
 * Diferencia entre fecha física de llegada (fechaLlegada) y fecha inmutable de registro (fechaCreacion).
 * Permite registrar documento de referencia (factura / guía de remisión) y múltiples líneas de productos en el mismo embarque.
 */
const registrarLoteConUnidades = async (req, res) => {
  try {
    const {
      codigoLote,
      proveedor,
      documentoReferencia,
      fechaLlegada,
      observaciones,
      idProducto,
      productoId,
      cantidad,
      costoUnitario,
      costoFleteTotal,
      items
    } = req.body;

    if (!proveedor || !proveedor.trim()) {
      return res.status(400).json({
        error: "El nombre del proveedor o distribuidor es obligatorio."
      });
    }

    // Normalizar formato multi-producto (items[]) o formato clásico de 1 producto (retrocompatible)
    let rawItems = [];
    if (Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else if (idProducto !== undefined || productoId !== undefined || cantidad !== undefined) {
      rawItems = [
        {
          idProducto: idProducto || productoId,
          cantidad,
          costoUnitario
        }
      ];
    }

    if (rawItems.length === 0) {
      return res.status(400).json({
        error: "Debe incluir al menos un producto a recibir en el lote."
      });
    }

    const itemsValidados = [];
    for (let idx = 0; idx < rawItems.length; idx++) {
      const it = rawItems[idx] || {};
      const prodId = Number(it.idProducto || it.productoId);
      if (!prodId || !Number.isInteger(prodId) || prodId <= 0) {
        return res.status(400).json({
          error: `El producto en la fila #${idx + 1} es obligatorio.`
        });
      }

      const cant = Number(it.cantidad);
      if (!cant || !Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({
          error: `La cantidad en la fila #${idx + 1} es obligatoria y debe ser un número entero mayor a 0.`
        });
      }

      const rawCosto = it.costoUnitario;
      let costoNum = null;
      if (rawCosto !== undefined && rawCosto !== null && String(rawCosto).trim() !== '') {
        costoNum = Number(rawCosto);
        if (isNaN(costoNum) || costoNum < 0) {
          return res.status(400).json({
            error: `El costo unitario en la fila #${idx + 1} no es válido.`
          });
        }
      }

      itemsValidados.push({
        idProducto: prodId,
        cantidad: cant,
        costoUnitario: costoNum
      });
    }

    const codLoteFinal = codigoLote && codigoLote.trim()
      ? codigoLote.trim()
      : `LOT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // HU-12 / P04: Fecha física de arribo vs fecha de registro del sistema
    let fechaLlegadaFinal = new Date();
    if (fechaLlegada) {
      if (typeof fechaLlegada === 'string' && fechaLlegada.includes('T')) {
        const parte = fechaLlegada.split('T')[0];
        fechaLlegadaFinal = new Date(`${parte}T12:00:00.000Z`);
      } else if (typeof fechaLlegada === 'string') {
        fechaLlegadaFinal = new Date(`${fechaLlegada}T12:00:00.000Z`);
      } else {
        fechaLlegadaFinal = new Date(fechaLlegada);
      }
    }

    // Transacción ACID para registrar la cabecera del lote y todas las unidades de los distintos productos
    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoLote = await tx.loteIngreso.create({
        data: {
          codigoLote: codLoteFinal,
          proveedor: proveedor.trim(),
          documentoReferencia: documentoReferencia ? documentoReferencia.trim() : null,
          fechaLlegada: fechaLlegadaFinal,
          costoFleteTotal: costoFleteTotal ? Number(costoFleteTotal) : null,
          observaciones: observaciones ? observaciones.trim() : null,
          estadoLote: 'RECIBIDO'
        }
      });

      const unidadesAcrear = [];
      let correlativoSerie = 1;

      for (const item of itemsValidados) {
        for (let i = 1; i <= item.cantidad; i++) {
          const codigoSerie = `${codLoteFinal}-ITEM-${correlativoSerie.toString().padStart(4, '0')}`;
          correlativoSerie++;

          unidadesAcrear.push({
            idProducto: item.idProducto,
            idLote: nuevoLote.id,
            codigoSerie,
            costoUnitario: item.costoUnitario,
            estadoStock: 'DISPONIBLE'
          });
        }
      }

      await tx.inventarioUnidad.createMany({
        data: unidadesAcrear
      });

      return {
        lote: nuevoLote,
        totalProductosDistintos: itemsValidados.length,
        unidadesGeneradas: unidadesAcrear.length
      };
    });

    return res.status(201).json({
      message: "Lote recibido y unidades de inventario generadas con éxito.",
      data: resultado
    });

  } catch (error) {
    console.error("Error al registrar lote:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "El código de lote o algún código de serie ya existe." });
    }
    const cleanError = (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('C:\\'))
      ? error.message
      : "Error interno al procesar el lote.";
    return res.status(500).json({ error: cleanError });
  }
};

/**
 * HU-12: Obtener historial de lotes recibidos incluyendo el resumen de productos por lote
 */
const obtenerLotes = async (req, res) => {
  try {
    const lotes = await prisma.loteIngreso.findMany({
      include: {
        _count: {
          select: { unidadesInventario: true }
        },
        unidadesInventario: {
          select: {
            idProducto: true,
            costoUnitario: true,
            producto: {
              select: {
                id: true,
                codigo: true,
                nombre: true
              }
            }
          }
        }
      },
      orderBy: { fechaCreacion: 'desc' }
    });

    return res.status(200).json({
      total: lotes.length,
      lotes: lotes.map(l => {
        const conteoPorProd = new Map();
        (l.unidadesInventario || []).forEach(u => {
          const pid = u.idProducto;
          if (!conteoPorProd.has(pid)) {
            conteoPorProd.set(pid, {
              idProducto: pid,
              codigo: u.producto?.codigo || '',
              nombre: u.producto?.nombre || `Producto #${pid}`,
              cantidad: 0
            });
          }
          conteoPorProd.get(pid).cantidad += 1;
        });

        const { unidadesInventario, _count, ...restoLote } = l;
        return {
          ...restoLote,
          totalUnidades: _count ? _count.unidadesInventario : 0,
          productosResumen: Array.from(conteoPorProd.values())
        };
      })
    });
  } catch (error) {
    console.error("Error al obtener historial de lotes:", error);
    return res.status(500).json({ error: "Error interno al obtener historial de lotes." });
  }
};

module.exports = {
  registrarLoteConUnidades,
  obtenerLotes
};
