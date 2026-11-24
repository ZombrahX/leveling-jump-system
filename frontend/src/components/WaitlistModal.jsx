import React, { useState } from 'react';
import { interesService } from '../services/interesService';

export default function WaitlistModal({ isOpen, onClose, producto, usuarioActual, onRequireLogin }) {
  const [nombre, setNombre] = useState(usuarioActual?.nombre || '');
  const [telefono, setTelefono] = useState(usuarioActual?.telefono || '');
  const [email, setEmail] = useState(usuarioActual?.email || '');
  const [notas, setNotas] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  if (!isOpen || !producto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    if (!nombre.trim() || !telefono.trim()) {
      setError('Por favor indica tu nombre y teléfono/WhatsApp.');
      return;
    }

    try {
      setCargando(true);
      const resp = await interesService.registrarInteres({
        idProducto: producto.id,
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: email ? email.trim() : null,
        notas: notas ? notas.trim() : ''
      });

      setExito(resp.mensaje || '¡Registrado con éxito en la lista de espera!');
      setTimeout(() => {
        onClose();
        setExito('');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Error al registrar tu interés.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Cabecera */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🔔</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-cyan)', letterSpacing: '0.5px' }}>
                LISTA DE ESPERA / RESTOCK
              </h3>
              <small style={{ color: '#8B949E', fontSize: '11px', display: 'block' }}>
                Alerta de reposición comercial y aviso de arribo
              </small>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Ficha rápida del producto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', marginBottom: '14px' }}>
          {producto.imagenUrl ? (
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #30363D' }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#161B22', border: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#8B949E', fontWeight: 'bold' }}>
              LJ
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: '13.5px', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {producto.nombre}
            </h4>
            <small style={{ color: '#8B949E', fontSize: '11px', display: 'block' }}>
              {producto.marca || 'Bandai'} · {producto.serie || 'Gunpla'}
            </small>
            <strong style={{ color: 'var(--color-cyan)', fontSize: '12.5px', fontFamily: 'monospace' }}>
              {producto.precio ? `S/ ${parseFloat(producto.precio).toFixed(2)}` : 'Precio referencial'}
            </strong>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#C9D1D9', lineHeight: 1.45, margin: '0 0 14px' }}>
          Este modelo se encuentra agotado o en proceso de importación. Déjanos tus datos para avisarte por WhatsApp apenas arribe un nuevo lote y tengas prioridad de reserva.
        </p>

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
        {exito && <div className="alert ok" style={{ marginBottom: '14px' }}>✅ {exito}</div>}

        {!usuarioActual ? (
          <div style={{
            background: '#0D1117',
            border: '1px solid var(--color-cyan)',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '30px', display: 'block', marginBottom: '6px' }}>🔐</span>
            <h4 style={{ margin: '0 0 6px', color: '#FFFFFF', fontSize: '15px' }}>
              Inicia sesión para anotarte en la lista de espera
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#8B949E', lineHeight: 1.45 }}>
              Tu solicitud quedará vinculada a tu cuenta para notificarte de inmediato cuando ingrese un nuevo lote de este modelo.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="secondary" onClick={onClose} style={{ flex: 1, padding: '10px' }}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (onRequireLogin) onRequireLogin();
                }}
                style={{ flex: 2, padding: '10px', fontWeight: 'bold' }}
              >
                👤 Iniciar Sesión / Crear Cuenta
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <div style={{
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#8B949E', display: 'block', fontSize: '10.5px' }}>Cuenta solicitante:</span>
            <strong style={{ color: '#FFFFFF' }}>{(usuarioActual.nombre || '').replace(/\s*\((Google|Local)\)/gi, '').trim()}</strong>
            <span style={{ color: 'var(--color-cyan)', marginLeft: '6px' }}>({usuarioActual.email})</span>
          </div>

          <label style={{ display: 'block', margin: '0 0 10px' }}>
            WhatsApp de Contacto *
            <input
              type="tel"
              required
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="Ej: 999 888 777"
              style={{ marginTop: '4px' }}
            />
          </label>

          <label style={{ display: 'block', margin: '0 0 16px' }}>
            Notas adicionales
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: ¿Llega versión especial o standard?"
              style={{ marginTop: '4px' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={cargando}
              style={{ flex: 1, padding: '10px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary"
              disabled={cargando}
              style={{ flex: 1, padding: '10px', fontWeight: 'bold' }}
            >
              {cargando ? 'Anotando...' : '🔔 Avisarme al Arribar'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
