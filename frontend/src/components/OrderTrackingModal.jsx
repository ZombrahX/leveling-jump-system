import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { reservaService } from '../services/reservaService';

const MODALIDADES_TEXTO = {
  RETIRO_FERIA: '🎪 Entrega Presencial',
  RETIRO_TIENDA: '🏪 Retiro en Almacén / Tienda',
  ENVIO_LIMA: '🚕 Envío Local',
  ENVIO_PROVINCIA: '📦 Envío por Agencia / Courier'
};

const ESTADOS_ENTREGA_TEXTO = {
  PENDIENTE_PREPARACION: 'En preparación en almacén',
  LISTO_PARA_ENTREGA: 'Listo para recojo / entrega',
  EN_TRANSITO: 'En camino / Enviado por courier o transporte',
  ENTREGADO: 'Entregado al comprador'
};

function parseInfoCourier(rawGuia) {
  if (!rawGuia) return { medio: null, codigo: null };
  if (rawGuia.includes(' | Cód: ')) {
    const [m, c] = rawGuia.split(' | Cód: ');
    return {
      medio: m.replace(/^Medio:\s*/i, '').trim() || null,
      codigo: (c || '').trim() || null
    };
  }
  if (rawGuia.startsWith('Medio: ')) {
    return { medio: rawGuia.replace(/^Medio:\s*/i, '').trim(), codigo: null };
  }
  if (rawGuia.startsWith('Cód: ')) {
    return { medio: null, codigo: rawGuia.replace(/^Cód:\s*/i, '').trim() };
  }
  return { medio: null, codigo: rawGuia.trim() };
}

function getEtapaNumero(pedido) {
  if (!pedido) return 1;
  if (pedido.estadoEntrega === 'ENTREGADO' || pedido.estadoReserva === 'ENTREGADA') return 4;
  if (pedido.estadoEntrega === 'EN_TRANSITO' || pedido.estadoEntrega === 'LISTO_PARA_ENTREGA') return 3;
  if (pedido.estadoReserva === 'CONFIRMADA' || pedido.estadoPago === 'PARCIAL' || pedido.estadoPago === 'COMPLETADO') return 2;
  return 1;
}

