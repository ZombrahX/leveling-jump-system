import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { imprimirProformaOficial } from '../utils/printProforma';

export default function CustomerQuotations({ token, usuarioActual, onExplorarCatalogo }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');

  // Filtros: código/producto, fecha de emisión y estado
  const [busquedaCodigo, setBusquedaCodigo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroVigencia, setFiltroVigencia] = useState('TODAS'); // 'TODAS' | 'VIGENTE' | 'ALERTA_STOCK' | 'CONFIRMADA' | 'VENCIDA'

  // Modales
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [cotizacionAlertaModal, setCotizacionAlertaModal] = useState(null);

  const cargarMisCotizaciones = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Extraer códigos guardados en este navegador para que el backend también los incluya y valide su stock real
      let codigosLocales = [];
      try {
        const cacheStr = localStorage.getItem('lj_mis_cotizaciones_cache');
        if (cacheStr) {
          const parsed = JSON.parse(cacheStr);
          if (Array.isArray(parsed)) {
            codigosLocales = parsed.map(c => c?.codigoCotizacion).filter(Boolean);
          }
        }
      } catch (_) {}

      const data = await cotizacionService.obtenerMisCotizaciones(token, codigosLocales);
      const remotas = data?.cotizaciones || [];
      setCotizaciones(remotas);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus cotizaciones.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarMisCotizaciones();
  }, [cargarMisCotizaciones]);

  const cotizacionesFiltradas = useMemo(() => {
    const q = busquedaCodigo.trim().toLowerCase();

    return cotizaciones.filter(c => {
      const est = c.estadoCotizacion || 'VIGENTE';
      if (filtroVigencia === 'VIGENTE' && est !== 'VIGENTE') return false;
      if (filtroVigencia === 'ALERTA_STOCK' && est !== 'VARIACION_STOCK' && est !== 'SIN_STOCK') return false;
      if (filtroVigencia === 'CONFIRMADA' && est !== 'CONFIRMADA') return false;
      if (filtroVigencia === 'VENCIDA' && est !== 'VENCIDA') return false;

      if (filtroFecha) {
        const fechaEmisionISO = c.fechaEmision ? new Date(c.fechaEmision).toISOString().split('T')[0] : '';
        if (fechaEmisionISO !== filtroFecha) return false;
      }

      if (q) {
        const matchCodigo = (c.codigoCotizacion || '').toLowerCase().includes(q);
        const matchCliente = (c.nombreCliente || '').toLowerCase().includes(q);
        const matchNotas = (c.observaciones || '').toLowerCase().includes(q);
        const matchItems = (c.items || []).some(it => (it.nombreProducto || '').toLowerCase().includes(q));
        if (!matchCodigo && !matchCliente && !matchNotas && !matchItems) return false;
      }

      return true;
    });
  }, [cotizaciones, busquedaCodigo, filtroFecha, filtroVigencia]);

  const handleCompartirWhatsApp = (cot) => {
    const msg = encodeURIComponent(
      `¡Hola Leveling Jump! Solicito confirmar mi cotización oficial *${cot.codigoCotizacion}* por un total de *S/ ${parseFloat(cot.total || 0).toFixed(2)}* emitida a nombre de ${cot.nombreCliente}.`
    );
    window.open(`https://wa.me/51999999999?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmarORecalcular = async (cot, accion = 'confirmar') => {
    try {
      setProcesandoId(cot.id);
      setError('');
      setMensajeOk('');
      const resp = await cotizacionService.confirmarORecalcular(cot.id, accion, token);
      setMensajeOk(resp.mensaje || 'Cotización recalculada y actualizada.');
      setCotizacionAlertaModal(null);
      await cargarMisCotizaciones();
    } catch (err) {
      setError(err.message || 'No se pudo procesar la cotización.');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleEliminar = async (cot) => {
    if (!window.confirm(`¿Deseas eliminar la cotización ${cot.codigoCotizacion}?`)) {
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
      await cargarMisCotizaciones();
    } catch (err) {
      setError(err.message || 'Error al eliminar la cotización.');
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <section className="card" style={{ width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h2>Mis Cotizaciones</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Historial de proformas comerciales emitidas a tu cuenta, verificación de stock en tiempo real y descarga en PDF.
          </p>
        </div>
        <button type="button" className="secondary" onClick={cargarMisCotizaciones} disabled={loading}>
          {loading ? 'Actualizando...' : '🔄 Actualizar Stock y Cotizaciones'}
        </button>
      </div>

      {/* Barra de búsqueda por Código, Fecha y Estado */}
      <div className="filters" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={busquedaCodigo}
          onChange={e => setBusquedaCodigo(e.target.value)}
          placeholder="Buscar por código (ej: COT-2026-XXXX), producto o notas..."
          style={{ flex: 2, minWidth: '250px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '210px' }}>
          <input
            type="date"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
            title="Filtrar por fecha de emisión"
            style={{ flex: 1 }}
          />
          {filtroFecha && (
            <button
              type="button"
              className="secondary"
              onClick={() => setFiltroFecha('')}
              style={{ padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              Limpiar fecha
            </button>
          )}
        </div>
      </div>

      {/* Píldoras de estado de vigencia y disponibilidad */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {[
          { id: 'TODAS', label: 'Todas mis cotizaciones' },
          { id: 'VIGENTE', label: '🟢 Vigentes (Stock Completo)' },
          { id: 'ALERTA_STOCK', label: '⚠️ Con Variación / Sin Stock' },
          { id: 'CONFIRMADA', label: '✅ Confirmadas' },
          { id: 'VENCIDA', label: '🔴 Vencidas (+7 días)' }
        ].map(est => {
          const isActive = filtroVigencia === est.id;
          return (
            <button
              key={est.id}
              type="button"
              onClick={() => setFiltroVigencia(est.id)}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: isActive ? '700' : '500',
                borderRadius: '20px',
                border: isActive ? '1px solid #0284C7' : '1px solid #CBD5E1',
                background: isActive ? '#E0F2FE' : '#FFFFFF',
                color: isActive ? '#0369A1' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {est.label}
            </button>
          );
        })}
      </div>

      {error && <div className="alert err" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}
      {mensajeOk && <div className="alert ok" style={{ marginBottom: '16px' }}>✅ {mensajeOk}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B' }}>
          <p>Verificando tus cotizaciones y disponibilidad de stock en almacén...</p>
        </div>
      ) : cotizacionesFiltradas.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 16px' }}>
          <span style={{ fontSize: '42px', display: 'block', marginBottom: '10px' }}>📋</span>
          <strong>No se encontraron cotizaciones con los filtros actuales.</strong>
          <span>Agrega productos a tu carrito en el catálogo y selecciona "Emitir Cotización Formal" para congelar precios por 7 días.</span>
          {onExplorarCatalogo && (
            <button
              type="button"
              className="primary"
              style={{ marginTop: '16px', alignSelf: 'center' }}
              onClick={onExplorarCatalogo}
            >
              Explorar Catálogo Comercial
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {cotizacionesFiltradas.map(cot => {
            const ahora = new Date();
            const fechaVenc = new Date(cot.fechaVencimiento);
            const diasRestantes = Math.max(0, Math.ceil((fechaVenc - ahora) / (1000 * 60 * 60 * 24)));
            const totalUnidades = (cot.items || []).reduce((acc, it) => acc + Number(it.cantidad || 1), 0);
            const est = cot.estadoCotizacion || 'VIGENTE';
            const enProceso = procesandoId === cot.id;

            const borderLeftColor =
              est === 'SIN_STOCK' ? '#EF4444' :
              est === 'VARIACION_STOCK' ? '#F59E0B' :
              est === 'CONFIRMADA' ? '#0284C7' :
              est === 'VENCIDA' ? '#94A3B8' : '#10B981';

            return (
              <article
                key={cot.id || cot.codigoCotizacion}
                style={{
                  background: est === 'SIN_STOCK' ? '#FFF5F5' : est === 'VARIACION_STOCK' ? '#FFFDF5' : '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderLeft: `5px solid ${borderLeftColor}`,
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Cabecera de la cotización */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '16px', color: '#0284C7', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                        {cot.codigoCotizacion}
                      </strong>

                      {est === 'SIN_STOCK' && (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                          🚫 IMPOSIBLE COTIZAR — SIN STOCK DISPONIBLE
                        </span>
                      )}
                      {est === 'VARIACION_STOCK' && (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D' }}>
                          ⚠️ ALERTA: VARIACIÓN DE STOCK EN ALMACÉN
                        </span>
                      )}
                      {est === 'CONFIRMADA' && (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: '#E0F2FE', color: '#0284C7', border: '1px solid #7DD3FC' }}>
                          ✅ COTIZACIÓN CONFIRMADA
                        </span>
                      )}
                      {est === 'VIGENTE' && (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                          🟢 VIGENTE ({diasRestantes} {diasRestantes === 1 ? 'día restante' : 'días restantes'})
                        </span>
                      )}
                      {est === 'VENCIDA' && (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}>
                          VENCIDA
                        </span>
                      )}
                    </div>
                    <small style={{ color: '#64748B', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                      Emitida el {new Date(cot.fechaEmision).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} · Válida hasta el {new Date(cot.fechaVencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </small>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block', fontWeight: 600 }}>IMPORTE TOTAL COTIZADO</span>
                    {est === 'SIN_STOCK' ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '13px', marginRight: '8px' }}>
                          S/ {parseFloat(cot.total || 0).toFixed(2)}
                        </span>
                        <strong style={{ fontSize: '16px', color: '#DC2626', fontFamily: 'monospace' }}>
                          No disponible (S/ 0.00)
                        </strong>
                      </div>
                    ) : est === 'VARIACION_STOCK' ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '13px', marginRight: '8px' }}>
                          S/ {parseFloat(cot.total || 0).toFixed(2)}
                        </span>
                        <strong style={{ fontSize: '17px', color: '#D97706', fontFamily: 'monospace' }}>
                          Recalculable: S/ {parseFloat(cot.totalRecalculado || 0).toFixed(2)}
                        </strong>
                      </div>
                    ) : (
                      <strong style={{ fontSize: '18px', color: '#0F172A', fontFamily: 'monospace' }}>
                        S/ {parseFloat(cot.total || 0).toFixed(2)}
                      </strong>
                    )}
                  </div>
                </div>

                {/* Banner de alerta Escenario 3 cuando el stock varió o se agotó */}
                {(est === 'SIN_STOCK' || est === 'VARIACION_STOCK') && (
                  <div style={{
                    background: est === 'SIN_STOCK' ? '#FEF2F2' : '#FFFBEB',
                    border: `1px solid ${est === 'SIN_STOCK' ? '#FCA5A5' : '#FCD34D'}`,
                    color: est === 'SIN_STOCK' ? '#991B1B' : '#92400E',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    lineHeight: 1.45
                  }}>
                    <strong>
                      {est === 'SIN_STOCK'
                        ? '🚫 Alerta de Disponibilidad: Imposible cotizar este pedido.'
                        : '⚠️ Alerta de Disponibilidad: El stock de uno o más productos se redujo.'}
                    </strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                      {(cot.alertasStock || []).map((al, i) => (
                        <li key={i}>{al}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tabla de productos incluidos */}
                <div style={{ background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '10px 14px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                        <th style={{ padding: '6px 4px' }}>Producto Cotizado</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center' }}>Cant. Solicitada</th>
                        <th style={{ padding: '6px 4px', textAlign: 'center' }}>Stock Actual</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Precio Unitario</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cot.items || []).map((it, idx) => (
                        <tr key={it.id || idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 700, color: '#0F172A' }}>
                            {it.nombreProducto}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                            {it.cantidad}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            {it.estadoStockItem === 'SIN_STOCK' ? (
                              <span style={{ color: '#DC2626', fontWeight: 800 }}>0 disp. (Agotado)</span>
                            ) : it.estadoStockItem === 'VARIACION_STOCK' ? (
                              <span style={{ color: '#D97706', fontWeight: 800 }}>
                                Solo {it.stockDisponibleActual} disp.
                              </span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 700 }}>
                                {it.stockDisponibleActual} disp.
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                            S/ {parseFloat(it.precioUnitario || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                            S/ {parseFloat(it.subtotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Datos adicionales y botones */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    <span><strong>Titular:</strong> {cot.nombreCliente} ({cot.telefonoCliente})</span>
                    {cot.observaciones && (
                      <span style={{ marginLeft: '12px', fontStyle: 'italic', color: '#64748B' }}>
                        · Notas: "{cot.observaciones}"
                      </span>
                    )}
                    <span style={{ marginLeft: '12px', color: '#0284C7', fontWeight: 600 }}>
                      · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {est === 'VARIACION_STOCK' && (
                      <button
                        type="button"
                        className="primary"
                        disabled={enProceso}
                        onClick={() => setCotizacionAlertaModal(cot)}
                        style={{
                          padding: '7px 14px',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          background: '#F59E0B',
                          color: '#0F172A',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Actualizar Stock y Recalcular Total
                      </button>
                    )}

                    {est === 'VIGENTE' && (
                      <button
                        type="button"
                        className="primary"
                        disabled={enProceso}
                        onClick={() => handleConfirmarORecalcular(cot, 'confirmar')}
                        style={{
                          padding: '7px 14px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          background: '#0284C7',
                          color: '#FFFFFF',
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Confirmar Cotización
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCotizacionSeleccionada(cot)}
                      style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      📄 Ver / Imprimir Proforma
                    </button>

                    {est !== 'SIN_STOCK' && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => handleCompartirWhatsApp(cot)}
                        style={{
                          padding: '7px 14px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          background: '#16A34A',
                          color: '#FFFFFF',
                          cursor: 'pointer'
                        }}
                      >
                        💬 WhatsApp
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary"
                      disabled={enProceso}
                      onClick={() => handleEliminar(cot)}
                      style={{
                        padding: '7px 14px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        borderColor: '#FCA5A5',
                        color: '#DC2626',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Advertencia Escenario 3: Recalcular Total antes de Confirmar */}
      {cotizacionAlertaModal && (
        <div className="modal-overlay" onClick={() => setCotizacionAlertaModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#F59E0B' }}>
                    VARIACIÓN DE STOCK ANTES DE CALCULAR EL TOTAL
                  </h3>
                  <small style={{ color: '#8B949E', fontSize: '11px' }}>
                    Cotización {cotizacionAlertaModal.codigoCotizacion}
                  </small>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setCotizacionAlertaModal(null)}>&times;</button>
            </div>

            <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#E2E8F0' }}>
                Uno o más productos seleccionados cambiaron de disponibilidad en almacén:
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#FBBF24', fontSize: '12.5px', lineHeight: 1.6 }}>
                {(cotizacionAlertaModal.alertasStock || []).map((al, i) => (
                  <li key={i} style={{ fontWeight: 600 }}>{al}</li>
                ))}
              </ul>
            </div>

            <div className="reserva-breakdown" style={{ marginBottom: '16px' }}>
              <div className="reserva-breakdown-row">
                <span>Total Anterior:</span>
                <span style={{ textDecoration: 'line-through', color: '#8B949E' }}>
                  S/ {parseFloat(cotizacionAlertaModal.total || 0).toFixed(2)}
                </span>
              </div>
              <div className="reserva-breakdown-row" style={{ color: 'var(--color-cyan)', fontSize: '15px' }}>
                <span>Nuevo Total Calculado según Stock Disponible:</span>
                <strong>S/ {parseFloat(cotizacionAlertaModal.totalRecalculado || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              <button
                type="button"
                className="secondary"
                disabled={procesandoId === cotizacionAlertaModal.id}
                onClick={() => handleEliminar(cotizacionAlertaModal)}
                style={{ padding: '10px 16px', borderColor: '#EF4444', color: '#F87171', fontWeight: 700 }}
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Hoja de Cotización Oficial Imprimible */}
      {cotizacionSeleccionada && (
        <div className="modal-overlay" onClick={() => setCotizacionSeleccionada(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-cyan)' }}>
                    COTIZACIÓN {cotizacionSeleccionada.codigoCotizacion}
                  </h3>
                  <small style={{ color: '#8B949E', fontSize: '11px' }}>Proforma comercial oficial — Leveling Jump</small>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setCotizacionSeleccionada(null)}>&times;</button>
            </div>

            <div
              id="hoja-cotizacion-cliente"
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
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Lima, Perú | WhatsApp Oficial: +51 999 888 777</p>
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
                  <div style={{ color: '#64748B' }}>{cotizacionSeleccionada.emailCliente || 'No especificado'}</div>
                  <div style={{ color: '#64748B', fontStyle: 'italic' }}>{cotizacionSeleccionada.observaciones || 'Sin notas adicionales'}</div>
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
                  {cotizacionSeleccionada.items?.map((it, idx) => (
                    <tr key={it.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
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

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', color: '#92400E', lineHeight: 1.4 }}>
                ⚠️ <strong>Condiciones comerciales:</strong> Los precios cotizados se mantienen vigentes durante 7 días calendario a partir de su emisión. Esta cotización comercial <strong>no reserva stock físico en almacén</strong>.
              </div>
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
                onClick={() => handleCompartirWhatsApp(cotizacionSeleccionada)}
                style={{ flex: 1, padding: '10px', background: '#25D366', color: '#000000', fontWeight: 'bold' }}
              >
                💬 Confirmar por WhatsApp
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
