import React, { useState, useEffect, useMemo } from 'react';
import { interesService } from '../services/interesService';

const ESTADOS_INTERES = [
  { id: 'PENDIENTE', label: '⏳ PENDIENTE', bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '#F59E0B' },
  { id: 'NOTIFICADO', label: '📲 NOTIFICADO', bg: 'rgba(0, 210, 238, 0.15)', color: '#00D2EE', border: '#00D2EE' },
  { id: 'CONVERTIDO_RESERVA', label: '✅ RESERVÓ / COMPRÓ', bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '#10B981' },
  { id: 'CANCELADO', label: '❌ DESCARTADO', bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '#EF4444' }
];

export default function InteresesList({ token }) {
  const [resumenDemanda, setResumenDemanda] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState(''); // '' | 'con_stock' | 'agotado'

  const cargar = async () => {
    try {
      setCargando(true);
      setError('');
      const data = await interesService.listarResumen(token);
      setResumenDemanda(data.resumenDemanda || []);
      setTotalRegistros(data.totalRegistros || 0);
    } catch (err) {
      setError(err.message || 'Error al cargar la lista de espera de clientes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [token]);

  const handleCambiarEstadoCliente = async (idInteres, nuevoEstado, nombreCliente) => {
    try {
      setError('');
      setMsg('');
      await interesService.actualizarEstado(idInteres, nuevoEstado, token);
      setMsg(`Estado de ${nombreCliente} actualizado a ${nuevoEstado}.`);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado del cliente.');
    }
  };

  const handleNotificarWhatsApp = async (cliente, producto, tieneStock) => {
    const telLimpio = (cliente.telefono || '').replace(/\D/g, '');
    const num = telLimpio.startsWith('51') ? telLimpio : `51${telLimpio}`;
    const texto = tieneStock
      ? `¡Hola ${cliente.nombre}! Te escribimos de *Leveling Jump* para darte una excelente noticia: acaba de ingresar un nuevo lote de *${producto?.nombre}* (S/ ${parseFloat(producto?.precio || 0).toFixed(2)}), en el cual registraste tu interés. Por estar en nuestra lista de espera tienes prioridad para apartar tu unidad. ¿Deseas que te la reservemos?`
      : `¡Hola ${cliente.nombre}! Te saludamos de *Leveling Jump* respecto a tu registro en la lista de espera para el modelo *${producto?.nombre}*. Te mantenemos al tanto de la próxima llegada del lote.`;

    window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, '_blank');

    // Si estaba pendiente y ya hay stock disponible, marcar automáticamente como NOTIFICADO
    if (cliente.estado === 'PENDIENTE' && tieneStock) {
      try {
        await interesService.actualizarEstado(cliente.id, 'NOTIFICADO', token);
        setMsg(`Se abrió WhatsApp y se marcó a ${cliente.nombre} como NOTIFICADO.`);
        await cargar();
      } catch (_) {}
    }
  };

  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return resumenDemanda.filter(grupo => {
      if (filtroStock === 'con_stock' && !grupo.tieneStockParaAtender) return false;
      if (filtroStock === 'agotado' && grupo.tieneStockParaAtender) return false;

      if (!q) return true;
      const matchProd =
        (grupo.producto?.nombre || '').toLowerCase().includes(q) ||
        (grupo.producto?.codigo || '').toLowerCase().includes(q) ||
        (grupo.producto?.marca || '').toLowerCase().includes(q);

      const matchCliente = (grupo.clientes || []).some(c =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );

      return matchProd || matchCliente;
    });
  }, [resumenDemanda, busqueda, filtroStock]);

  const stats = useMemo(() => {
    const conStockListo = resumenDemanda.filter(g => g.tieneStockParaAtender).length;
    let pendientesNotificar = 0;
    resumenDemanda.forEach(g => {
      if (g.tieneStockParaAtender) {
        pendientesNotificar += (g.clientes || []).filter(c => c.estado === 'PENDIENTE').length;
      }
    });
    return {
      totalProductos: resumenDemanda.length,
      totalSolicitudes: totalRegistros,
      conStockListo,
      pendientesNotificar
    };
  }, [resumenDemanda, totalRegistros]);

  return (
    <section className="card" style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Lista de Espera y Demanda de Productos</h2>
          <p className="muted">
            Identificación automática de clientes interesados cuando un producto agotado vuelve a tener stock tras recibir un nuevo lote.
          </p>
        </div>
        <button className="secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando...' : '🔄 Refrescar'}
        </button>
      </div>

      {/* Tarjetas de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Productos Solicitados
          </span>
          <strong style={{ fontSize: '20px', color: '#FFFFFF' }}>{stats.totalProductos}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Clientes en Lista de Espera
          </span>
          <strong style={{ fontSize: '20px', color: 'var(--color-cyan)' }}>{stats.totalSolicitudes}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #10B981', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
            Productos con Stock Repuesto
          </span>
          <strong style={{ fontSize: '20px', color: '#10B981' }}>{stats.conStockListo}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #F59E0B', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
            Clientes Listos para Avisar
          </span>
          <strong style={{ fontSize: '20px', color: '#F59E0B' }}>{stats.pendientesNotificar}</strong>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre de producto, código SKU, cliente o WhatsApp..."
          style={{ flex: 1, minWidth: '280px' }}
        />
        <select value={filtroStock} onChange={e => setFiltroStock(e.target.value)}>
          <option value="">Todos los productos en lista</option>
          <option value="con_stock">🟢 Con Stock Repuesto (Listos para notificar)</option>
          <option value="agotado">🟠 Aún Agotados (Pendientes de lote)</option>
        </select>
      </div>

      {msg && <div className="alert ok" style={{ marginBottom: '14px' }}>✅ {msg}</div>}
      {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}

      {/* Listado de productos y sus clientes interesados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {gruposFiltrados.map(grupo => {
          const prod = grupo.producto || {};
          const tieneStock = grupo.tieneStockParaAtender;

          return (
            <div
              key={prod.id || Math.random()}
              style={{
                background: '#0D1117',
                border: tieneStock ? '2px solid #10B981' : '1px solid #30363D',
                borderRadius: '10px',
                overflow: 'hidden'
              }}
            >
              {/* Cabecera del producto */}
              <div style={{
                padding: '14px 18px',
                background: tieneStock ? 'rgba(16, 185, 129, 0.1)' : '#161B22',
                borderBottom: '1px solid #30363D',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{prod.nombre || 'Producto'}</strong>
                    {prod.codigo && (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-cyan)', fontFamily: 'monospace', background: '#0D1117', padding: '2px 8px', borderRadius: '4px', border: '1px solid #30363D' }}>
                        {prod.codigo}
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10B981', fontFamily: 'monospace' }}>
                      S/ {parseFloat(prod.precio || 0).toFixed(2)}
                    </span>
                  </div>
                  <small style={{ color: '#8B949E', fontSize: '12px' }}>
                    Marca: {prod.marca || 'Bandai'} · Total de clientes interesados: <strong>{grupo.totalInteresados}</strong>
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {tieneStock ? (
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 800,
                      background: '#10B981',
                      color: '#052E16',
                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                    }}>
                      🟢 ¡STOCK REPUESTO ({grupo.stockDisponibleActual} disp.) — NOTIFICAR CLIENTES!
                    </span>
                  ) : (
                    <span style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#F59E0B',
                      border: '1px solid #F59E0B'
                    }}>
                      🟠 Sin stock actual (0 disp.) — En espera de lote
                    </span>
                  )}
                </div>
              </div>

              {/* Tabla de clientes interesados en este producto */}
              <div style={{ overflowX: 'auto', padding: '8px 14px 14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #30363D', color: '#8B949E' }}>
                      <th style={{ padding: '8px' }}>Cliente Interesado</th>
                      <th style={{ padding: '8px' }}>Teléfono / WhatsApp</th>
                      <th style={{ padding: '8px' }}>Correo</th>
                      <th style={{ padding: '8px' }}>Fecha de Solicitud</th>
                      <th style={{ padding: '8px' }}>Estado de Atención</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Acciones de Notificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grupo.clientes || []).map(c => {
                      const estObj = ESTADOS_INTERES.find(e => e.id === c.estado) || ESTADOS_INTERES[0];
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #21262D' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#FFFFFF' }}>
                            {c.nombre}
                          </td>
                          <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: 'var(--color-cyan)' }}>
                            📱 {c.telefono}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#8B949E', fontSize: '12px' }}>
                            {c.email || '—'}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#8B949E', fontSize: '12px' }}>
                            {c.fecha ? new Date(c.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: estObj.bg,
                              color: estObj.color,
                              border: `1px solid ${estObj.border}`
                            }}>
                              {estObj.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                                onClick={() => handleNotificarWhatsApp(c, prod, tieneStock)}
                                title="Notificar llegada de stock por WhatsApp"
                              >
                                💬 {tieneStock ? 'Avisar Stock' : 'Contactar'}
                              </button>

                              <select
                                value={c.estado}
                                onChange={e => handleCambiarEstadoCliente(c.id, e.target.value, c.nombre)}
                                style={{
                                  fontSize: '11.5px',
                                  padding: '5px 8px',
                                  background: '#161B22',
                                  color: '#FFFFFF',
                                  border: '1px solid #30363D',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="PENDIENTE">PENDIENTE</option>
                                <option value="NOTIFICADO">NOTIFICADO</option>
                                <option value="CONVERTIDO_RESERVA">RESERVÓ / COMPRÓ</option>
                                <option value="CANCELADO">DESCARTADO</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {gruposFiltrados.length === 0 && !cargando && (
          <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
            No hay solicitudes en lista de espera que coincidan con el filtro seleccionado.
          </p>
        )}
      </div>
    </section>
  );
}
