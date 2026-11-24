const prisma = require('../lib/prisma');
const crypto = require('crypto');

const sanitizarError = (error, defaultMsg = 'Error interno en la operación.') => {
  if (process.env.NODE_ENV === 'development') return error.message;
  if (error && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return error.message;
  }
  return defaultMsg;
};

/**
 * Verifica si una cotización pertenece al usuario autenticado o si el usuario es miembro del Staff (BOLA / IDOR protection)
 */
const verificarPropiedadCotizacion = (cotizacion, usuario) => {
  if (!usuario) return false;
  if (['SUPERADMIN', 'ADMIN', 'VENDEDOR', 'OPERADOR'].includes(usuario.rol)) {
    return true;
  }
  const rawObs = cotizacion.observaciones || '';
  if (rawObs.includes(`[UID:${Number(usuario.id)}]`)) return true;

  // Si la cotización tiene otro UID distinto al usuario autenticado, denegar acceso
  const matchUid = rawObs.match(/\[UID:(\d+)\]/);
  if (matchUid && Number(matchUid[1]) !== Number(usuario.id)) {
    return false;
  }

  const emailUser = (usuario.email || '').trim().toLowerCase();
  const emailCot = (cotizacion.emailCliente || '').trim().toLowerCase();
  if (emailUser && emailCot && emailUser === emailCot) return true;

  const nombreUser = (usuario.nombre || '').replace(/\s*\((Google|Local)\)/gi, '').trim().toLowerCase();
  const nombreCot = (cotizacion.nombreCliente || '').trim().toLowerCase();
  if (nombreUser && nombreCot && nombreUser === nombreCot) return true;

  return false;
};

/**
 * Limpia etiquetas internas de metadatos (ej. [UID:1]) de las observaciones visibles al usuario
 */
const limpiarObservacionesVisibles = (obs) => {
  if (!obs) return null;
  const limpio = obs
    .replace(/\[UID:\d+\]/g, '')
    .replace(/\[CONFIRMADA\]/g, '')
    .replace(/\[RECALCULADA\]/g, '')
    .trim();
  return limpio || null;
};

/**
 * HU-07 Escenario 1, 2 y 3: Enriquecer cotizaciones con el stock físico real disponible en almacén
 * Detecta en tiempo real si un producto cotizado se quedó sin stock (0) o sufrió reducción de stock.
 */
