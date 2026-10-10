const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const registrarLoteConUnidades = async (req, res) => {
  try {
    const { codigoLote, proveedor, observaciones, idProducto, productoId, cantidad, costoUnitario } = req.body;

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

    const codLoteFinal = codigoLote && codigoLote.trim() 
      ? codigoLote.trim() 
      : `LOT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      
    const proveedorFinal = proveedor && proveedor.trim()
      ? proveedor.trim()
      : 'Bandai Namco Importaciones';

    // Transacción de Prisma para asegurar integridad ACID
    const resultado = await prisma.$transaction(async (tx) => {
      // PTLJ-26: Registrar la recepción del lote
      const nuevoLote = await tx.loteIngreso.create({
        data: {
          codigoLote: codLoteFinal,
          proveedor: proveedorFinal,
          observaciones: observaciones ? observaciones.trim() : null,
          estadoLote: 'RECIBIDO',
          fechaLlegada: new Date()
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

module.exports = {
  registrarLoteConUnidades
};