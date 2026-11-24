import { useState, useEffect } from 'react';
import { reservaService } from '../services/reservaService';

const MEDIOS_PAGO = [
  { id: 'YAPE', label: '📱 Yape' },
  { id: 'PLIN', label: '📱 Plin' },
  { id: 'EFECTIVO', label: '💵 Efectivo' },
  { id: 'TRANSFERENCIA', label: '🏦 Transferencia' },
  { id: 'TARJETA', label: '💳 Tarjeta' },
  { id: 'OTRO', label: 'Otro' }
];

const MODALIDADES_ENTREGA = [
  { id: 'RETIRO_FERIA', label: '🎪 Entrega Presencial' },
  { id: 'RETIRO_TIENDA', label: '🏪 Retiro en Almacén / Tienda' },
  { id: 'ENVIO_LIMA', label: '🚕 Envío Local' },
  { id: 'ENVIO_PROVINCIA', label: '📦 Envío por Agencia / Courier' }
];

const ESTADOS_ENTREGA = [
  { id: 'PENDIENTE_PREPARACION', label: '📦 En preparación en almacén', orden: 1 },
  { id: 'LISTO_PARA_ENTREGA', label: '✅ Listo para recojo / entrega', orden: 2 },
  { id: 'EN_TRANSITO', label: '🚚 En tránsito / Despachado', orden: 3 },
  { id: 'ENTREGADO', label: '🎉 Entregado al cliente', orden: 4 }
];

function obtenerHoyLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReservasList({ token }) {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Modal: Registrar Adelanto / Abono
  const [reservaParaAbonar, setReservaParaAbonar] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [medioPagoAbono, setMedioPagoAbono] = useState('YAPE');
  const [referenciaAbono, setReferenciaAbono] = useState('');
  const [notasAbono, setNotasAbono] = useState('');
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [errorModalAbono, setErrorModalAbono] = useState('');
  const [historialPagosModal, setHistorialPagosModal] = useState([]);

  // Modal: Gestionar Modalidad y Estado de Entrega
  const [reservaParaEntrega, setReservaParaEntrega] = useState(null);
  const [modalidadEntregaInput, setModalidadEntregaInput] = useState('RETIRO_FERIA');
  const [estadoEntregaInput, setEstadoEntregaInput] = useState('PENDIENTE_PREPARACION');
  const [fechaEstimadaInput, setFechaEstimadaInput] = useState('');
  const [empresaCourierInput, setEmpresaCourierInput] = useState('');
  const [guiaCourierInput, setGuiaCourierInput] = useState('');
  const [direccionEntregaInput, setDireccionEntregaInput] = useState('');
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const [errorModalEntrega, setErrorModalEntrega] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await reservaService.obtenerReservas({
        estado: filtroEstado || undefined,
        busqueda: busqueda.trim() || undefined
      }, token);
      setReservas(res.reservas || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las reservas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [filtroEstado, busqueda, token]);

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await reservaService.actualizarEstado(id, nuevoEstado, token);
      setMsg(`Reserva actualizada a ${nuevoEstado}.`);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado.');
    }
  };

  const abrirModalAbono = async (reserva) => {
    setReservaParaAbonar(reserva);
    setMontoAbono('');
    setMedioPagoAbono('YAPE');
    setReferenciaAbono('');
    setNotasAbono('');
    setErrorModalAbono('');
    setHistorialPagosModal([]);

    try {
      const resPagos = await reservaService.obtenerHistorialPagos(reserva.id, token);
      setHistorialPagosModal(resPagos.pagos || []);
    } catch (err) {
      console.error('Error al cargar historial de pagos:', err);
    }
  };

  const handleRegistrarAbono = async (e) => {
    e.preventDefault();
    setErrorModalAbono('');

    const montoNum = parseFloat(montoAbono);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorModalAbono('Ingrese un monto válido y mayor a cero.');
      return;
    }

    const saldoMax = parseFloat(reservaParaAbonar.saldoPendiente);
    if (montoNum > saldoMax) {
      setErrorModalAbono(
        `El importe ingresado (S/ ${montoNum.toFixed(2)}) supera el saldo pendiente. El importe máximo que puede registrarse es S/ ${saldoMax.toFixed(2)}.`
      );
      return;
    }

    try {
      setGuardandoAbono(true);
      const res = await reservaService.registrarPago(reservaParaAbonar.id, {
        monto: montoNum,
        medioPago: medioPagoAbono,
        referenciaOperacion: referenciaAbono.trim() || undefined,
        observaciones: notasAbono.trim() || undefined
      }, token);

      setMsg(res.mensaje || '¡Abono registrado con éxito!');
      setReservaParaAbonar(null);
      await cargar();
    } catch (err) {
      setErrorModalAbono(err.message || 'Error al procesar el pago.');
    } finally {
      setGuardandoAbono(false);
    }
  };

  const abrirModalEntrega = (reserva) => {
    setReservaParaEntrega(reserva);
    setModalidadEntregaInput(reserva.modalidadEntrega || 'RETIRO_FERIA');
    setEstadoEntregaInput(reserva.estadoEntrega || 'PENDIENTE_PREPARACION');
    setFechaEstimadaInput(
      reserva.fechaEstimadaEntrega
        ? new Date(reserva.fechaEstimadaEntrega).toISOString().split('T')[0]
        : ''
    );

    const rawGuia = reserva.guiaCourier || '';
    if (rawGuia.includes(' | Cód: ')) {
      const [emp, cod] = rawGuia.split(' | Cód: ');
      setEmpresaCourierInput(emp.replace(/^Medio:\s*/i, '').trim());
      setGuiaCourierInput((cod || '').trim());
    } else if (rawGuia.startsWith('Medio: ')) {
      setEmpresaCourierInput(rawGuia.replace(/^Medio:\s*/i, '').trim());
      setGuiaCourierInput('');
    } else if (rawGuia.startsWith('Cód: ')) {
      setEmpresaCourierInput('');
      setGuiaCourierInput(rawGuia.replace(/^Cód:\s*/i, '').trim());
    } else {
      setEmpresaCourierInput('');
      setGuiaCourierInput(rawGuia);
    }

    setDireccionEntregaInput(reserva.direccionEntrega || '');
    setErrorModalEntrega('');
  };

  const handleGuardarEntrega = async (e) => {
    e.preventDefault();
    setErrorModalEntrega('');

    const empLimpia = empresaCourierInput.trim();
    const codLimpio = guiaCourierInput.trim();
    let guiaCombinada = null;
    if (empLimpia && codLimpio) {
      guiaCombinada = `${empLimpia} | Cód: ${codLimpio}`;
    } else if (empLimpia) {
      guiaCombinada = `Medio: ${empLimpia}`;
    } else if (codLimpio) {
      guiaCombinada = `Cód: ${codLimpio}`;
    }

    try {
      setGuardandoEntrega(true);
      const res = await reservaService.actualizarEntrega(
        reservaParaEntrega.id,
        {
          modalidadEntrega: modalidadEntregaInput,
          estadoEntrega: estadoEntregaInput,
          fechaEstimadaEntrega: fechaEstimadaInput || null,
          guiaCourier: guiaCombinada,
          direccionEntrega: direccionEntregaInput.trim() || null
        },
        token
      );

      setMsg(res.mensaje || `Entrega del pedido ${reservaParaEntrega.codigoSeguimiento} actualizada.`);
      setReservaParaEntrega(null);
      await cargar();
    } catch (err) {
      setErrorModalEntrega(err.message || 'No se pudo actualizar la información de entrega.');
    } finally {
      setGuardandoEntrega(false);
    }
  };

  return (
    <section className="card" style={{ width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Control de Reservas, Adelantos y Entregas</h2>
          <p className="muted">
            Auditoría de pedidos apartados, abonos parciales, cálculo automático de saldos y seguimiento de despacho.
          </p>
        </div>
        <button className="secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando...' : 'Refrescar'}
        </button>
      </div>

      <div className="filters" style={{ marginBottom: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código RES, nombre de cliente o WhatsApp..."
          style={{ flex: 1, minWidth: '260px' }}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="CONFIRMADA">CONFIRMADA (Con adelanto)</option>
          <option value="PENDIENTE">PENDIENTE (Sin abono aún)</option>
          <option value="ENTREGADA">ENTREGADA (Completada)</option>
          <option value="CANCELADA">CANCELADA</option>
        </select>
      </div>

      {msg && <div className="alert ok" style={{ marginBottom: '14px' }}>{msg}</div>}
      {error && <div className="alert err" style={{ marginBottom: '14px' }}>{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #30363D', color: '#8B949E' }}>
              <th style={{ padding: '8px' }}>Código</th>
              <th style={{ padding: '8px' }}>Producto</th>
              <th style={{ padding: '8px' }}>Cliente / WhatsApp</th>
              <th style={{ padding: '8px' }}>Total</th>
              <th style={{ padding: '8px' }}>Adelanto</th>
              <th style={{ padding: '8px' }}>Saldo</th>
              <th style={{ padding: '8px' }}>Estado Pago</th>
              <th style={{ padding: '8px' }}>Modalidad / Entrega</th>
              <th style={{ padding: '8px' }}>Estado Reserva</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map(r => {
              const saldoNum = Number(r.saldoPendiente);
              const tieneAbono = Number(r.montoAdelanto || 0) > 0;
              const cancelada = r.estadoReserva === 'CANCELADA';
              const entregada = r.estadoReserva === 'ENTREGADA' || r.estadoEntrega === 'ENTREGADO';
              const modObj = MODALIDADES_ENTREGA.find(m => m.id === r.modalidadEntrega);
              const estEntObj = ESTADOS_ENTREGA.find(e => e.id === r.estadoEntrega);

              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #21262D' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                    {r.codigoSeguimiento}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ fontWeight: '600' }}>{r.producto?.nombre}</div>
                    {r.unidadInventario && (
                      <small style={{ color: '#00D2EE', display: 'block', fontSize: '11px' }}>
                        Serie: {r.unidadInventario.codigoSerie}
                      </small>
                    )}
                    {r.notas && <small style={{ color: '#8B949E', display: 'block' }}>📌 {r.notas}</small>}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div>{r.nombreCliente}</div>
                    <a
                      href={`https://wa.me/51${r.telefonoCliente.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#25D366', textDecoration: 'none', fontSize: '12px' }}
                    >
                      💬 {r.telefonoCliente}
                    </a>
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>
                    S/ {Number(r.montoTotal).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#10B981', fontWeight: 'bold' }}>
                    S/ {Number(r.montoAdelanto).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 8px', color: saldoNum > 0 ? 'var(--color-gold)' : '#10B981', fontWeight: 'bold' }}>
                    S/ {saldoNum.toFixed(2)}
                  </td>
                  {/* Estado de Pago */}
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: saldoNum === 0 ? '#DCFCE7' : (Number(r.montoAdelanto) > 0 ? '#FEF3C7' : '#FEE2E2'),
                      color: saldoNum === 0 ? '#166534' : (Number(r.montoAdelanto) > 0 ? '#92400E' : '#991B1B')
                    }}>
                      {saldoNum === 0 ? 'COMPLETADO' : (Number(r.montoAdelanto) > 0 ? 'PARCIAL' : 'PENDIENTE')}
                    </span>
                  </td>
                  {/* Modalidad y Estado de Entrega */}
                  <td style={{ padding: '10px 8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {modObj ? modObj.label : (r.modalidadEntrega || '🎪 Retiro en Feria')}
                    </div>
                    <small style={{ color: r.estadoEntrega === 'ENTREGADO' ? '#059669' : '#0284C7', fontWeight: 600, display: 'block' }}>
                      {estEntObj ? estEntObj.label : (r.estadoEntrega || 'En preparación')}
                    </small>
                    {r.fechaEstimadaEntrega && (
                      <small style={{ color: '#475569', display: 'block' }}>
                        📅 Est: {new Date(r.fechaEstimadaEntrega).toLocaleDateString('es-PE')}
                      </small>
                    )}
                    {r.guiaCourier && (
                      <small style={{ color: '#D97706', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>
                        🚚 {r.guiaCourier}
                      </small>
                    )}
                    {r.direccionEntrega && (
                      <small style={{ color: '#64748B', display: 'block' }}>
                        📍 {r.direccionEntrega}
                      </small>
                    )}
                  </td>
                  {/* Estado Reserva */}
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: r.estadoReserva === 'CONFIRMADA' ? '#065F46' : r.estadoReserva === 'ENTREGADA' ? '#1E3A8A' : r.estadoReserva === 'CANCELADA' ? '#7F1D1D' : '#78350F',
                      color: '#FFFFFF'
                    }}>
                      {r.estadoReserva}
                    </span>
                  </td>
                  {/* Acciones */}
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      {!cancelada && !entregada && (
                        <button
                          type="button"
                          onClick={() => abrirModalAbono(r)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #10B981',
                            background: '#ECFDF5',
                            color: '#065F46',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                          title="Registrar abono de saldo"
                        >
                          💰 Abonar
                        </button>
                      )}

                      {!cancelada && !entregada && (
                        <button
                          type="button"
                          onClick={() => abrirModalEntrega(r)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-cyan)',
                            background: 'rgba(0, 210, 238, 0.12)',
                            color: 'var(--color-cyan)',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                          title="Actualizar modalidad, estado o fecha estimada de entrega"
                        >
                          🚚 Entrega
                        </button>
                      )}

                      {entregada || cancelada ? (
                        <span
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 10px',
                            background: '#1E293B',
                            color: '#94A3B8',
                            border: '1px solid #334155',
                            borderRadius: '4px',
                            fontWeight: 700,
                            userSelect: 'none'
                          }}
                          title="Estado final cerrado"
                        >
                          🔒 {entregada ? 'ENTREGADA' : 'CANCELADA'}
                        </span>
                      ) : (
                        <select
                          value={r.estadoReserva}
                          onChange={e => handleCambiarEstado(r.id, e.target.value)}
                          style={{ fontSize: '12px', padding: '4px 6px', background: '#0D1117', color: '#FFFFFF', border: '1px solid #30363D', borderRadius: '4px' }}
                        >
                          {!tieneAbono && r.estadoReserva === 'PENDIENTE' && (
                            <option value="PENDIENTE">PENDIENTE</option>
                          )}
                          <option value="CONFIRMADA">CONFIRMADA</option>
                          <option value="ENTREGADA">ENTREGADA</option>
                          <option value="CANCELADA">CANCELADA</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reservas.length === 0 && !cargando && (
          <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
            No hay reservas registradas en este estado.
          </p>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: REGISTRAR ADELANTO / ABONO DE SALDO */}
      {/* ============================================================== */}
      {reservaParaAbonar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                  Registrar Abono — {reservaParaAbonar.codigoSeguimiento}
                </h3>
                <small style={{ color: '#64748B' }}>Gestión de cobranza y abonos</small>
              </div>
              <button
                type="button"
                onClick={() => setReservaParaAbonar(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            {/* Resumen Financiero Actual */}
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748B' }}>Producto:</span>
                <strong style={{ color: '#0F172A' }}>{reservaParaAbonar.producto?.nombre}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748B' }}>Cliente:</span>
                <span style={{ color: '#0F172A' }}>{reservaParaAbonar.nombreCliente}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748B' }}>Total Acordado:</span>
                <span style={{ color: '#0F172A' }}>S/ {Number(reservaParaAbonar.montoTotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748B' }}>Adelanto Acumulado:</span>
                <span style={{ color: '#10B981', fontWeight: 700 }}>S/ {Number(reservaParaAbonar.montoAdelanto).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #E2E8F0', fontSize: '15px' }}>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>Saldo Pendiente:</span>
                <strong style={{ color: '#D97706' }}>S/ {Number(reservaParaAbonar.saldoPendiente).toFixed(2)}</strong>
              </div>
            </div>

            {errorModalAbono && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #F87171',
                color: '#991B1B',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px'
              }}>
                ⚠️ {errorModalAbono}
              </div>
            )}

            {/* Formulario de Abono */}
            <form onSubmit={handleRegistrarAbono}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Monto a Abonar (S/) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748B' }}>S/</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(reservaParaAbonar.saldoPendiente)}
                    placeholder="0.00"
                    value={montoAbono}
                    onChange={e => setMontoAbono(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box', fontWeight: 700 }}
                  />
                </div>
                <small style={{ color: '#64748B', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                  Máximo permitido: S/ {Number(reservaParaAbonar.saldoPendiente).toFixed(2)}
                </small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Medio de Pago *
                  </label>
                  <select
                    value={medioPagoAbono}
                    onChange={e => setMedioPagoAbono(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#F8FAFC', fontWeight: 600 }}
                  >
                    {MEDIOS_PAGO.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Nro. Operación (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Op. Yape 123456"
                    value={referenciaAbono}
                    onChange={e => setReferenciaAbono(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Abono en efectivo en stand"
                  value={notasAbono}
                  onChange={e => setNotasAbono(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={guardandoAbono || Number(reservaParaAbonar.saldoPendiente) <= 0}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: (guardandoAbono || Number(reservaParaAbonar.saldoPendiente) <= 0) ? '#94A3B8' : '#10B981',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: (guardandoAbono || Number(reservaParaAbonar.saldoPendiente) <= 0) ? 'not-allowed' : 'pointer',
                  marginBottom: '16px'
                }}
              >
                {guardandoAbono ? 'Guardando Pago...' : '🟢 Confirmar y Actualizar Saldo'}
              </button>
            </form>

            {/* Historial de Pagos Previos */}
            {historialPagosModal.length > 0 && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#475569', textTransform: 'uppercase' }}>
                  Historial de Abonos Registrados:
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                  {historialPagosModal.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid #E2E8F0' }}>
                      <div style={{ color: '#0F172A' }}>
                        <strong>S/ {Number(p.monto).toFixed(2)}</strong> via {p.medioPago}
                        {p.referenciaOperacion && <span style={{ color: '#64748B' }}> ({p.referenciaOperacion})</span>}
                      </div>
                      <div style={{ color: '#94A3B8' }}>
                        {new Date(p.fechaPago).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: GESTIONAR MODALIDAD Y ESTADO DE ENTREGA */}
      {/* ============================================================== */}
      {reservaParaEntrega && (
        <div className="modal-overlay" onClick={() => setReservaParaEntrega(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🚚</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-cyan)' }}>
                    GESTIONAR ENTREGA — {reservaParaEntrega.codigoSeguimiento}
                  </h3>
                  <small style={{ color: '#8B949E', fontSize: '11px' }}>
                    {reservaParaEntrega.producto?.nombre} · Cliente: {reservaParaEntrega.nombreCliente}
                  </small>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setReservaParaEntrega(null)}>&times;</button>
            </div>

            {errorModalEntrega && (
              <div className="alert err" style={{ marginBottom: '14px' }}>
                ⚠️ {errorModalEntrega}
              </div>
            )}

            <form onSubmit={handleGuardarEntrega}>
              <label style={{ display: 'block', marginBottom: '12px' }}>
                Modalidad de Entrega Acordada *
                <select
                  value={modalidadEntregaInput}
                  onChange={e => setModalidadEntregaInput(e.target.value)}
                  style={{ marginTop: '4px', width: '100%' }}
                >
                  {MODALIDADES_ENTREGA.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: '12px' }}>
                Estado Actual del Envío / Entrega *
                <select
                  value={estadoEntregaInput}
                  onChange={e => setEstadoEntregaInput(e.target.value)}
                  style={{ marginTop: '4px', width: '100%' }}
                >
                  {(() => {
                    const etapaActualObj = ESTADOS_ENTREGA.find(x => x.id === (reservaParaEntrega.estadoEntrega || 'PENDIENTE_PREPARACION'));
                    const ordenActual = etapaActualObj ? etapaActualObj.orden : 1;
                    return ESTADOS_ENTREGA.map(e => (
                      <option key={e.id} value={e.id} disabled={e.orden < ordenActual}>
                        {e.label}
                      </option>
                    ));
                  })()}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <label style={{ margin: 0 }}>
                  Courier / Medio de Entrega
                  <input
                    type="text"
                    value={empresaCourierInput}
                    onChange={e => setEmpresaCourierInput(e.target.value)}
                    placeholder="Ej: Olva, Shalom, Taxi, Tren, En persona..."
                    style={{ marginTop: '4px', width: '100%' }}
                  />
                </label>

                <label style={{ margin: 0 }}>
                  Código de Envío / Guía / Tracking
                  <input
                    type="text"
                    value={guiaCourierInput}
                    onChange={e => setGuiaCourierInput(e.target.value)}
                    placeholder="Ej: 884920-26 / Guía / Placa"
                    style={{ marginTop: '4px', width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <label style={{ margin: 0 }}>
                  Fecha Estimada de Entrega
                  <input
                    type="date"
                    min={obtenerHoyLocalISO()}
                    value={fechaEstimadaInput}
                    onChange={e => setFechaEstimadaInput(e.target.value)}
                    style={{ marginTop: '4px', width: '100%' }}
                  />
                </label>

                <label style={{ margin: 0 }}>
                  Dirección / Punto de Entrega
                  <input
                    type="text"
                    value={direccionEntregaInput}
                    onChange={e => setDireccionEntregaInput(e.target.value)}
                    placeholder="Ej: Estación del Tren / Agencia / Domicilio"
                    style={{ marginTop: '4px', width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setReservaParaEntrega(null)}
                  disabled={guardandoEntrega}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={guardandoEntrega}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontWeight: 'bold',
                    background: 'var(--color-cyan)',
                    color: '#080B0F'
                  }}
                >
                  {guardandoEntrega ? 'Guardando...' : '💾 Guardar Cambios de Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
