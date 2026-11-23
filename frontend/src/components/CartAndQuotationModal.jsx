import React, { useState, useEffect, useMemo } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { reservaService } from '../services/reservaService';

export default function CartAndQuotationModal({
  isOpen,
  onClose,
  cart = [],
  setCart,
  onClearCart,
  usuarioActual,
  onReservaExitosa,
  initialMode = 'reserva' // 'reserva' o 'cotizacion'
}) {
  const [activeTab, setActiveTab] = useState('cart'); // 'cart', 'consultar', 'cotizacion_doc'
  const [modoConfirmacion, setModoConfirmacion] = useState(initialMode); // 'reserva' | 'cotizacion'

  // Datos del cliente
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Estados de Reserva
  const [adelantoManual, setAdelantoManual] = useState('');
  const [reservarParaCliente, setReservarParaCliente] = useState(false);
  const [reservasConfirmadas, setReservasConfirmadas] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // Estados de Cotización
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [cotizacionGenerada, setCotizacionGenerada] = useState(null);

  // Estados de control
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const esStaff = usuarioActual && (usuarioActual.rol === 'ADMIN' || usuarioActual.rol === 'OPERADOR' || usuarioActual.rol === 'VENDEDOR');

  // Expandir los ítems del carrito según la cantidad para calcular políticas unitarias de reserva
  const itemsExpandidos = useMemo(() => {
    const list = [];
    cart.forEach(item => {
      const cant = item.cantidad || 1;
      const precio = Number(item.precio || 0);
      const nombreL = (item.nombre || '').toLowerCase();
      const catL = (item.categoria || '').toLowerCase();

      let pct = 0.20; // 20% base
      let badgeLabel = 'Estándar (20%)';
      let badgeColor = 'var(--color-cyan)';

      if (nombreL.includes('p-bandai') || nombreL.includes('edición limitada') || catL.includes('limitada')) {
        pct = 0.50;
        badgeLabel = 'Ed. Limitada (50%)';
        badgeColor = 'var(--color-gold)';
      } else if (precio >= 400 || nombreL.includes('perfect grade') || nombreL.includes('pg ') || nombreL.includes('metal build')) {
        pct = 0.30;
        badgeLabel = 'Alta Gama (30%)';
        badgeColor = '#A78BFA';
      } else if (item.stockActual > 0) {
        pct = 0.20;
        badgeLabel = 'En Stock (20%)';
        badgeColor = '#10B981';
      }

      const minAdelantoUnitario = Number((precio * pct).toFixed(2));

      for (let i = 0; i < cant; i++) {
        list.push({
          id: item.id,
          nombre: item.nombre,
          precio,
          pct,
          badgeLabel,
          badgeColor,
          minAdelanto: minAdelantoUnitario
        });
      }
    });
    return list;
  }, [cart]);

  const totalCompra = useMemo(() => {
    return cart.reduce((acc, item) => acc + (parseFloat(item.precio || 0) * (item.cantidad || 1)), 0);
  }, [cart]);

  const totalUnidades = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.cantidad || 1), 0);
  }, [cart]);

  const adelantoMinimoTotal = useMemo(() => {
    return itemsExpandidos.reduce((acc, curr) => acc + curr.minAdelanto, 0);
  }, [itemsExpandidos]);

  // Sincronizar datos iniciales al abrir el modal
  useEffect(() => {
    if (isOpen && !reservasConfirmadas && !cotizacionGenerada) {
      setError('');
      setExito('');
      if (usuarioActual) {
        setNombre(usuarioActual.nombre || '');
        setEmail(usuarioActual.email || '');
        setTelefono(usuarioActual.telefono || '');
      } else {
        setNombre('');
        setEmail('');
        setTelefono('');
      }
      setAdelantoManual(adelantoMinimoTotal.toFixed(2));
      if (initialMode) setModoConfirmacion(initialMode);
    }
  }, [isOpen, usuarioActual, adelantoMinimoTotal, reservasConfirmadas, cotizacionGenerada, initialMode]);

  if (!isOpen) return null;

  const adelantoNum = parseFloat(adelantoManual) || 0;
  const saldoPendiente = Math.max(0, totalCompra - adelantoNum);

  const handleUpdateCantidad = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const nuevaCant = (item.cantidad || 1) + delta;
          return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleClose = () => {
    if (reservasConfirmadas || cotizacionGenerada) {
      if (onClearCart) onClearCart();
    }
    setReservasConfirmadas(null);
    setCotizacionGenerada(null);
    setError('');
    setExito('');
    setCopiado(false);
    setActiveTab('cart');
    onClose();
  };

  // ==============================================================
  // ACCIÓN 1: CONFIRMAR RESERVA (CON ADELANTO)
  // ==============================================================
  const handleConfirmarReserva = async (e) => {
    e.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('El carrito está vacío. Agrega productos desde el catálogo.');
      return;
    }

    if (!nombre.trim()) {
      setError('Por favor indica tu nombre completo.');
      return;
    }

    if (!telefono.trim()) {
      setError('El teléfono o WhatsApp de contacto es obligatorio.');
      return;
    }

    if (adelantoNum < adelantoMinimoTotal) {
      setError(`El adelanto total ingresado (S/ ${adelantoNum.toFixed(2)}) es menor que la suma de adelantos mínimos requeridos (S/ ${adelantoMinimoTotal.toFixed(2)}).`);
      return;
    }

    if (adelantoNum > totalCompra) {
      setError(`El adelanto (S/ ${adelantoNum.toFixed(2)}) no puede exceder el importe total (S/ ${totalCompra.toFixed(2)}).`);
      return;
    }

    try {
      setCargando(true);

      const excedente = Math.max(0, adelantoNum - adelantoMinimoTotal);
      const sumaPrecios = totalCompra;

      const itemsParaRegistrar = itemsExpandidos.map(item => {
        let asignado = item.minAdelanto;
        if (excedente > 0 && sumaPrecios > 0) {
          const proporcion = (item.precio - item.minAdelanto) / Math.max(1, (sumaPrecios - adelantoMinimoTotal));
          asignado += Number((excedente * proporcion).toFixed(2));
        }
        asignado = Math.min(item.precio, asignado);
        return {
          id: item.id,
          precio: item.precio,
          adelantoAsignado: Number(asignado.toFixed(2))
        };
      });

      const creadas = await reservaService.crearReservasEnMasa(itemsParaRegistrar, {
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: email ? email.trim() : null,
        notas: notas.trim(),
        idUsuario: usuarioActual ? usuarioActual.id : null
      });

      setReservasConfirmadas(creadas);
      if (onReservaExitosa) onReservaExitosa();
    } catch (err) {
      setError(err.message || 'Error al procesar la reserva del carrito.');
    } finally {
      setCargando(false);
    }
  };

  // ==============================================================
  // ACCIÓN 2: EMITIR COTIZACIÓN FORMAL (PROFORMA)
  // ==============================================================
  const handleGenerarCotizacion = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    if (cart.length === 0) {
      setError('El carrito está vacío. Agrega productos desde el catálogo.');
      return;
    }

    if (!nombre.trim() || !telefono.trim()) {
      setError('Por favor ingresa tu nombre y número de WhatsApp.');
      return;
    }

    try {
      setCargando(true);
      const emailFinal = email ? email.trim() : (usuarioActual?.email || null);
      const payload = {
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: emailFinal,
        observaciones: observaciones ? observaciones.trim() : '',
        items: cart.map(i => ({ idProducto: i.id, cantidad: i.cantidad || 1 }))
      };

      const resp = await cotizacionService.crearCotizacion(payload);
      setCotizacionGenerada(resp.cotizacion);
      setExito(resp.mensaje || 'Cotización formal emitida exitosamente.');
      setActiveTab('cotizacion_doc');

      // Guardar en caché local vinculada al usuario para visualización inmediata en Mis Cotizaciones
      try {
        const prevStr = localStorage.getItem('lj_mis_cotizaciones_cache');
        const prevArr = prevStr ? JSON.parse(prevStr) : [];
        const nuevaCot = { ...resp.cotizacion, idUsuario: usuarioActual?.id || null };
        localStorage.setItem('lj_mis_cotizaciones_cache', JSON.stringify([nuevaCot, ...prevArr].slice(0, 30)));
      } catch (_) {}
    } catch (err) {
      setError(err.message || 'Error al generar la cotización.');
    } finally {
      setCargando(false);
    }
  };

  // ==============================================================
  // ACCIÓN 3: CONSULTAR COTIZACIÓN POR CÓDIGO
  // ==============================================================
  const handleBuscarCotizacion = async (e) => {
    e.preventDefault();
    setError('');
    if (!codigoBusqueda.trim()) return;

    try {
      setCargando(true);
      const resp = await cotizacionService.obtenerPorCodigo(codigoBusqueda.trim());
      setCotizacionGenerada(resp.cotizacion);
      setActiveTab('cotizacion_doc');
    } catch (err) {
      setError(err.message || 'Cotización no encontrada.');
    } finally {
      setCargando(false);
    }
  };

  const handleCopiarCodigos = () => {
    if (!reservasConfirmadas) return;
    const codigos = reservasConfirmadas.map(r => `${r.producto?.nombre || 'Kit'}: ${r.codigoSeguimiento}`).join('\n');
    navigator.clipboard.writeText(codigos);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const getWhatsAppReservaLink = () => {
    if (!reservasConfirmadas || reservasConfirmadas.length === 0) return '#';
    const codigos = reservasConfirmadas.map(r => r.codigoSeguimiento).join(', ');
    const listaProds = reservasConfirmadas.map(r => `• ${r.producto?.nombre || 'Kit'} (${r.codigoSeguimiento})`).join('\n');
    const text = encodeURIComponent(
      `¡Hola Leveling Jump! Acabo de registrar mi pedido de reserva para los siguientes kits:\n\n${listaProds}\n\n*Códigos de Seguimiento:* ${codigos}\n*Adelanto Total:* S/ ${adelantoNum.toFixed(2)}\n*Saldo Pendiente:* S/ ${saldoPendiente.toFixed(2)}.`
    );
    return `https://wa.me/51999999999?text=${text}`;
  };

  const handleCompartirWhatsAppCotizacion = () => {
    if (!cotizacionGenerada) return;
    const msg = encodeURIComponent(
      `¡Hola Leveling Jump! Solicito confirmar mi cotización oficial *${cotizacionGenerada.codigoCotizacion}* por un total de *S/ ${parseFloat(cotizacionGenerada.total).toFixed(2)}* emitida a nombre de ${cotizacionGenerada.nombreCliente}.`
    );
    window.open(`https://wa.me/51999999999?text=${msg}`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Cabecera */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🛒</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-cyan)', letterSpacing: '0.5px' }}>
                {reservasConfirmadas ? 'RESERVA CONFIRMADA' : 'CARRITO DE COMPRAS'}
              </h3>
              <small style={{ color: '#8B949E', fontSize: '11px', display: 'block' }}>
                Gestión de pedidos, reservas y cotizaciones
              </small>
            </div>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>&times;</button>
        </div>

        {/* Pestañas de navegación superior si hay hoja de cotización emitida */}
        {!reservasConfirmadas && cotizacionGenerada && (
          <div className="auth-tabs" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'cart' ? 'active' : ''}`}
              onClick={() => setActiveTab('cart')}
            >
              🛍️ Mi Carrito ({totalUnidades})
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'cotizacion_doc' ? 'active' : ''}`}
              onClick={() => setActiveTab('cotizacion_doc')}
            >
              📄 Hoja Oficial ({cotizacionGenerada.codigoCotizacion})
            </button>
          </div>
        )}

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
        {exito && <div className="alert ok" style={{ marginBottom: '14px' }}>✅ {exito}</div>}

        {/* ============================================================== */}
        {/* VISTA 1: ÉXITO AL CONFIRMAR RESERVA (CÓDIGOS RES) */}
        {/* ============================================================== */}
        {reservasConfirmadas ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
            <h4 style={{ color: '#10B981', margin: '0 0 10px', fontSize: '18px' }}>
              ¡Reserva registrada con éxito!
            </h4>
            <p style={{ color: '#C9D1D9', fontSize: '13.5px', margin: '0 0 16px' }}>
              Se apartaron <strong>{reservasConfirmadas.length} unidades</strong> en almacén. Guarda tus códigos de seguimiento:
            </p>

            <div style={{ background: '#0D1117', border: '2px dashed var(--color-cyan)', borderRadius: '8px', padding: '14px', margin: '14px 0', textAlign: 'left' }}>
              <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Códigos de Seguimiento Individuales:
              </span>
              {reservasConfirmadas.map(res => (
                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #21262D', fontSize: '13px' }}>
                  <span style={{ color: '#FFFFFF' }}>{res.producto?.nombre || 'Producto'}</span>
                  <strong style={{ color: 'var(--color-cyan)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{res.codigoSeguimiento}</strong>
                </div>
              ))}
            </div>

            <div className="reserva-breakdown" style={{ textAlign: 'left', marginBottom: '14px' }}>
              <div className="reserva-breakdown-row">
                <span>Cliente:</span>
                <span>{reservasConfirmadas[0]?.nombreCliente} ({reservasConfirmadas[0]?.telefonoCliente})</span>
              </div>
              <div className="reserva-breakdown-row">
                <span>Adelanto Registrado:</span>
                <strong style={{ color: '#10B981' }}>S/ {adelantoNum.toFixed(2)}</strong>
              </div>
              <div className="reserva-breakdown-row">
                <span>Saldo Pendiente contra Entrega:</span>
                <strong style={{ color: 'var(--color-gold)' }}>S/ {saldoPendiente.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={getWhatsAppReservaLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="primary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: '#25D366',
                    color: '#000000',
                    textDecoration: 'none',
                    fontWeight: 'bold'
                  }}
                >
                  💬 Coordinar Entrega por WhatsApp
                </a>

                <button
                  type="button"
                  className="secondary"
                  onClick={handleCopiarCodigos}
                  style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
                >
                  {copiado ? '✅ ¡Copiado!' : '📋 Copiar Códigos'}
                </button>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={handleClose}
                style={{ width: '100%', padding: '10px' }}
              >
                Cerrar y Regresar al Catálogo
              </button>
            </div>
          </div>
        ) : activeTab === 'cart' ? (
          <div>
            {/* Si el carrito está vacío */}
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#8B949E' }}>
                <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>🛍️</span>
                <strong style={{ color: '#F0F6FC', fontSize: '15px' }}>Tu carrito está vacío</strong>
                <p style={{ fontSize: '13px', margin: '6px 0 16px' }}>
                  Explora el catálogo y agrega maquetas Gunpla o figuras para apartar o cotizar.
                </p>
                <button type="button" className="secondary" onClick={handleClose}>Volver al Catálogo</button>
              </div>
            ) : (
              <div>
                {/* 1. LISTADO DE PRODUCTOS DEL CARRITO */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '14px', border: '1px solid #30363D', borderRadius: '8px', background: '#0D1117', padding: '8px' }}>
                  {cart.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '8px 10px',
                        borderBottom: '1px solid #21262D'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h5 style={{ margin: 0, fontSize: '13px', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nombre}
                        </h5>
                        <small style={{ color: 'var(--color-cyan)', fontSize: '11px', fontFamily: 'monospace' }}>
                          S/ {parseFloat(item.precio || 0).toFixed(2)} c/u
                        </small>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Selector de cantidad */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#161B22', border: '1px solid #30363D', borderRadius: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateCantidad(item.id, -1)}
                            style={{ background: 'transparent', border: 'none', color: '#C9D1D9', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            -
                          </button>
                          <span style={{ padding: '0 8px', fontSize: '13px', fontWeight: 'bold', color: '#FFFFFF' }}>
                            {item.cantidad || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCantidad(item.id, 1)}
                            style={{ background: 'transparent', border: 'none', color: '#C9D1D9', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal */}
                        <strong style={{ fontSize: '13px', color: '#10B981', minWidth: '85px', textAlign: 'right', fontFamily: 'monospace' }}>
                          S/ {(parseFloat(item.precio || 0) * (item.cantidad || 1)).toFixed(2)}
                        </strong>

                        {/* Botón eliminar */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px 6px', fontSize: '14px' }}
                          title="Quitar del carrito"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen de totales */}
                <div className="reserva-breakdown" style={{ marginBottom: '14px' }}>
                  <div className="reserva-breakdown-row">
                    <span>Total de Kits Seleccionados:</span>
                    <strong>{totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}</strong>
                  </div>
                  <div className="reserva-breakdown-row" style={{ color: 'var(--color-cyan)', fontSize: '16px' }}>
                    <span>Importe Total de la Compra:</span>
                    <strong>S/ {totalCompra.toFixed(2)}</strong>
                  </div>
                </div>

                {/* 2. SELECTOR DE CONFIRMACIÓN: RESERVAR VS COTIZAR (CRITERIO 3 DE HU-02) */}
                <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '4px', display: 'flex', gap: '4px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setModoConfirmacion('reserva')}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: modoConfirmacion === 'reserva' ? 'var(--color-cyan)' : 'transparent',
                      color: modoConfirmacion === 'reserva' ? '#080B0F' : '#C9D1D9',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🔖</span> Apartar con Adelanto (Reserva)
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoConfirmacion('cotizacion')}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: modoConfirmacion === 'cotizacion' ? 'var(--color-cyan)' : 'transparent',
                      color: modoConfirmacion === 'cotizacion' ? '#080B0F' : '#C9D1D9',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>📋</span> Emitir Cotización Formal
                  </button>
                </div>

                {/* MODO A: CONFIRMAR COMO RESERVA (CON ADELANTO) */}
                {modoConfirmacion === 'reserva' && (
                  <form onSubmit={handleConfirmarReserva} style={{ borderTop: '1px solid #30363D', paddingTop: '14px' }}>
                    {/* Modo Staff si aplica */}
                    {esStaff && (
                      <div style={{ background: '#0D1117', border: '1px solid var(--color-cyan)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>
                            🛡️ Operación de Staff: {usuarioActual.nombre}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className={`auth-tab-btn ${reservarParaCliente ? 'active' : ''}`}
                              style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '4px' }}
                              onClick={() => {
                                setReservarParaCliente(true);
                                setNombre('');
                                setTelefono('');
                                setEmail('');
                              }}
                            >
                              A nombre de un Cliente
                            </button>
                            <button
                              type="button"
                              className={`auth-tab-btn ${!reservarParaCliente ? 'active' : ''}`}
                              style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '4px' }}
                              onClick={() => {
                                setReservarParaCliente(false);
                                setNombre(usuarioActual.nombre || '');
                                setTelefono(usuarioActual.telefono || '');
                                setEmail(usuarioActual.email || '');
                              }}
                            >
                              Auto-reserva (Para mí)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Datos del Cliente */}
                    {(!esStaff || reservarParaCliente) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <label style={{ margin: 0 }}>
                          Tu Nombre Completo *
                          <input
                            type="text"
                            required
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: César Sánchez"
                            style={{ marginTop: '4px' }}
                          />
                        </label>
                        <label style={{ margin: 0 }}>
                          Teléfono / WhatsApp *
                          <input
                            type="tel"
                            required
                            value={telefono}
                            onChange={e => setTelefono(e.target.value)}
                            placeholder="Ej: 999 888 777"
                            style={{ marginTop: '4px' }}
                          />
                        </label>
                      </div>
                    )}

                    {(!esStaff || reservarParaCliente) && (
                      <label style={{ display: 'block', margin: '0 0 10px' }}>
                        Correo Electrónico (Opcional)
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="cliente@ejemplo.com"
                          style={{ marginTop: '4px' }}
                        />
                      </label>
                    )}

                    {/* Cajón de Adelanto y Políticas */}
                    <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8B949E' }}>Adelanto para apartar los {totalUnidades} kits:</span>
                        <strong style={{ color: 'var(--color-cyan)', fontSize: '13px' }}>
                          Mínimo requerido: S/ {adelantoMinimoTotal.toFixed(2)}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8B949E', fontSize: '13px' }}>S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min={adelantoMinimoTotal}
                            max={totalCompra}
                            required
                            value={adelantoManual}
                            onChange={e => setAdelantoManual(e.target.value)}
                            style={{ paddingLeft: '28px', width: '100%', fontSize: '14px', fontWeight: 'bold' }}
                          />
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          style={{ fontSize: '11px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                          onClick={() => setAdelantoManual(adelantoMinimoTotal.toFixed(2))}
                        >
                          Pagar Solo Mínimo
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ fontSize: '11px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                          onClick={() => setAdelantoManual(totalCompra.toFixed(2))}
                        >
                          Pagar Total (100%)
                        </button>
                      </div>
                    </div>

                    <div className="reserva-breakdown" style={{ marginBottom: '14px' }}>
                      <div className="reserva-breakdown-row" style={{ color: '#10B981' }}>
                        <span>Adelanto que se Abonará:</span>
                        <strong>S/ {adelantoNum.toFixed(2)}</strong>
                      </div>
                      <div className="reserva-breakdown-row" style={{ color: 'var(--color-gold)', fontSize: '15px' }}>
                        <span>Saldo Pendiente contra Entrega:</span>
                        <strong>S/ {saldoPendiente.toFixed(2)}</strong>
                      </div>
                    </div>

                    <label style={{ display: 'block', margin: '0 0 16px' }}>
                      Modalidad de Retiro / Notas de Envío
                      <input
                        type="text"
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                        placeholder="Ej: Retiro en feria de Arenales o envío Shalom a provincia"
                        style={{ marginTop: '4px' }}
                      />
                    </label>

                    <button
                      type="submit"
                      className="primary"
                      disabled={cargando}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        background: 'var(--color-cyan)',
                        color: '#080B0F',
                        boxShadow: '0 0 12px var(--color-cyan-glow)'
                      }}
                    >
                      {cargando ? 'Generando reservas...' : `Confirmar Reserva de ${totalUnidades} Kits (Adelanto: S/ ${adelantoNum.toFixed(2)})`}
                    </button>
                  </form>
                )}

                {/* MODO B: EMITIR COTIZACIÓN FORMAL */}
                {modoConfirmacion === 'cotizacion' && (
                  <form onSubmit={handleGenerarCotizacion} style={{ borderTop: '1px solid #30363D', paddingTop: '14px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-gold)', lineHeight: 1.4 }}>
                      ℹ️ La cotización formal verifica stock activo antes de emitirse y congela precios durante 7 días. No compromete inventario físico.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                      <label style={{ margin: 0 }}>
                        Tu Nombre Completo *
                        <input
                          type="text"
                          required
                          value={nombre}
                          onChange={e => setNombre(e.target.value)}
                          placeholder="Ej: César Sánchez"
                          style={{ marginTop: '4px' }}
                        />
                      </label>
                      <label style={{ margin: 0 }}>
                        Teléfono / WhatsApp *
                        <input
                          type="tel"
                          required
                          value={telefono}
                          onChange={e => setTelefono(e.target.value)}
                          placeholder="Ej: 999 888 777"
                          style={{ marginTop: '4px' }}
                        />
                      </label>
                    </div>

                    <label style={{ display: 'block', margin: '0 0 10px' }}>
                      Correo Electrónico (Opcional)
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        style={{ marginTop: '4px' }}
                      />
                    </label>

                    <label style={{ display: 'block', margin: '0 0 16px' }}>
                      Notas o Consultas Adicionales
                      <input
                        type="text"
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Ej: Deseo retirar en feria de Arenales o consultar despacho a provincia"
                        style={{ marginTop: '4px' }}
                      />
                    </label>

                    <button
                      type="submit"
                      className="primary"
                      disabled={cargando}
                      style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      {cargando ? 'Generando Cotización...' : `📄 Generar Cotización Oficial (S/ ${totalCompra.toFixed(2)})`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'cotizacion_doc' && cotizacionGenerada ? (
          /* ============================================================== */
          /* PESTAÑA 2: HOJA DE COTIZACIÓN FORMAL (IMPRIMIBLE) */
          /* ============================================================== */
          <div>
            <div
              id="hoja-cotizacion"
              style={{
                background: '#FFFFFF',
                color: '#111827',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              {/* Cabecera Documento */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '0.5px' }}>
                    LEVELING JUMP
                  </h3>
                  <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748B' }}>
                    Model Kits, Gunpla & Coleccionables de Importación
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                    Lima, Perú | WhatsApp: +51 999 888 777
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', background: '#EEF2FF', color: '#4F46E5', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Cotización Formal
                  </span>
                  <h4 style={{ margin: '4px 0 2px', fontSize: '16px', fontWeight: '900', color: '#4F46E5', fontFamily: 'monospace' }}>
                    {cotizacionGenerada.codigoCotizacion}
                  </h4>
                  <small style={{ display: 'block', fontSize: '10.5px', color: '#64748B' }}>
                    Emisión: {new Date(cotizacionGenerada.fechaEmision).toLocaleDateString('es-PE')}
                  </small>
                  <small style={{ display: 'block', fontSize: '10.5px', color: '#D97706', fontWeight: 'bold' }}>
                    Válida hasta: {new Date(cotizacionGenerada.fechaVencimiento).toLocaleDateString('es-PE')}
                  </small>
                </div>
              </div>

              {/* Datos Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12px' }}>
                <div>
                  <strong style={{ color: '#475569', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Cliente:</strong>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{cotizacionGenerada.nombreCliente}</span>
                  <div style={{ color: '#64748B' }}>WhatsApp: {cotizacionGenerada.telefonoCliente}</div>
                </div>
                <div>
                  <strong style={{ color: '#475569', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Correo / Notas:</strong>
                  <div style={{ color: '#64748B' }}>{cotizacionGenerada.emailCliente || 'No especificado'}</div>
                  <div style={{ color: '#64748B', fontStyle: 'italic' }}>{cotizacionGenerada.observaciones || 'Sin notas adicionales'}</div>
                </div>
              </div>

              {/* Tabla de ítems */}
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #CBD5E1', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Ítem / Producto</th>
                    <th style={{ padding: '6px 0', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>P. Unitario</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacionGenerada.items?.map(it => (
                    <tr key={it.id || it.idProducto} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '6px 0', color: '#1E293B', fontWeight: '500' }}>{it.nombreProducto}</td>
                      <td style={{ padding: '6px 0', textAlign: 'center', color: '#475569' }}>{it.cantidad}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                        S/ {parseFloat(it.precioUnitario).toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0F172A' }}>
                        S/ {parseFloat(it.subtotal).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #0F172A' }}>
                    <td colSpan="3" style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#334155' }}>
                      TOTAL ESTIMADO:
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#4F46E5', fontSize: '15px' }}>
                      S/ {parseFloat(cotizacionGenerada.total).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Condiciones comerciales */}
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', color: '#92400E', lineHeight: 1.4 }}>
                ⚠️ <strong>Condiciones comerciales:</strong> Los precios cotizados se mantienen vigentes durante 7 días calendario a partir de su emisión. Esta cotización comercial <strong>no reserva stock físico en almacén</strong>. La separación de mercadería se efectiviza únicamente con el registro de reserva formal o pago de adelanto.
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="secondary"
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                onClick={handleCompartirWhatsAppCotizacion}
                className="primary"
                style={{ flex: 1, padding: '10px', fontSize: '13px', background: '#25D366', color: '#000000', fontWeight: 'bold' }}
              >
                💬 Enviar por WhatsApp
              </button>
              <button
                type="button"
                className="secondary"
                onClick={handleClose}
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
