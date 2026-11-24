const prisma = require('../lib/prisma');

// Caché en memoria para lecturas instantáneas sin sobrecargar PostgreSQL
let cacheConfig = {
  whatsappOficial: '999999999'
};
let tablaInicializada = false;

function formatearSalidaWhatsapp(rawNumero) {
  const soloDigitos = String(rawNumero || '999999999').replace(/\D/g, '');
  const sinPrefijo = soloDigitos.startsWith('51') && soloDigitos.length > 9
    ? soloDigitos.slice(2)
    : soloDigitos;
  const numeroBase = sinPrefijo || '999999999';
  const completo = `51${numeroBase}`;
  const formateado = numeroBase.length === 9
    ? `+51 ${numeroBase.slice(0, 3)} ${numeroBase.slice(3, 6)} ${numeroBase.slice(6)}`
    : `+${completo}`;

  return {
    whatsappOficial: numeroBase,
    whatsappCompleto: completo,
    whatsappFormateado: formateado
  };
}

async function asegurarTablaConfiguracion() {
  if (tablaInicializada) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.configuracion_tienda (
        clave VARCHAR(60) PRIMARY KEY,
        valor TEXT NOT NULL,
        fecha_actualizacion TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE IF EXISTS public.configuracion_tienda ENABLE ROW LEVEL SECURITY;
    `);
    tablaInicializada = true;
  } catch (err) {
    console.warn('[ConfiguracionController] Aviso al verificar tabla configuracion_tienda:', err.message);
  }
}

/**
 * GET /api/configuracion — Obtener configuración pública de la tienda (WhatsApp oficial, etc.)
 */
const obtenerConfiguracion = async (req, res) => {
  try {
    await asegurarTablaConfiguracion();
    const filas = await prisma.$queryRawUnsafe(
      `SELECT clave, valor FROM public.configuracion_tienda;`
    );

    if (Array.isArray(filas)) {
      filas.forEach(f => {
        if (f.clave === 'whatsapp_oficial' && f.valor) {
          cacheConfig.whatsappOficial = f.valor;
        }
      });
    }

    return res.status(200).json({
      ...formatearSalidaWhatsapp(cacheConfig.whatsappOficial)
    });
  } catch (error) {
    console.warn('[ConfiguracionController.obtenerConfiguracion] Usando caché por defecto:', error.message);
    return res.status(200).json({
      ...formatearSalidaWhatsapp(cacheConfig.whatsappOficial)
    });
  }
};

/**
 * PUT /api/configuracion — Actualizar configuración de la tienda (Solo ADMIN y SUPERADMIN)
 */
const actualizarConfiguracion = async (req, res) => {
  try {
    const { whatsappOficial } = req.body;

    if (!whatsappOficial || !String(whatsappOficial).trim()) {
      return res.status(400).json({ error: 'El número de WhatsApp oficial es obligatorio.' });
    }

    const soloDigitos = String(whatsappOficial).replace(/\D/g, '');
    const limpio = soloDigitos.startsWith('51') && soloDigitos.length > 9
      ? soloDigitos.slice(2)
      : soloDigitos;

    if (limpio.length < 8 || limpio.length > 12) {
      return res.status(400).json({
        error: 'Ingresa un número de celular/WhatsApp válido (ej. 9 dígitos para Perú).'
      });
    }

    await asegurarTablaConfiguracion();
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.configuracion_tienda (clave, valor, fecha_actualizacion)
       VALUES ('whatsapp_oficial', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, fecha_actualizacion = CURRENT_TIMESTAMP;`,
      limpio
    );

    cacheConfig.whatsappOficial = limpio;
    const salida = formatearSalidaWhatsapp(limpio);

    return res.status(200).json({
      mensaje: `Configuración de tienda actualizada. Nuevo WhatsApp oficial: ${salida.whatsappFormateado}`,
      ...salida
    });
  } catch (error) {
    console.error('[ConfiguracionController.actualizarConfiguracion] Error:', error.message);
    return res.status(500).json({ error: 'Error al guardar la configuración de la tienda.' });
  }
};

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion
};
