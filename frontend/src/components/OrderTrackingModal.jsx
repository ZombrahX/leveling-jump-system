import { useState } from 'react';
import { reservaService } from '../services/reservaService';

export default function OrderTrackingModal({ isOpen, onClose, codigoInicial = '' }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [cargando, setCargando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleBuscar = async (e) => {
    e.preventDefault();
    setError('');
    setPedido(null);

    const codLimpio = codigo.trim();
    if (!codLimpio) {
      setError('Por favor ingresa un código de pedido.');
      return;
    }

    try {
      setCargando(true);
      const data = await reservaService.consultarSeguimientoPublico(codLimpio);
      setPedido(data);
    } catch (err) {
      setError(err.message || 'No se encontró ningún pedido asociado con el código ingresado.');
    } finally {
      setCargando(false);
    }
  };

  // Cálculo de la etapa activa del timeline (1: Registrado, 2: Preparando, 3: Listo/En camino, 4: Entregado)
  const getEtapaNumero = () => {
    if (!pedido) return 1;
    if (pedido.estadoEntrega === 'ENTREGADO' || pedido.estadoReserva === 'ENTREGADA') return 4;
    if (pedido.estadoEntrega === 'EN_TRANSITO' || pedido.estadoEntrega === 'LISTO_PARA_ENTREGA') return 3;
    if (pedido.estadoReserva === 'CONFIRMADA' || pedido.estadoPago === 'PARCIAL' || pedido.estadoPago === 'COMPLETADO') return 2;
    return 1;
  };

  const etapaActual = getEtapaNumero();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        maxWidth: '580px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>📍</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                Seguimiento de Pedido & Entrega (HU-10)
              </h3>
              <small style={{ color: '#64748B' }}>
                Consulta en tiempo real el avance de tu reserva y modalidad de retiro
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}
          >
            ✕
          </button>
        </div>

        {/* Buscador de Código */}
        <form onSubmit={handleBuscar} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Ingresa tu código (ej: RES-2026-1140)"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '8px',
                  border: '2px solid #CBD5E1',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#00D2EE',
                color: '#0D1117',
                fontWeight: 800,
                fontSize: '14px',
                cursor: cargando ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              {cargando ? 'Buscando...' : 'Consultar'}
            </button>
          </div>
        </form>

        {/* Mensaje de Error (HU-10 Escenario 2: Código inexistente) */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: 1.4
          }}>
            ❌ {error}
          </div>
        )}

        {/* Resultado Encontrado (HU-10 Escenario 1) */}
        {pedido && (
          <div>
            {/* Visual Progress Bar (Timeline de 4 Etapas) */}
            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '8px' }}>
                {[
                  { num: 1, label: 'Registrado' },
                  { num: 2, label: 'Preparando' },
                  { num: 3, label: 'Listo/Ruta' },
                  { num: 4, label: 'Entregado' }
                ].map((step, idx) => {
                  const alcanzado = etapaActual >= step.num;
                  return (
                    <div key={step.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: alcanzado ? '#10B981' : '#E2E8F0',
                        color: alcanzado ? '#FFFFFF' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '13px',
                        marginBottom: '6px',
                        boxShadow: alcanzado ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none'
                      }}>
                        {alcanzado ? '✓' : step.num}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: alcanzado ? 700 : 500, color: alcanzado ? '#0F172A' : '#94A3B8', textAlign: 'center' }}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ficha del Producto */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#F1F5F9', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pedido.producto?.imagenUrl ? (
                  <img src={pedido.producto.imagenUrl} alt={pedido.producto.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                ) : (
                  <span style={{ fontSize: '24px' }}>📦</span>
                )}
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                  {pedido.producto?.nombre}
                </h4>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  SKU: {pedido.producto?.codigo} | Total: <strong>S/ {pedido.montoTotal.toFixed(2)}</strong>
                </div>
                {pedido.serieAsignada && (
                  <div style={{ fontSize: '11px', color: '#00D2EE', fontWeight: 700, marginTop: '2px' }}>
                    Serie de Almacén: {pedido.serieAsignada}
                  </div>
                )}
              </div>
            </div>

            {/* Modalidad y Fecha de Entrega */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', border: '1px solid #E2E8F0', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Modalidad de Entrega:</span>
                <strong style={{ color: '#0F172A', textAlign: 'right' }}>{pedido.modalidadEntregaDescripcion}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Estado del Envío:</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: pedido.estadoEntrega === 'ENTREGADO' ? '#DCFCE7' : '#FEF3C7',
                  color: pedido.estadoEntrega === 'ENTREGADO' ? '#166534' : '#92400E'
                }}>
                  {pedido.estadoEntregaDescripcion}
                </span>
              </div>
              {pedido.fechaEstimadaEntrega && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Fecha Estimada:</span>
                  <strong style={{ color: '#0891B2' }}>{new Date(pedido.fechaEstimadaEntrega).toLocaleDateString()}</strong>
                </div>
              )}
              {pedido.guiaCourier && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Nro. Guía Courier:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{pedido.guiaCourier}</strong>
                </div>
              )}
            </div>

            {/* Desglose de Pago */}
            <div style={{ background: '#0D1117', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#94A3B8', fontSize: '11px', display: 'block' }}>ESTADO FINANCIERO:</span>
                <span style={{ color: pedido.saldoPendiente === 0 ? '#10B981' : '#F59E0B', fontWeight: 800, fontSize: '13px' }}>
                  {pedido.estadoPago}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#94A3B8', fontSize: '11px', display: 'block' }}>SALDO POR LIQUIDAR:</span>
                <span style={{ color: pedido.saldoPendiente === 0 ? '#10B981' : '#00D2EE', fontWeight: 800, fontSize: '16px' }}>
                  S/ {pedido.saldoPendiente.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
