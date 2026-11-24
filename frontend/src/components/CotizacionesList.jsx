import React, { useState, useEffect, useMemo } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { obtenerWhatsappTiendaFormateado } from '../services/configuracionService';
import { imprimirProformaOficial } from '../utils/printProforma';

export default function CotizacionesList({ token }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState(''); // '' | 'VIGENTE' | 'ALERTA_STOCK' | 'CONFIRMADA' | 'VENCIDA'
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [cotizacionAlertaModal, setCotizacionAlertaModal] = useState(null);

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

  const filtradas = useMemo(() => {
    return cotizaciones.filter(c => {
      const q = busqueda.trim().toLowerCase();
      const matchText =
        !q ||
        (c.codigoCotizacion || '').toLowerCase().includes(q) ||
        (c.nombreCliente || '').toLowerCase().includes(q) ||
        (c.telefonoCliente || '').toLowerCase().includes(q) ||
        (c.emailCliente || '').toLowerCase().includes(q) ||
        (c.items || []).some(it => (it.nombreProducto || '').toLowerCase().includes(q));

      if (!matchText) return false;

      const est = c.estadoCotizacion || 'VIGENTE';
      if (filtroEstado === 'VIGENTE' && est !== 'VIGENTE') return false;
      if (filtroEstado === 'ALERTA_STOCK' && est !== 'VARIACION_STOCK' && est !== 'SIN_STOCK') return false;
      if (filtroEstado === 'CONFIRMADA' && est !== 'CONFIRMADA') return false;
      if (filtroEstado === 'VENCIDA' && est !== 'VENCIDA') return false;

      return true;
    });
  }, [cotizaciones, busqueda, filtroEstado]);

  const stats = useMemo(() => {
    let totalMonto = 0;
    let vigentes = 0;
    let conAlertaStock = 0;
    let confirmadas = 0;

    cotizaciones.forEach(c => {
      totalMonto += parseFloat(c.total || 0);
      const est = c.estadoCotizacion || 'VIGENTE';
      if (est === 'VIGENTE') vigentes++;
      if (est === 'VARIACION_STOCK' || est === 'SIN_STOCK') conAlertaStock++;
      if (est === 'CONFIRMADA') confirmadas++;
    });

    return {
      totalCount: cotizaciones.length,
      totalMonto: totalMonto.toFixed(2),
      vigentes,
      conAlertaStock,
      confirmadas
    };
  }, [cotizaciones]);

  const handleWhatsAppContact = (c) => {
    const telLimpio = (c.telefonoCliente || '').replace(/\D/g, '');
    const num = telLimpio.startsWith('51') ? telLimpio : `51${telLimpio}`;
    const msg = encodeURIComponent(
      `¡Hola ${c.nombreCliente}! Te saludamos de Leveling Jump. Te contactamos respecto a tu cotización *${c.codigoCotizacion}* por S/ ${parseFloat(c.total).toFixed(2)}.`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmarORecalcular = async (cot, accion = 'confirmar') => {
    try {
      setProcesandoId(cot.id);
      setError('');
      setMensajeOk('');
      const resp = await cotizacionService.confirmarORecalcular(cot.id, accion, token);
      setMensajeOk(resp.mensaje || 'Cotización actualizada y recalculada correctamente.');
      setCotizacionAlertaModal(null);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo procesar la cotización.');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleEliminar = async (cot) => {
    if (!window.confirm(`¿Deseas eliminar definitivamente la cotización ${cot.codigoCotizacion} de ${cot.nombreCliente}?`)) {
      return;
    }
    try {
      setProcesandoId(cot.id);
      setError('');
      setMensajeOk('');
      const resp = await cotizacionService.eliminar(cot.id, token);
      setMensajeOk(resp.mensaje || `Cotización ${cot.codigoCotizacion} eliminada.`);
      setCotizacionAlertaModal(null);
      if (cotizacionSeleccionada?.id === cot.id) setCotizacionSeleccionada(null);
      try {
        const cacheStr = localStorage.getItem('lj_mis_cotizaciones_cache');
        if (cacheStr) {
          const arr = JSON.parse(cacheStr).filter(x => x.codigoCotizacion !== cot.codigoCotizacion);
          localStorage.setItem('lj_mis_cotizaciones_cache', JSON.stringify(arr));
        }
      } catch (_) {}
      await cargar();
    } catch (err) {
      setError(err.message || 'Error al eliminar la cotización.');
    } finally {
      setProcesandoId(null);
    }
  };

  const renderBadgeEstado = (c) => {
    const est = c.estadoCotizacion || 'VIGENTE';
    if (est === 'SIN_STOCK') {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 800,
          background: '#FEF2F2',
          color: '#DC2626',
          border: '1px solid #FCA5A5'
        }}>
          🚫 IMPOSIBLE COTIZAR (SIN STOCK)
        </span>
      );
    }
    if (est === 'VARIACION_STOCK') {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 800,
          background: '#FFFBEB',
          color: '#D97706',
          border: '1px solid #FCD34D'
        }}>
          ⚠️ VARIACIÓN DE STOCK
        </span>
      );
    }
    if (est === 'CONFIRMADA') {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 800,
          background: '#E0F2FE',
          color: '#0284C7',
          border: '1px solid #7DD3FC'
        }}>
          ✅ CONFIRMADA
        </span>
      );
    }
    if (est === 'VENCIDA') {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 800,
          background: '#F1F5F9',
          color: '#64748B',
          border: '1px solid #CBD5E1'
        }}>
          VENCIDA
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 800,
        background: '#ECFDF5',
        color: '#059669',
        border: '1px solid #6EE7B7'
      }}>
        VIGENTE
      </span>
    );
  };

  return (
    <section className="card" style={{ width: '100%', margin: '0 auto' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Historial y Seguimiento de Cotizaciones</h2>
          <p className="muted">
            Auditoría comercial de proformas emitidas, validación de stock en tiempo real, recálculo y confirmación.
          </p>
        </div>
        <button className="secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando...' : '🔄 Refrescar Stock y Cotizaciones'}
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
            Vigentes (Stock OK)
          </span>
          <strong style={{ fontSize: '20px', color: '#10B981' }}>{stats.vigentes}</strong>
        </div>

        <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px' }}>
          <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '4px' }}>
            Alertas de Stock / Agotados
          </span>
          <strong style={{ fontSize: '20px', color: '#F59E0B' }}>{stats.conAlertaStock}</strong>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="filters" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código COT, cliente, WhatsApp o producto..."
          style={{ flex: 1, minWidth: '280px' }}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todas las cotizaciones</option>
          <option value="VIGENTE">🟢 Vigentes (Stock completo)</option>
          <option value="ALERTA_STOCK">⚠️ Con Variación de Stock / Sin Stock</option>
          <option value="CONFIRMADA">✅ Confirmadas</option>
          <option value="VENCIDA">🔴 Vencidas (+7 días)</option>
        </select>
      </div>

      {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
      {mensajeOk && <div className="alert ok" style={{ marginBottom: '14px' }}>✅ {mensajeOk}</div>}

      {/* Tabla de cotizaciones */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #CBD5E1', color: '#334155', background: '#F8FAFC' }}>
              <th style={{ padding: '10px 8px' }}>Código</th>
              <th style={{ padding: '10px 8px' }}>Cliente / WhatsApp</th>
              <th style={{ padding: '10px 8px' }}>Productos Cotizados & Disponibilidad Actual</th>
              <th style={{ padding: '10px 8px' }}>Total</th>
              <th style={{ padding: '10px 8px' }}>Emisión / Venc.</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(c => {
              const est = c.estadoCotizacion || 'VIGENTE';
              const cantItems = (c.items || []).reduce((acc, it) => acc + (it.cantidad || 1), 0);
              const enProceso = procesandoId === c.id;

              return (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                    background: est === 'SIN_STOCK' ? '#FFF5F5' : est === 'VARIACION_STOCK' ? '#FFFBEB' : '#FFFFFF'
                  }}
                >
                  <td style={{ padding: '12px 8px', fontWeight: '800', color: '#0284C7', fontFamily: 'monospace' }}>
                    {c.codigoCotizacion}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{c.nombreCliente}</div>
                    <small style={{ color: '#475569', display: 'block' }}>📱 {c.telefonoCliente}</small>
                    {c.emailCliente && (
                      <small style={{ color: '#64748B', display: 'block' }}>✉️ {c.emailCliente}</small>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {(c.items || []).map((it, idx) => (
                      <div key={it.id || idx} style={{ marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: 700 }}>
                          {it.cantidad}x {it.nombreProducto}
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#475569', marginLeft: '6px' }}>
                          (S/ {parseFloat(it.precioUnitario || 0).toFixed(2)} c/u)
                        </span>
                        {it.estadoStockItem === 'SIN_STOCK' && (
                          <div style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 700, marginTop: '2px' }}>
                            🚫 Imposible cotizar: No hay stock disponible (0 und. en almacén)
                          </div>
                        )}
                        {it.estadoStockItem === 'VARIACION_STOCK' && (
                          <div style={{ fontSize: '11.5px', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
                            ⚠️ Variación de stock: Se redujo el stock de {it.cantidad} a {it.stockDisponibleActual} und. disponibles
                          </div>
                        )}
                        {it.estadoStockItem === 'OK' && (
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginLeft: '8px' }}>
                            · Stock OK ({it.stockDisponibleActual} disp.)
                          </span>
                        )}
                      </div>
                    ))}
                    <small style={{ color: '#64748B', fontSize: '11px' }}>
                      ({cantItems} {cantItems === 1 ? 'artículo solicitado' : 'artículos solicitados'})
                    </small>
                  </td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                    {est === 'SIN_STOCK' ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '12px', display: 'block' }}>
                          S/ {parseFloat(c.total || 0).toFixed(2)}
                        </span>
                        <strong style={{ color: '#DC2626', fontSize: '12.5px' }}>Sin Stock (S/ 0.00)</strong>
                      </div>
                    ) : est === 'VARIACION_STOCK' ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '12px', display: 'block' }}>
                          S/ {parseFloat(c.total || 0).toFixed(2)}
                        </span>
                        <strong style={{ color: '#D97706', fontSize: '13.5px' }}>
                          Nuevo: S/ {parseFloat(c.totalRecalculado || 0).toFixed(2)}
                        </strong>
                      </div>
                    ) : (
                      <strong style={{ color: '#059669', fontSize: '14px' }}>
                        S/ {parseFloat(c.total || 0).toFixed(2)}
                      </strong>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: '#334155', fontSize: '12px' }}>
                    <div>Emitida: {new Date(c.fechaEmision).toLocaleDateString('es-PE')}</div>
                    <div style={{ color: '#64748B', fontSize: '11px' }}>
                      Vence: {new Date(c.fechaVencimiento).toLocaleDateString('es-PE')}
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {renderBadgeEstado(c)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {est === 'VARIACION_STOCK' && (
                        <button
                          type="button"
                          className="primary"
                          disabled={enProceso}
                          style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            background: '#F59E0B',
                            color: '#0F172A',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          onClick={() => setCotizacionAlertaModal(c)}
                          title="Revisar variación de stock y recalcular total antes de confirmar"
                        >
                          🔄 Recalcular / Confirmar
                        </button>
                      )}

                      {est === 'VIGENTE' && (
                        <button
                          type="button"
                          className="primary"
                          disabled={enProceso}
                          style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            background: '#0284C7',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleConfirmarORecalcular(c, 'confirmar')}
                          title="Confirmar cotización con stock verificado"
                        >
                          ✅ Confirmar
                        </button>
                      )}

                      {est === 'SIN_STOCK' && (
                        <button
                          type="button"
                          className="secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            borderColor: '#EF4444',
                            color: '#DC2626',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          onClick={() => setCotizacionAlertaModal(c)}
                          title="Ver detalle de falta de stock"
                        >
                          ⚠️ Ver Alerta
                        </button>
                      )}

                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '5px 10px', fontSize: '11.5px', cursor: 'pointer' }}
                        onClick={() => setCotizacionSeleccionada(c)}
                        title="Ver e imprimir proforma oficial"
                      >
                        📄 Proforma
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
                        💬 WhatsApp
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        disabled={enProceso}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          borderColor: '#FCA5A5',
                          color: '#DC2626',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleEliminar(c)}
                        title="Eliminar esta cotización"
                      >
                        🗑️ Eliminar
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

      {/* Modal de Advertencia de Disponibilidad / Recálculo (Escenario 3) */}
      {cotizacionAlertaModal && (
        <div className="modal-overlay" onClick={() => setCotizacionAlertaModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{cotizacionAlertaModal.todosSinStock ? '🚫' : '⚠️'}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: cotizacionAlertaModal.todosSinStock ? '#EF4444' : '#F59E0B' }}>
                    {cotizacionAlertaModal.todosSinStock
                      ? 'IMPOSIBLE COTIZAR: PRODUCTO SIN STOCK'
                      : 'ADVERTENCIA: VARIACIÓN DE STOCK DISPONIBLE'}
                  </h3>
                  <small style={{ color: '#8B949E', fontSize: '11px' }}>
                    Verificación de inventario antes de calcular el total ({cotizacionAlertaModal.codigoCotizacion})
                  </small>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setCotizacionAlertaModal(null)}>&times;</button>
            </div>

            <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#E2E8F0', lineHeight: 1.45 }}>
                El stock físico en almacén cambió desde que se solicitó esta cotización debido a ventas o reservas entregadas:
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#FCD34D', fontSize: '12.5px', lineHeight: 1.6 }}>
                {(cotizacionAlertaModal.alertasStock || []).map((al, i) => (
                  <li key={i} style={{ color: al.includes('Imposible') ? '#F87171' : '#FBBF24', fontWeight: 600 }}>
                    {al}
                  </li>
                ))}
              </ul>
            </div>

            {!cotizacionAlertaModal.todosSinStock ? (
              <div className="reserva-breakdown" style={{ marginBottom: '16px' }}>
                <div className="reserva-breakdown-row">
                  <span>Total Original Cotizado:</span>
                  <span style={{ textDecoration: 'line-through', color: '#8B949E' }}>
                    S/ {parseFloat(cotizacionAlertaModal.total || 0).toFixed(2)}
                  </span>
                </div>
                <div className="reserva-breakdown-row" style={{ color: 'var(--color-cyan)', fontSize: '15px' }}>
                  <span>Nuevo Total Calculado según Stock Real:</span>
                  <strong>S/ {parseFloat(cotizacionAlertaModal.totalRecalculado || 0).toFixed(2)}</strong>
                </div>
              </div>
            ) : (
              <div className="alert err" style={{ marginBottom: '16px' }}>
                🚫 No quedan unidades disponibles para ninguno de los artículos de esta cotización. No es posible confirmar ni calcular un nuevo total; se recomienda eliminar la cotización.
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!cotizacionAlertaModal.todosSinStock && (
                <>
                  <button
                    type="button"
                    className="primary"
                    disabled={procesandoId === cotizacionAlertaModal.id}
                    onClick={() => handleConfirmarORecalcular(cotizacionAlertaModal, 'recalcular')}
                    style={{ flex: 1, padding: '10px', background: '#F59E0B', color: '#0F172A', fontWeight: 800 }}
                  >
                    🔄 Actualizar Stock y Recalcular (S/ {parseFloat(cotizacionAlertaModal.totalRecalculado || 0).toFixed(2)})
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={procesandoId === cotizacionAlertaModal.id}
                    onClick={() => handleConfirmarORecalcular(cotizacionAlertaModal, 'confirmar')}
                    style={{ flex: 1, padding: '10px', background: '#10B981', color: '#0F172A', fontWeight: 800 }}
                  >
                    ✅ Recalcular y Confirmar
                  </button>
                </>
              )}
              <button
                type="button"
                className="secondary"
                disabled={procesandoId === cotizacionAlertaModal.id}
                onClick={() => handleEliminar(cotizacionAlertaModal)}
                style={{ padding: '10px 16px', borderColor: '#EF4444', color: '#F87171', fontWeight: 700 }}
              >
                🗑️ Eliminar Cotización
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCotizacionAlertaModal(null)}
                style={{ padding: '10px 16px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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

            {cotizacionSeleccionada.alertasStock?.length > 0 && (
              <div className="alert err" style={{ marginBottom: '12px' }}>
                <strong>⚠️ Aviso de Disponibilidad en Almacén:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
                  {cotizacionSeleccionada.alertasStock.map((al, idx) => (
                    <li key={idx}>{al}</li>
                  ))}
                </ul>
              </div>
            )}

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
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>WhatsApp Oficial: {obtenerWhatsappTiendaFormateado()}</p>
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
                onClick={() => imprimirProformaOficial(cotizacionSeleccionada)}
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
                💬 Enviar por WhatsApp
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
