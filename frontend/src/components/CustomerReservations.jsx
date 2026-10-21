import { useState, useEffect, useCallback } from 'react';
import { reservaService } from '../services/reservaService';

export default function CustomerReservations({ token, onExplorarCatalogo }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODAS');

  const cargarReservas = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await reservaService.obtenerMisReservas(token);
      setReservas(data.reservas || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus reservas.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const reservasFiltradas = reservas.filter(r => {
    if (filtroEstado === 'TODAS') return true;
    return r.estadoReserva === filtroEstado;
  });

  const getWhatsAppLink = (reserva) => {
    const text = encodeURIComponent(
      `¡Hola Leveling Jump! Deseo consultar el estado de mi reserva *${reserva.codigoSeguimiento}* para el producto *${reserva.producto?.nombre}*. Adelanto abonado: S/ ${Number(reserva.montoAdelanto).toFixed(2)}, saldo pendiente: S/ ${Number(reserva.saldoPendiente).toFixed(2)}.`
    );
    return `https://wa.me/51999999999?text=${text}`;
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'CONFIRMADA':
        return {
          bg: '#ECFDF5',
          color: '#065F46',
          border: '#A7F3D0',
          accent: '#10B981',
          label: 'CONFIRMADA'
        };
      case 'PENDIENTE':
        return {
          bg: '#FFFBEB',
          color: '#92400E',
          border: '#FDE68A',
          accent: '#F59E0B',
          label: 'PENDIENTE'
        };
      case 'ENTREGADA':
        return {
          bg: '#F1F5F9',
          color: '#334155',
          border: '#CBD5E1',
          accent: '#64748B',
          label: 'ENTREGADA'
        };
      case 'CANCELADA':
        return {
          bg: '#FEF2F2',
          color: '#991B1B',
          border: '#FECACA',
          accent: '#EF4444',
          label: 'CANCELADA'
        };
      default:
        return {
          bg: '#F0F9FF',
          color: '#075985',
          border: '#BAE6FD',
          accent: '#0284C7',
          label: estado
        };
    }
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h2>Mis Reservas</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Historial de kits apartados, adelantos registrados y saldos pendientes contra entrega.
          </p>
        </div>
        <button type="button" className="secondary" onClick={cargarReservas} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Filtros de estado en diseño claro */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {['TODAS', 'CONFIRMADA', 'PENDIENTE', 'ENTREGADA', 'CANCELADA'].map(est => {
          const isActive = filtroEstado === est;
          return (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
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
              {est === 'TODAS' ? 'Todas las reservas' : est}
            </button>
          );
        })}
      </div>

      {error && <div className="alert err" style={{ marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B' }}>
          <p>Cargando tus reservas registradas...</p>
        </div>
      ) : reservasFiltradas.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 16px' }}>
          <span style={{ fontSize: '42px', display: 'block', marginBottom: '10px' }}>🔖</span>
          <strong>No se encontraron reservas {filtroEstado !== 'TODAS' ? `en estado ${filtroEstado}` : ''}.</strong>
          <span>Explora nuestro catálogo comercial para apartar tus kits preferidos antes de que se agoten.</span>
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
          {reservasFiltradas.map(res => {
            const prod = res.producto || {};
            const total = Number(res.montoTotal || 0);
            const adelanto = Number(res.montoAdelanto || 0);
            const saldo = Number(res.saldoPendiente || 0);
            const badge = getStatusBadge(res.estadoReserva);

            return (
              <article
                key={res.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderLeft: `4px solid ${badge.accent}`,
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Cabecera de la tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {prod.imagenUrl ? (
                      <img
                        src={prod.imagenUrl}
                        alt={prod.nombre}
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    <div>
                      <span style={{ fontSize: '11px', color: '#D97706', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        {prod.marca || 'Marca'} {prod.categoria ? `· ${prod.categoria.replaceAll('_', ' ')}` : ''}
                      </span>
                      <h4 style={{ margin: '2px 0 4px', fontSize: '16px', color: '#0F172A', fontWeight: '700' }}>
                        {prod.nombre || 'Producto'}
                      </h4>
                      <small style={{ color: '#64748B', fontSize: '12px' }}>
                        Registrada el {new Date(res.fechaReserva).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </small>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`
                      }}
                    >
                      {badge.label}
                    </span>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#0284C7', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '6px' }}>
                      {res.codigoSeguimiento}
                    </strong>
                  </div>
                </div>

                {/* Desglose económico */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '12px',
                    background: '#F8FAFC',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px', fontWeight: '600' }}>Precio Total:</span>
                    <strong style={{ color: '#0F172A', fontSize: '14.5px' }}>S/ {total.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px', fontWeight: '600' }}>Adelanto Abonado:</span>
                    <strong style={{ color: '#059669', fontSize: '14.5px' }}>S/ {adelanto.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px', fontWeight: '600' }}>Saldo Pendiente:</span>
                    <strong style={{ color: '#D97706', fontSize: '14.5px' }}>S/ {saldo.toFixed(2)}</strong>
                  </div>
                  {res.notas && (
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #E2E8F0', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: '#64748B', fontSize: '11.5px', fontWeight: '600' }}>Modalidad / Notas: </span>
                      <span style={{ color: '#334155' }}>{res.notas}</span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                  <a
                    href={getWhatsAppLink(res)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#16A34A',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <span>💬</span> Coordinar por WhatsApp
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