const enriquecerCotizacionesConStockReal = async (listaCotizaciones) => {
  if (!Array.isArray(listaCotizaciones) || listaCotizaciones.length === 0) {
    return [];
  }

  const idsProductosSet = new Set();
  listaCotizaciones.forEach(cot => {
    (cot.items || []).forEach(it => {
      if (it.idProducto) idsProductosSet.add(Number(it.idProducto));
    });
  });

  const idsProductos = Array.from(idsProductosSet);
  const productosDB = idsProductos.length > 0
    ? await prisma.producto.findMany({
        where: { id: { in: idsProductos } },
        include: {
          unidadesInventario: {
            where: {
              estadoStock: 'DISPONIBLE',
              reservas: {
                none: {
                  estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA', 'ENTREGADA'] }
                }
              }
            },
            select: { id: true }
          }
        }
      })
    : [];

  const mapaStockProducto = new Map();
  productosDB.forEach(p => {
    const disponibles = p.estado === 'ACTIVO' ? (p.unidadesInventario?.length || 0) : 0;
    mapaStockProducto.set(p.id, {
      estadoProducto: p.estado,
      stockDisponible: disponibles,
      precioActual: parseFloat(p.precio)
    });
  });

  const ahora = new Date();

  return listaCotizaciones.map(cot => {
    const rawObs = cot.observaciones || '';
    const esConfirmada = rawObs.includes('[CONFIRMADA]');
    const fueRecalculada = rawObs.includes('[RECALCULADA]');
    const esVigenteFecha = new Date(cot.fechaVencimiento) >= ahora;

    const alertasStock = [];
    let tieneSinStock = false;
    let tieneVariacionParcial = false;
    let itemsConStock = 0;
    let totalRecalculado = 0;

    const itemsEnriquecidos = (cot.items || []).map(it => {
      const infoProd = mapaStockProducto.get(Number(it.idProducto));
      const stockActual = infoProd ? infoProd.stockDisponible : 0;
      const cantSolicitada = Number(it.cantidad || 1);
      const precioUnit = parseFloat(it.precioUnitario || 0);
      const subtotalOrig = parseFloat(it.subtotal || 0);

      let estadoStockItem = 'OK';
      let mensajeAlerta = null;
      let cantidadCotizable = cantSolicitada;

      if (!infoProd || infoProd.estadoProducto !== 'ACTIVO' || stockActual === 0) {
        estadoStockItem = 'SIN_STOCK';
        cantidadCotizable = 0;
        tieneSinStock = true;
        mensajeAlerta = `Imposible cotizar "${it.nombreProducto}": No hay stock disponible (0 und. en almacén).`;
        alertasStock.push(mensajeAlerta);
      } else if (stockActual < cantSolicitada) {
        estadoStockItem = 'VARIACION_STOCK';
        cantidadCotizable = stockActual;
        tieneVariacionParcial = true;
        itemsConStock++;
        mensajeAlerta = `Variación de stock en "${it.nombreProducto}": Se redujo el stock disponible de ${cantSolicitada} a ${stockActual} und.`;
        alertasStock.push(mensajeAlerta);
      } else {
        itemsConStock++;
      }

      const subtotalRecalc = Math.round(precioUnit * cantidadCotizable * 100) / 100;
      totalRecalculado += subtotalRecalc;

      return {
        ...it,
        precioUnitario: precioUnit,
        subtotal: subtotalOrig,
        stockDisponibleActual: stockActual,
        cantidadCotizable,
        subtotalRecalculado: subtotalRecalc,
        estadoStockItem,
        mensajeAlerta
      };
    });

    totalRecalculado = Math.round(totalRecalculado * 100) / 100;
    const totalOriginal = parseFloat(cot.total || 0);
    const todosSinStock = (cot.items || []).length > 0 && itemsConStock === 0;
    const tieneVariacion = !todosSinStock && (tieneVariacionParcial || tieneSinStock);

    let estadoCotizacion = 'VIGENTE';
    if (esConfirmada) {
      estadoCotizacion = 'CONFIRMADA';
    } else if (!esVigenteFecha) {
      estadoCotizacion = 'VENCIDA';
    } else if (todosSinStock) {
      estadoCotizacion = 'SIN_STOCK';
    } else if (tieneVariacion) {
      estadoCotizacion = 'VARIACION_STOCK';
    }

    return {
      ...cot,
      total: totalOriginal,
      totalRecalculado,
      observaciones: limpiarObservacionesVisibles(rawObs),
      esConfirmada,
      fueRecalculada,
      estadoCotizacion,
      todosSinStock,
      tieneVariacionStock: tieneVariacion,
      alertasStock,
      items: itemsEnriquecidos
    };
  });
};

/**
 * HU-07: Generar y registrar una cotización formal
 */