export default function OrderTrackingModal({ token, usuarioActual, onExplorarCatalogo }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('TODOS'); // 'TODOS' | 'EN_PROCESO' | 'EN_RUTA' | 'ENTREGADO'
  const [codigoCopiado, setCodigoCopiado] = useState(null);

  const cargarMisPedidos = useCallback(async () => {
    if (!token) {
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      setError('');
      const data = await reservaService.obtenerMisReservas(token);
      setPedidos(data?.reservas || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los pedidos asociados a tu cuenta.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarMisPedidos();
  }, [cargarMisPedidos]);

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos.filter(p => {
      if (p.estadoReserva === 'CANCELADA') {
        if (filtroEtapa !== 'TODOS') return false;
      }
      const etapa = getEtapaNumero(p);
      if (filtroEtapa === 'EN_PROCESO' && etapa > 2) return false;
      if (filtroEtapa === 'EN_RUTA' && etapa !== 3) return false;
      if (filtroEtapa === 'ENTREGADO' && etapa !== 4) return false;

      if (q) {
        const matchCod = (p.codigoSeguimiento || '').toLowerCase().includes(q);
        const matchProd = (p.producto?.nombre || '').toLowerCase().includes(q);
        const matchGuia = (p.guiaCourier || '').toLowerCase().includes(q);
        const matchDir = (p.direccionEntrega || '').toLowerCase().includes(q);
        if (!matchCod && !matchProd && !matchGuia && !matchDir) return false;
      }
      return true;
    });
  }, [pedidos, busqueda, filtroEtapa]);

  const handleCopiar = (texto, id) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCodigoCopiado(id);
    setTimeout(() => setCodigoCopiado(null), 2500);
  };

  return (
    <section className="card" style={{ width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h2>Rastreo de Mis Pedidos y Entregas</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Historial y seguimiento en tiempo real de los pedidos asociados a tu cuenta, modalidad de transporte y códigos de envío/courier.
          </p>
        </div>
        <button type="button" className="secondary" onClick={cargarMisPedidos} disabled={cargando}>
          {cargando ? 'Actualizando...' : '🔄 Actualizar Estado de Envío'}
        </button>
      </div>

      {/* Buscador y filtros */}
      <div className="filters" style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Filtrar tus pedidos por código, producto, courier o código de envío..."
          style={{ flex: 1, minWidth: '260px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {[
          { id: 'TODOS', label: 'Todos mis pedidos' },
          { id: 'EN_PROCESO', label: '📦 En preparación' },
          { id: 'EN_RUTA', label: '🚚 Listos / En ruta' },
          { id: 'ENTREGADO', label: '🎉 Entregados' }
        ].map(f => {
          const isActive = filtroEtapa === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroEtapa(f.id)}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: isActive ? '700' : '500',
                borderRadius: '20px',
                border: isActive ? '1px solid #0284C7' : '1px solid #CBD5E1',
                background: isActive ? '#E0F2FE' : '#FFFFFF',
                color: isActive ? '#0369A1' : '#475569',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && <div className="alert err" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B' }}>
          <p>Cargando el seguimiento de tus pedidos registrados...</p>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 16px' }}>
          <span style={{ fontSize: '42px', display: 'block', marginBottom: '10px' }}>📍</span>
          <strong>No tienes pedidos registrados con los filtros seleccionados.</strong>
          <span>Cuando apartes un kit desde tu carrito, aquí verás su avance de preparación, el medio de transporte o courier y tu código de envío.</span>
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
        <div style={{ display: 'grid', gap: '18px' }}>
          {pedidosFiltrados.map(pedido => {
            const etapaActual = getEtapaNumero(pedido);
            const esCancelada = pedido.estadoReserva === 'CANCELADA';
            const infoCourier = parseInfoCourier(pedido.guiaCourier);
            const modalidadLabel = MODALIDADES_TEXTO[pedido.modalidadEntrega] || pedido.modalidadEntrega || 'Entrega Presencial';
            const estadoEntregaLabel = ESTADOS_ENTREGA_TEXTO[pedido.estadoEntrega] || pedido.estadoEntrega || 'En preparación en almacén';
            const saldoPendiente = Number(pedido.saldoPendiente ?? 0);

            return (
              <article
                key={pedido.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderLeft: `5px solid ${esCancelada ? '#EF4444' : etapaActual === 4 ? '#10B981' : '#0284C7'}`,
                  borderRadius: '10px',
                  padding: '18px 20px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Cabecera del Pedido */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {pedido.producto?.imagenUrl ? (
                      <img
                        src={pedido.producto.imagenUrl}
                        alt={pedido.producto.nombre}
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                        📦
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '15px', color: '#0284C7', fontFamily: 'monospace' }}>
                          {pedido.codigoSeguimiento}
                        </strong>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: esCancelada ? '#FEF2F2' : etapaActual === 4 ? '#DCFCE7' : '#E0F2FE',
                          color: esCancelada ? '#991B1B' : etapaActual === 4 ? '#166534' : '#0369A1'
                        }}>
                          {esCancelada ? 'PEDIDO CANCELADO' : estadoEntregaLabel.toUpperCase()}
                        </span>
                      </div>
                      <h4 style={{ margin: '4px 0 2px', fontSize: '16px', color: '#0F172A', fontWeight: 800 }}>
                        {pedido.producto?.nombre || 'Producto reservado'}
                      </h4>
                      <small style={{ color: '#64748B', fontSize: '12px' }}>
                        Registrado el {new Date(pedido.fechaReserva).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </small>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontSize: '12.5px' }}>
                    <div style={{ color: '#64748B' }}>
                      Total: <strong style={{ color: '#0F172A' }}>S/ {Number(pedido.montoTotal || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ color: '#059669', fontWeight: 700 }}>
                      Abonado: S/ {Number(pedido.montoAdelanto || 0).toFixed(2)}
                    </div>
                    <div style={{ color: saldoPendiente > 0 ? '#D97706' : '#059669', fontWeight: 800 }}>
                      {saldoPendiente > 0 ? `Saldo pendiente: S/ ${saldoPendiente.toFixed(2)}` : '✅ Pagado al 100%'}
                    </div>
                  </div>
                </div>

                {/* Barra de Progreso Visual de 4 Etapas */}
                {!esCancelada && (
                  <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                      {[
                        { num: 1, label: '1. Pedido Registrado' },
                        { num: 2, label: '2. En Preparación' },
                        { num: 3, label: '3. Listo / En Ruta' },
                        { num: 4, label: '4. Entregado' }
                      ].map(step => {
                        const alcanzado = etapaActual >= step.num;
                        return (
                          <div key={step.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: alcanzado ? '#10B981' : '#E2E8F0',
                              color: alcanzado ? '#FFFFFF' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '13px',
                              marginBottom: '6px',
                              boxShadow: alcanzado ? '0 0 8px rgba(16, 185, 129, 0.35)' : 'none'
                            }}>
                              {alcanzado ? '✓' : step.num}
                            </div>
                            <span style={{ fontSize: '11.5px', fontWeight: alcanzado ? 700 : 500, color: alcanzado ? '#0F172A' : '#94A3B8', textAlign: 'center' }}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detalles de Modalidad, Courier / Transporte y Código de Envío */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                      Modalidad de Entrega:
                    </span>
                    <strong style={{ color: '#0F172A' }}>{modalidadLabel}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                      Courier / Medio de Transporte:
                    </span>
                    <strong style={{ color: infoCourier.medio ? '#0284C7' : '#475569' }}>
                      {infoCourier.medio || 'Entrega directa / Por asignar'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                      Código de Envío / Guía / Tracking:
                    </span>
                    {infoCourier.codigo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <strong style={{
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FCD34D',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '13px'
                        }}>
                          {infoCourier.codigo}
                        </strong>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleCopiar(infoCourier.codigo, pedido.id)}
                          style={{ padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          {codigoCopiado === pedido.id ? '✅ Copiado' : '📋 Copiar'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#64748B' }}>Pendiente de asignación</span>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                      Fecha Estimada / Punto de Entrega:
                    </span>
                    <div style={{ color: '#0F172A', fontWeight: 600 }}>
                      {pedido.fechaEstimadaEntrega
                        ? `📅 ${new Date(pedido.fechaEstimadaEntrega).toLocaleDateString('es-PE')}`
                        : 'Fecha por confirmar'}
                    </div>
                    {pedido.direccionEntrega && (
                      <small style={{ color: '#475569', display: 'block', marginTop: '2px' }}>
                        📍 {pedido.direccionEntrega}
                      </small>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
