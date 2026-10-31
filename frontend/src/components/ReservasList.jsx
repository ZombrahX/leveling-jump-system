import { useState, useEffect } from 'react';
import { reservaService } from '../services/reservaService';

export default function ReservasList({ token }) {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

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

  return (
    <section className="card" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Control y Seguimiento de Reservas</h2>
          <p className="muted">
            Monitoreo de pedidos apartados con adelanto flexible para la feria del sábado y directos de TikTok Live.
          </p>
        </div>
        <button className="secondary" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando...' : 'Refrescar'}
        </button>
      </div>

      <div className="filters" style={{ marginBottom: '18px' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código RES, nombre de cliente o WhatsApp..."
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
              <th style={{ padding: '8px' }}>Estado</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Cambiar Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #21262D' }}>
                <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                  {r.codigoSeguimiento}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ fontWeight: '600' }}>{r.producto?.nombre}</div>
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
                <td style={{ padding: '10px 8px', color: 'var(--color-gold)', fontWeight: 'bold' }}>
                  S/ {Number(r.saldoPendiente).toFixed(2)}
                </td>
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
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <select
                    value={r.estadoReserva}
                    onChange={e => handleCambiarEstado(r.id, e.target.value)}
                    style={{ fontSize: '12px', padding: '4px 6px', background: '#0D1117', color: '#FFFFFF', border: '1px solid #30363D', borderRadius: '4px' }}
                  >
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="CONFIRMADA">CONFIRMADA</option>
                    <option value="ENTREGADA">ENTREGADA</option>
                    <option value="CANCELADA">CANCELADA</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reservas.length === 0 && !cargando && (
          <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
            No hay reservas registradas en este estado.
          </p>
        )}
      </div>
    </section>
  );
}