const crearCotizacion = async (req, res) => {
  try {
    const { nombreCliente, telefonoCliente, emailCliente, items, observaciones, idUsuario } = req.body;

    if (!nombreCliente || !nombreCliente.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio para la cotización.' });
    }

    if (!telefonoCliente || !telefonoCliente.trim()) {
      return res.status(400).json({ error: 'El teléfono/WhatsApp del cliente es obligatorio para remitir la cotización.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la cotización.' });
    }

    // Validar y consolidar cantidades de productos estrictamente (HU07-P02: sin parseInt)
    const itemMap = new Map();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: `El ítem en la posición ${i + 1} no es válido.` });
      }

      const rawId = item.idProducto;
      if (typeof rawId === 'string' && !/^\d+$/.test(rawId.trim())) {
        return res.status(400).json({ error: `ID de producto inválido en la línea ${i + 1} (recibido: "${rawId}").` });
      }
      const idProd = Number(rawId);
      if (!Number.isInteger(idProd) || idProd <= 0) {
        return res.status(400).json({ error: `ID de producto inválido en la línea ${i + 1}.` });
      }

      const rawCant = item.cantidad;
      if (rawCant === undefined || rawCant === null || typeof rawCant === 'boolean') {
        return res.status(400).json({ error: `La cantidad es obligatoria para el producto en la línea ${i + 1}.` });
      }

      if (typeof rawCant === 'string' && !/^\d+$/.test(rawCant.trim())) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idProd} debe ser un número entero positivo sin decimales ni caracteres (recibido: "${rawCant}").`
        });
      }

      const cant = Number(rawCant);
      if (!Number.isInteger(cant) || cant <= 0) {
        return res.status(400).json({
          error: `La cantidad para el producto ID ${idProd} debe ser un entero positivo mayor a cero (recibido: "${rawCant}").`
        });
      }

      itemMap.set(idProd, (itemMap.get(idProd) || 0) + cant);
    }

    const productIds = Array.from(itemMap.keys());
    const productosDB = await prisma.producto.findMany({
      where: { id: { in: productIds } }
    });

    if (productosDB.length !== productIds.length) {
      return res.status(404).json({ error: 'Uno o más productos seleccionados ya no existen en el catálogo.' });
    }

    const prodDict = new Map(productosDB.map(p => [p.id, p]));

    // HU07-P01 & Escenario 3: Comprobar disponibilidad real en inventario antes de confirmar la cotización
    for (const [idProd, cant] of itemMap.entries()) {
      const prod = prodDict.get(idProd);
      if (prod.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: `El producto "${prod.nombre}" no se encuentra activo para cotización comercial.`
        });
      }

      const unidadesDisponibles = await prisma.inventarioUnidad.count({
        where: {
          idProducto: idProd,
          estadoStock: 'DISPONIBLE',
          reservas: {
            none: {
              estadoReserva: { in: ['PENDIENTE', 'CONFIRMADA', 'ENTREGADA'] }
            }
          }
        }
      });

      if (unidadesDisponibles === 0) {
        return res.status(409).json({
          error: `No se puede emitir la cotización: El producto "${prod.nombre}" se encuentra actualmente agotado en almacén (0 disponibles).`,
          codigoAlerta: 'SIN_STOCK',
          idProducto: idProd,
          nombreProducto: prod.nombre,
          stockDisponible: 0
        });
      }

      if (unidadesDisponibles < cant) {
        return res.status(409).json({
          error: `Variación de stock en "${prod.nombre}": Solicitó ${cant} unidad(es), pero el stock disponible actual se redujo a ${unidadesDisponibles} unidad(es).`,
          codigoAlerta: 'VARIACION_STOCK',
          idProducto: idProd,
          nombreProducto: prod.nombre,
          cantidadSolicitada: cant,
          stockDisponible: unidadesDisponibles
        });
      }
    }

    let totalCotizacion = 0;
    const detallesData = [];

    for (const [idProd, cant] of itemMap.entries()) {
      const prod = prodDict.get(idProd);
      const precioUnit = parseFloat(prod.precio);
      const subtotal = Math.round(precioUnit * cant * 100) / 100;
      totalCotizacion += subtotal;

      detallesData.push({
        idProducto: idProd,
        nombreProducto: prod.nombre,
        cantidad: cant,
        precioUnitario: precioUnit,
        subtotal: subtotal
      });
    }

    totalCotizacion = Math.round(totalCotizacion * 100) / 100;

    // Generar código único correlativo COT-2026-XXXX con CSPRNG (crypto.randomInt)
    const randomSuffix = crypto.randomInt(1000, 10000);
    const codigoCotizacion = `COT-2026-${randomSuffix}`;

    // Vigencia: 7 días calendario
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);

    const uidTag = idUsuario && Number.isInteger(Number(idUsuario)) ? `[UID:${Number(idUsuario)}]` : '';
    const obsBase = observaciones ? observaciones.trim() : '';
    const observacionesFinal = [obsBase, uidTag].filter(Boolean).join(' ').trim() || null;

    const cotizacionCreada = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          codigoCotizacion,
          nombreCliente: nombreCliente.trim(),
          telefonoCliente: telefonoCliente.trim(),
          emailCliente: emailCliente ? emailCliente.trim() : null,
          total: totalCotizacion,
          fechaVencimiento,
          observaciones: observacionesFinal,
          items: {
            create: detallesData
          }
        },
        include: {
          items: true
        }
      });
      return cot;
    });

    const [cotizacionEnriquecida] = await enriquecerCotizacionesConStockReal([cotizacionCreada]);

    return res.status(201).json({
      mensaje: `Cotización formal ${codigoCotizacion} generada exitosamente. Válida por 7 días.`,
      avisoLegal: 'Nota: La cotización comercial no reserva stock físico. Disponibilidad garantizada únicamente con reserva formal o compra.',
      cotizacion: cotizacionEnriquecida
    });
  } catch (error) {
    console.error('[CotizacionController.crearCotizacion] Error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: sanitizarError(error, 'Error al generar la cotización.')
    });
  }
};

/**
 * HU-07: Consultar cotización por código correlativo
 */
const obtenerCotizacionPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ error: 'Código de cotización requerido.' });
    }

    const codigoLimpio = codigo.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,35}$/.test(codigoLimpio)) {
      return res.status(400).json({ error: 'Formato de código de cotización inválido.' });
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { codigoCotizacion: codigoLimpio },
      include: {
        items: true
      }
    });

    if (!cotizacion) {
      return res.status(404).json({ error: `No se encontró ninguna cotización con el código "${codigo}".` });
    }

    const [enriquecida] = await enriquecerCotizacionesConStockReal([cotizacion]);
    const ahora = new Date();
    const vigente = ahora <= new Date(cotizacion.fechaVencimiento);

    const enmascararNombre = (nom) => {
      if (!nom) return 'Cliente';
      const partes = nom.trim().split(/\s+/);
      if (partes.length === 1) return partes[0];
      return `${partes[0]} ${partes[1].charAt(0)}.`;
    };

    const cotizacionPublica = {
      ...enriquecida,
      clienteReferencia: enmascararNombre(cotizacion.nombreCliente)
    };

    return res.status(200).json({
      cotizacion: cotizacionPublica,
      vigente,
      diasRestantes: Math.max(0, Math.ceil((new Date(cotizacion.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24))),
      avisoLegal: 'Nota: La cotización comercial no reserva stock físico.'
    });
  } catch (error) {
    console.error('[CotizacionController.obtenerCotizacionPorCodigo] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al consultar la cotización.')
    });
  }
};

/**
 * Listar las cotizaciones pertenecientes al usuario autenticado (Cliente / Staff)
 */
const obtenerMisCotizaciones = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Debes iniciar sesión para consultar tus cotizaciones.' });
    }

    const usuarioDB = await prisma.usuario.findUnique({
      where: { id: Number(idUsuario) },
      select: { email: true, nombre: true, telefono: true, rol: true }
    });

    const rolUsuario = usuarioDB?.rol || req.usuario?.rol || 'CLIENTE';
    const emailUsuario = (usuarioDB?.email || req.usuario?.email || '').trim().toLowerCase();
    const nombreUsuario = (usuarioDB?.nombre || req.usuario?.nombre || '')
      .replace(/\s*\((Google|Local)\)/gi, '')
      .trim();
    const telUsuario = (usuarioDB?.telefono || '').replace(/\D/g, '');

    // Códigos adicionales guardados en la sesión local del navegador
    const codigosQuery = (req.query.codigos || '')
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => /^[A-Z0-9-]{4,35}$/.test(c));

    const condicionesOR = [
      { observaciones: { contains: `[UID:${Number(idUsuario)}]` } }
    ];

    if (emailUsuario) {
      condicionesOR.push({ emailCliente: { equals: emailUsuario, mode: 'insensitive' } });
    }
    if (telUsuario && telUsuario.length >= 7) {
      condicionesOR.push({ telefonoCliente: { contains: telUsuario } });
    }
    if (nombreUsuario) {
      condicionesOR.push({ nombreCliente: { equals: nombreUsuario, mode: 'insensitive' } });
    }
    if (codigosQuery.length > 0) {
      condicionesOR.push({ codigoCotizacion: { in: codigosQuery } });
    }

    let cotizaciones = await prisma.cotizacion.findMany({
      where: {
        OR: condicionesOR
      },
      orderBy: { fechaEmision: 'desc' },
      include: {
        items: true
      },
      take: 50
    });

    // Si el usuario es SUPERADMIN o ADMIN probando el flujo con correos de prueba (ej. prueba@prueba.com),
    // incluir también las cotizaciones recientes para que pueda auditarlas desde Mis Cotizaciones
    if (rolUsuario === 'SUPERADMIN' || rolUsuario === 'ADMIN') {
      const todas = await prisma.cotizacion.findMany({
        orderBy: { fechaEmision: 'desc' },
        include: { items: true },
        take: 50
      });
      const mapa = new Map();
      [...cotizaciones, ...todas].forEach(c => mapa.set(c.id, c));
      cotizaciones = Array.from(mapa.values()).sort(
        (a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime()
      );
    }

    const enriquecidas = await enriquecerCotizacionesConStockReal(cotizaciones);
    return res.status(200).json({ cotizaciones: enriquecidas });
  } catch (error) {
    console.error('[CotizacionController.obtenerMisCotizaciones] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al obtener tus cotizaciones.')
    });
  }
};

/**
 * HU-07: Listar todas las cotizaciones para Staff con estado de stock en tiempo real
 */
const listarCotizaciones = async (req, res) => {
  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      orderBy: { fechaEmision: 'desc' },
      include: {
        items: true
      },
      take: 50
    });

    const enriquecidas = await enriquecerCotizacionesConStockReal(cotizaciones);
    return res.status(200).json({ cotizaciones: enriquecidas });
  } catch (error) {
    console.error('[CotizacionController.listarCotizaciones] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al listar las cotizaciones.')
    });
  }
};

/**
 * HU-07 Escenario 1 y 3: Confirmar o Recalcular una cotización validando stock actual antes de calcular el nuevo total
 */
const confirmarORecalcularCotizacion = async (req, res) => {
  try {
    const idCotizacion = Number(req.params.id);
    if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) {
      return res.status(400).json({ error: 'ID de cotización inválido.' });
    }

    const { accion = 'confirmar' } = req.body; // 'recalcular' | 'confirmar'

    const cotizacionDB = await prisma.cotizacion.findUnique({
      where: { id: idCotizacion },
      include: { items: true }
    });

    if (!cotizacionDB) {
      return res.status(404).json({ error: 'La cotización solicitada no existe.' });
    }

    if (!verificarPropiedadCotizacion(cotizacionDB, req.usuario)) {
      return res.status(403).json({
        error: 'Acceso denegado: No tienes permisos para modificar una cotización que no pertenece a tu cuenta.'
      });
    }

    const [enriquecida] = await enriquecerCotizacionesConStockReal([cotizacionDB]);

    if (enriquecida.todosSinStock) {
      return res.status(409).json({
        error: `Imposible cotizar o confirmar ${cotizacionDB.codigoCotizacion}: Ninguno de los productos seleccionados cuenta con stock disponible actualmente (0 unidades en almacén). Por favor elimine esta cotización.`,
        estadoCotizacion: 'SIN_STOCK',
        alertasStock: enriquecida.alertasStock
      });
    }

    // Si hay variación de stock y el usuario aún no aceptó el recálculo explícito, o si pidió recalcular/confirmar:
    const actualizada = await prisma.$transaction(async (tx) => {
      let nuevoTotal = 0;

      for (const item of enriquecida.items) {
        if (item.cantidadCotizable <= 0) {
          // Eliminar ítem que quedó con stock 0 dentro de una cotización multi-producto
          await tx.cotizacionDetalle.delete({
            where: { id: item.id }
          });
        } else {
          const nuevoSubtotal = Math.round(item.precioUnitario * item.cantidadCotizable * 100) / 100;
          nuevoTotal += nuevoSubtotal;

          if (item.cantidadCotizable !== item.cantidad) {
            await tx.cotizacionDetalle.update({
              where: { id: item.id },
              data: {
                cantidad: item.cantidadCotizable,
                subtotal: nuevoSubtotal
              }
            });
          }
        }
      }

      nuevoTotal = Math.round(nuevoTotal * 100) / 100;

      let rawObs = cotizacionDB.observaciones || '';
      if (enriquecida.tieneVariacionStock && !rawObs.includes('[RECALCULADA]')) {
        rawObs = `${rawObs} [RECALCULADA]`.trim();
      }
      if (accion === 'confirmar' && !rawObs.includes('[CONFIRMADA]')) {
        rawObs = `${rawObs} [CONFIRMADA]`.trim();
      }

      return tx.cotizacion.update({
        where: { id: idCotizacion },
        data: {
          total: nuevoTotal,
          observaciones: rawObs
        },
        include: { items: true }
      });
    });

    const [finalEnriquecida] = await enriquecerCotizacionesConStockReal([actualizada]);

    const mensaje = accion === 'recalcular'
      ? `Cotización ${finalEnriquecida.codigoCotizacion} actualizada al stock disponible. Nuevo total calculado: S/ ${ parseFloat(finalEnriquecida.total).toFixed(2) }.`
      : `Cotización ${finalEnriquecida.codigoCotizacion} verificada y confirmada exitosamente por un total de S/ ${ parseFloat(finalEnriquecida.total).toFixed(2) }.`;

    return res.status(200).json({
      mensaje,
      cotizacion: finalEnriquecida
    });
  } catch (error) {
    console.error('[CotizacionController.confirmarORecalcularCotizacion] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al procesar y recalcular la cotización.')
    });
  }
};

/**
 * HU-07 Escenario 3: Eliminar una cotización (por falta de stock o descarte del cliente/admin)
 */
const eliminarCotizacion = async (req, res) => {
  try {
    const idCotizacion = Number(req.params.id);
    if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) {
      return res.status(400).json({ error: 'ID de cotización inválido.' });
    }

    const existe = await prisma.cotizacion.findUnique({
      where: { id: idCotizacion }
    });

    if (!existe) {
      return res.status(404).json({ error: 'La cotización que intenta eliminar ya no existe.' });
    }

    if (!verificarPropiedadCotizacion(existe, req.usuario)) {
      return res.status(403).json({
        error: 'Acceso denegado: No tienes permisos para eliminar una cotización que no pertenece a tu cuenta.'
      });
    }

    await prisma.cotizacion.delete({
      where: { id: idCotizacion }
    });

    return res.status(200).json({
      mensaje: `Cotización ${existe.codigoCotizacion} eliminada correctamente.`,
      id: idCotizacion,
      codigoCotizacion: existe.codigoCotizacion
    });
  } catch (error) {
    console.error('[CotizacionController.eliminarCotizacion] Error:', error);
    return res.status(500).json({
      error: sanitizarError(error, 'Error al eliminar la cotización.')
    });
  }
};

module.exports = {
  crearCotizacion,
  obtenerCotizacionPorCodigo,
  obtenerMisCotizaciones,
  listarCotizaciones,
  confirmarORecalcularCotizacion,
  eliminarCotizacion
};
