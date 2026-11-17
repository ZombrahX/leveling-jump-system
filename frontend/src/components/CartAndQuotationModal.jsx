import React, { useState } from 'react';
import { cotizacionService } from '../services/cotizacionService';

export default function CartAndQuotationModal({ isOpen, onClose, cart = [], setCart, onClearCart, onProcederReserva }) {
  const [activeTab, setActiveTab] = useState('cart'); // 'cart', 'consultar', 'resultado'
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [cotizacionGenerada, setCotizacionGenerada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  if (!isOpen) return null;

  const totalCarrito = cart.reduce((acc, item) => acc + (parseFloat(item.precio || 0) * (item.cantidad || 1)), 0);
  const totalUnidades = cart.reduce((acc, item) => acc + (item.cantidad || 1), 0);

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
      const payload = {
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: email ? email.trim() : null,
        observaciones: observaciones ? observaciones.trim() : '',
        items: cart.map(i => ({ idProducto: i.id, cantidad: i.cantidad || 1 }))
      };

      const resp = await cotizacionService.crearCotizacion(payload);
      setCotizacionGenerada(resp.cotizacion);
      setExito(resp.mensaje || 'Cotización formal emitida exitosamente.');
      setActiveTab('resultado');
      if (onClearCart) onClearCart();
    } catch (err) {
      setError(err.message || 'Error al generar la cotización formal.');
    } finally {
      setCargando(false);
    }
  };

  const handleBuscarCotizacion = async (e) => {
    e.preventDefault();
    setError('');
    if (!codigoBusqueda.trim()) return;

    try {
      setCargando(true);
      const resp = await cotizacionService.obtenerPorCodigo(codigoBusqueda.trim());
      setCotizacionGenerada(resp.cotizacion);
      setActiveTab('resultado');
    } catch (err) {
      setError(err.message || 'Cotización no encontrada.');
    } finally {
      setCargando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleCompartirWhatsApp = () => {
    if (!cotizacionGenerada) return;
    const msg = encodeURIComponent(
      `¡Hola Leveling Jump! Solicito confirmar mi cotización oficial *${cotizacionGenerada.codigoCotizacion}* por un total de *S/ ${parseFloat(cotizacionGenerada.total).toFixed(2)}* emitida a nombre de ${cotizacionGenerada.nombreCliente}.`
    );
    window.open(`https://wa.me/51999999999?text=${msg}`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Cabecera */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🛒</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-cyan)', letterSpacing: '0.5px' }}>
                CARRITO Y COTIZACIONES
              </h3>
              <small style={{ color: '#8B949E', fontSize: '11px', display: 'block' }}>
                Gestión comercial y emisión proforma
              </small>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Pestañas estilo auth-tabs */}
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
            className={`auth-tab-btn ${activeTab === 'consultar' ? 'active' : ''}`}
            onClick={() => setActiveTab('consultar')}
          >
            🔍 Consultar Cotización
          </button>
          {cotizacionGenerada && (
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'resultado' ? 'active' : ''}`}
              onClick={() => setActiveTab('resultado')}
            >
              📄 Hoja Oficial ({cotizacionGenerada.codigoCotizacion})
            </button>
          )}
        </div>

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
        {exito && <div className="alert ok" style={{ marginBottom: '14px' }}>✅ {exito}</div>}

        {/* PESTAÑA 1: MI CARRITO Y SOLICITUD DE COTIZACIÓN */}
        {activeTab === 'cart' && (
          <div>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#8B949E' }}>
                <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>🛍️</span>
                <strong style={{ color: '#F0F6FC', fontSize: '15px' }}>Tu carrito comercial está vacío</strong>
                <p style={{ fontSize: '13px', margin: '6px 0 16px' }}>
                  Explora el catálogo y agrega maquetas Gunpla o suministros para cotizar.
                </p>
                <button type="button" className="secondary" onClick={onClose}>Volver al Catálogo</button>
              </div>
            ) : (
              <div>
                {/* Listado de ítems */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #30363D', borderRadius: '8px', background: '#0D1117', padding: '8px' }}>
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
                    <span>Moneda comercial:</span>
                    <span>PEN (Soles peruanos S/)</span>
                  </div>
                  <div className="reserva-breakdown-row" style={{ color: 'var(--color-cyan)', fontSize: '16px' }}>
                    <span>Importe Total ({totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}):</span>
                    <strong>S/ {totalCarrito.toFixed(2)}</strong>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: 'var(--color-gold)', lineHeight: 1.4 }}>
                    ℹ️ El carrito es una selección temporal y no bloquea inventario. La cotización formal verifica stock activo antes de emitirse y congela precios por 7 días.
                  </p>
                </div>

                {/* HU-02: Confirmar como Reserva Múltiple */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => onProcederReserva && onProcederReserva(cart)}
                    className="primary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'var(--color-cyan)',
                      color: '#080B0F',
                      fontWeight: 'bold',
                      boxShadow: '0 0 12px var(--color-cyan-glow)'
                    }}
                  >
                    <span>🔖</span> Confirmar Selección como Reserva
                  </button>
                </div>

                {/* Formulario de Cotización Formal */}
                <form onSubmit={handleGenerarCotizacion} style={{ borderTop: '1px solid #30363D', paddingTop: '14px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#F0F6FC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📋</span> Solicitar Cotización Formal
                  </h4>
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
                  <label style={{ display: 'block', margin: '0 0 14px' }}>
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
                    {cargando ? 'Generando Cotización...' : '📄 Generar Cotización Oficial'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: CONSULTAR COTIZACIÓN POR CÓDIGO */}
        {activeTab === 'consultar' && (
          <div style={{ padding: '6px 0' }}>
            <p style={{ fontSize: '13px', color: '#C9D1D9', marginBottom: '14px' }}>
              Ingresa el código correlativo de tu cotización (ej. <code>COT-2026-1234</code>) para revisar su vigencia y detalle de productos.
            </p>
            <form onSubmit={handleBuscarCotizacion} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                required
                value={codigoBusqueda}
                onChange={e => setCodigoBusqueda(e.target.value.toUpperCase())}
                placeholder="COT-2026-XXXX"
                style={{ flex: 1, textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '14px' }}
              />
              <button
                type="submit"
                className="primary"
                disabled={cargando}
                style={{ whiteSpace: 'nowrap', padding: '0 20px' }}
              >
                {cargando ? 'Buscando...' : '🔍 Buscar'}
              </button>
            </form>
          </div>
        )}

        {/* PESTAÑA 3: HOJA DE COTIZACIÓN FORMAL (IMPRIMIBLE) */}
        {activeTab === 'resultado' && cotizacionGenerada && (
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
                onClick={handleImprimir}
                className="secondary"
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                onClick={handleCompartirWhatsApp}
                className="primary"
                style={{ flex: 1, padding: '10px', fontSize: '13px', background: '#25D366', color: '#000000', fontWeight: 'bold' }}
              >
                💬 Enviar por WhatsApp
              </button>
              <button
                type="button"
                className="secondary"
                onClick={onClose}
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
