const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const registrarLoteConUnidades = async (req, res) => {
  try {
    const { codigoLote, proveedor, observaciones, idProducto, cantidad, costoUnitario } = req.body;

    // PTLJ-28: Validación de cantidad obligatoria
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ 
        error: "La cantidad es obligatoria y debe ser mayor a 0." 
      });
    }

    if (!codigoLote || !idProducto) {
      return res.status(400).json({ 
        error: "El código de lote y el idProducto son obligatorios." 
      });
    }

    // Transacción de Prisma para asegurar integridad
    const resultado = await prisma.$transaction(async (tx) => {
      // PTLJ-26: Registrar la recepción del lote
      const nuevoLote = await tx.loteIngreso.create({
        data: {
          codigoLote,
          proveedor,
          observaciones,
          estadoLote: 'RECIBIDO',
          fechaLlegada: new Date()
        }
      });

      // PTLJ-27: Generar automáticamente las unidades de inventario por lote
      const unidadesAcrear = [];
      for (let i = 1; i <= cantidad; i++) {
        const codigoSerie = `${codigoLote}-ITEM-${i.toString().padStart(4, '0')}`;

        unidadesAcrear.push({
          idProducto: Number(idProducto),
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
        unidadesGeneradas: cantidad
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
    return res.status(500).json({ error: "Error interno del servidor al procesar el lote." });
  }
};

module.exports = {
  registrarLoteConUnidades
};