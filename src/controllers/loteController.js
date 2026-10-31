const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * PTLJ-26, PTLJ-27, PTLJ-28 & HU-12: Registrar la recepción de un lote con sus unidades de inventario
 * Diferencia entre fecha física de llegada (fechaLlegada) y fecha inmutable de registro (fechaCreacion).
 * Permite registrar documento de referencia (factura / guía de remisión).
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
      costoFleteTotal
    } = req.body;

    const cant = Number(cantidad);
    // PTLJ-28: Validación de cantidad obligatoria
    if (!cant || cant <= 0) {
      return res.status(400).json({ 
        error: "La cantidad es obligatoria y debe ser mayor a 0." 
      });
    }

    const targetProductoId = Number(idProducto || productoId);
    if (!targetProductoId) {
      return res.status(400).json({ 
        error: "El producto a recibir (idProducto) es obligatorio." 
      });
    }

    if (!proveedor || !proveedor.trim()) {
      return res.status(400).json({
        error: "El nombre del proveedor o distribuidor es obligatorio."
      });
    }

    const codLoteFinal = codigoLote && codigoLote.trim() 
      ? codigoLote.trim() 
      : `LOT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // HU-12 / P04: Fecha física de arribo vs fecha de registro del sistema
    // Si viene como YYYY-MM-DD o string, fijar a mediodía UTC (T12:00:00Z) para evitar desfases de zona horaria (UTC-5)
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

    // Transacción de Prisma para asegurar integridad ACID
    const resultado = await prisma.$transaction(async (tx) => {
      // PTLJ-26 & HU-12: Registrar la recepción del lote
      const nuevoLote = await tx.loteIngreso.create({
        data: {
          codigoLote: codLoteFinal,
          proveedor: proveedor.trim(),
          documentoReferencia: documentoReferencia ? documentoReferencia.trim() : null,
          fechaLlegada: fechaLlegadaFinal,
          costoFleteTotal: costoFleteTotal ? Number(costoFleteTotal) : null,
          observaciones: observaciones ? observaciones.trim() : null,
          estadoLote: 'RECIBIDO'
          // fechaCreacion se genera automáticamente con @default(now())
        }
      });

      // PTLJ-27: Generar automáticamente las unidades de inventario por lote
      const unidadesAcrear = [];
      for (let i = 1; i <= cant; i++) {
        const codigoSerie = `${codLoteFinal}-ITEM-${i.toString().padStart(4, '0')}`;

        unidadesAcrear.push({
          idProducto: targetProductoId,
          idLote: nuevoLote.id,
          codigoSerie,
          costoUnitario: costoUnitario ? Number(costoUnitario) : null,
          estadoStock: 'DISPONIBLE'
        });
      }

      await tx.inventarioUnidad.createMany({
        data: unidadesAcrear
      });

      return {
        lote: nuevoLote,
        unidadesGeneradas: cant
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
    return res.status(500).json({ error: "Error interno del servidor al procesar el lote: " + error.message });
  }
};

/**
 * HU-12: Obtener historial de lotes recibidos
 */
const obtenerLotes = async (req, res) => {
  try {
    const lotes = await prisma.loteIngreso.findMany({
      include: {
        _count: {
          select: { unidadesInventario: true }
        }
      },
      orderBy: { fechaCreacion: 'desc' }
    });

    return res.status(200).json({
      total: lotes.length,
      lotes: lotes.map(l => ({
        ...l,
        totalUnidades: l._count ? l._count.unidadesInventario : 0
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener historial de lotes: " + error.message });
  }
};

module.exports = {
  registrarLoteConUnidades,
  obtenerLotes
};