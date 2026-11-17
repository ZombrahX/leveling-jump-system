import React, { useState, useEffect, useMemo } from 'react';
import { cotizacionService } from '../services/cotizacionService';

export default function CotizacionesList({ token }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroVigencia, setFiltroVigencia] = useState(''); // '' | 'vigente' | 'vencida'
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);

  const cargar = async () => {
    try {
      setCargando(true);
      setError('');
      const data = await cotizacionService.listar(token);
      setCotizaciones(data.cotizaciones || []);
    } catch (err) {
      setError(err.message || 'Error al cargar el historial de cotizaciones.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [token]);

  // Filtrado reactivo en cliente
  const filtradas = useMemo(() => {
    const ahora = new Date();
    return cotizaciones.filter(c => {
      const q = busqueda.trim().toLowerCase();
      const matchText = (
        (c.codigoCotizacion || '').toLowerCase().includes(q) ||
        (c.nombreCliente || '').toLowerCase().includes(q) ||
        (c.telefonoCliente || '').toLowerCase().includes(q) ||
        (c.emailCliente || '').toLowerCase().includes(q)
      );

      if (!matchText) return false;

      const esVigente = new Date(c.fechaVencimiento) >= ahora;
      if (filtroVigencia === 'vigente' && !esVigente) return false;
      if (filtroVigencia === 'vencida' && esVigente) return false;

      return true;
    });
  }, [cotizaciones, busqueda, filtroVigencia]);

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const ahora = new Date();
    let totalMonto = 0;
    let vigentes = 0;

    cotizaciones.forEach(c => {
      totalMonto += parseFloat(c.total || 0);
      if (new Date(c.fechaVencimiento) >= ahora) {
        vigentes++;
      }
    });

    return {
      totalCount: cotizaciones.length,
      totalMonto: totalMonto.toFixed(2),
      vigentes,
      vencidas: cotizaciones.length - vigentes
    };
  }, [cotizaciones]);

  const handleWhatsAppContact = (c) => {
    const telLimpio = (c.telefonoCliente || '').replace(/\D/g, '');
    const num = telLimpio.startsWith('51') ? telLimpio : `51${telLimpio}`;
    const msg = encodeURIComponent(
      `¡Hola ${c.nombreCliente}! Te saludamos de Leveling Jump. Te contactamos para dar seguimiento a tu cotización *${c.codigoCotizacion}* por S/ ${parseFloat(c.total).toFixed(2)}. ¿Tienes alguna consulta o deseas formalizar tu pedido antes de que venza?`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  return (
    <section className="card" style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Historial y Seguimiento de Cotizaciones</h2>
          <p className="muted">
            Auditoría comercial de proformas emitidas, control de vigencia (7 días) y contacto directo con compradores.
          </p>
        </div>
        <button className="secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando...' : '🔄 Refrescar'}
        </button>
      </div>

      {/* Tarjetas de métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Cotizaciones Emitidas
          </span>
          <strong style={{ fontSize: '20px', color: '#FFFFFF' }}>{stats.totalCount}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Monto Total Cotizado
          </span>
          <strong style={{ fontSize: '20px', color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
            S/ {stats.totalMonto}
          </strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Cotizaciones Vigentes
          </span>
          <strong style={{ fontSize: '20px', color: '#10B981' }}>{stats.vigentes}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Cotizaciones Vencidas
          </span>
          <strong style={{ fontSize: '20px', color: '#EF4444' }}>{stats.vencidas}</strong>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="filters" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código COT, nombre de cliente o WhatsApp..."
          style={{ flex: 1, minWidth: '280px' }}
        />
        <select value={filtroVigencia} onChange={e => setFiltroVigencia(e.target.value)}>
          <option value="">Todas las cotizaciones</option>
          <option value="vigente">Solo Vigentes (Precios activos)</option>
          <option value="vencida">Solo Vencidas (+7 días)</option>
        </select>
      </div>

      {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}

      {/* Tabla de cotizaciones */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #30363D', color: '#8B949E' }}>
              <th style={{ padding: '10px 8px' }}>Código</th>
              <th style={{ padding: '10px 8px' }}>Cliente / WhatsApp</th>
              <th style={{ padding: '10px 8px' }}>Productos Cotizados</th>
              <th style={{ padding: '10px 8px' }}>Total</th>
              <th style={{ padding: '10px 8px' }}>Emisión</th>
              <th style={{ padding: '10px 8px' }}>Vencimiento</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(c => {
              const ahora = new Date();
              const vence = new Date(c.fechaVencimiento);
              const esVigente = vence >= ahora;
              const cantItems = (c.items || []).reduce((acc, it) => acc + (it.cantidad || 1), 0);

              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #21262D' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                    {c.codigoCotizacion}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ fontWeight: '600', color: '#FFFFFF' }}>{c.nombreCliente}</div>
                    <small style={{ color: '#8B949E' }}>📱 {c.telefonoCliente}</small>
                    {c.emailCliente && (
                      <small style={{ color: '#64748B', display: 'block' }}>✉️ {c.emailCliente}</small>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ fontSize: '12.5px', color: '#E2E8F0', maxWidth: '280px' }}>
                      {(c.items || []).map(it => `${it.cantidad}x ${it.nombreProducto}`).join(', ')}
                    </div>
                    <small style={{ color: '#8B949E', fontSize: '11px' }}>
                      ({cantItems} {cantItems === 1 ? 'artículo' : 'artículos'})
                    </small>
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#10B981', fontFamily: 'monospace', fontSize: '13.5px' }}>
                    S/ {parseFloat(c.total || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#8B949E', fontSize: '12px' }}>
                    {new Date(c.fechaEmision).toLocaleDateString('es-PE')}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: '12px', color: esVigente ? '#E2E8F0' : '#EF4444' }}>
                    {new Date(c.fechaVencimiento).toLocaleDateString('es-PE')}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: esVigente ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: esVigente ? '#10B981' : '#EF4444',
                      border: `1px solid ${esVigente ? '#10B981' : '#EF4444'}`
                    }}>
                      {esVigente ? 'VIGENTE' : 'VENCIDA'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '5px 10px', fontSize: '11.5px', cursor: 'pointer' }}
                        onClick={() => setCotizacionSeleccionada(c)}
                        title="Ver proforma oficial descargable"
                      >
                        📄 Ver Proforma
                      </button>
                      <button
                        type="button"
                        className="primary"
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          background: '#25D366',
                          color: '#000000',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleWhatsAppContact(c)}
                        title="Contactar al cliente por WhatsApp"
                      >
                        💬 Contactar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtradas.length === 0 && !cargando && (
          <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
            No se encontraron cotizaciones con los criterios seleccionados.
          </p>
        )}
      </div>

      {/* Modal flotante de Hoja de Cotización Oficial */}
      {cotizacionSeleccionada && (
        <div className="modal-overlay" onClick={() => setCotizacionSeleccionada(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-cyan)' }}>
                    PROFORMA {cotizacionSeleccionada.codigoCotizacion}
                  </h3>
                  <small style={{ color: '#8B949E', fontSize: '11px' }}>Detalle oficial emitido para el cliente</small>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setCotizacionSeleccionada(null)}>&times;</button>
            </div>

            {/* Documento oficial imprimible */}
            <div
              id="proforma-modal-sheet"
              style={{
                background: '#FFFFFF',
                color: '#111827',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #E2E8F0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '900', color: '#0F172A' }}>LEVELING JUMP</h3>
                  <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748B' }}>Model Kits, Gunpla & Coleccionables</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>WhatsApp Oficial: +51 999 888 777</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '900', color: '#4F46E5', fontFamily: 'monospace' }}>
                    {cotizacionSeleccionada.codigoCotizacion}
                  </h4>
                  <small style={{ display: 'block', fontSize: '10.5px', color: '#64748B' }}>
                    Emisión: {new Date(cotizacionSeleccionada.fechaEmision).toLocaleDateString('es-PE')}
                  </small>
                  <small style={{ display: 'block', fontSize: '10.5px', color: '#D97706', fontWeight: 'bold' }}>
                    Válida hasta: {new Date(cotizacionSeleccionada.fechaVencimiento).toLocaleDateString('es-PE')}
                  </small>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#F8FAFC', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12px' }}>
                <div>
                  <strong style={{ color: '#475569', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Cliente:</strong>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{cotizacionSeleccionada.nombreCliente}</span>
                  <div style={{ color: '#64748B' }}>WhatsApp: {cotizacionSeleccionada.telefonoCliente}</div>
                </div>
                <div>
                  <strong style={{ color: '#475569', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Contacto / Notas:</strong>
                  <div style={{ color: '#64748B' }}>{cotizacionSeleccionada.emailCliente || 'Sin correo registrado'}</div>
                  <div style={{ color: '#64748B', fontStyle: 'italic' }}>{cotizacionSeleccionada.observaciones || 'Sin notas'}</div>
                </div>
              </div>

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
                  {cotizacionSeleccionada.items?.map(it => (
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
                      S/ {parseFloat(cotizacionSeleccionada.total).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => window.print()}
                style={{ flex: 1, padding: '10px' }}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => handleWhatsAppContact(cotizacionSeleccionada)}
                style={{ flex: 1, padding: '10px', background: '#25D366', color: '#000000', fontWeight: 'bold' }}
              >
                💬 Contactar por WhatsApp
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCotizacionSeleccionada(null)}
                style={{ padding: '10px 18px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
