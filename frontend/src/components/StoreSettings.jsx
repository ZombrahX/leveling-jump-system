import React, { useState, useEffect } from 'react';
import { configuracionService, obtenerConfigLocal } from '../services/configuracionService';

export default function StoreSettings({ token, onConfigUpdated }) {
  const initial = obtenerConfigLocal();
  const [whatsappInput, setWhatsappInput] = useState(initial.whatsappOficial || '999999999');
  const [configActual, setConfigActual] = useState(initial);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensajeOk, setMensajeOk] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    configuracionService.obtener().then(data => {
      if (!activo) return;
      setConfigActual(data);
      setWhatsappInput(data.whatsappOficial || '999999999');
      setCargando(false);
    });
    return () => { activo = false; };
  }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeOk('');

    const limpio = String(whatsappInput).replace(/\D/g, '');
    if (limpio.length < 8) {
      setError('Ingresa un número de WhatsApp válido (mínimo 8 dígitos).');
      return;
    }

    try {
      setGuardando(true);
      const actualizada = await configuracionService.actualizar(
        { whatsappOficial: limpio },
        token
      );
      setConfigActual(actualizada);
      setWhatsappInput(actualizada.whatsappOficial);
      setMensajeOk('Número de WhatsApp actualizado correctamente.');
      if (onConfigUpdated) onConfigUpdated(actualizada);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la configuración.');
    } finally {
      setGuardando(false);
    }
  };

  const handleProbarEnlace = () => {
    const num = configActual.whatsappCompleto || '51999999999';
    const msg = encodeURIComponent('¡Hola Leveling Jump! Prueba de enlace de atención al cliente.');
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="card" style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2>Configuración de Tienda</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Ajustes generales de contacto y atención al cliente de Leveling Jump.
          </p>
        </div>
      </div>

      {error && <div className="alert err" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}
      {mensajeOk && <div className="alert ok" style={{ marginBottom: '16px' }}>✅ {mensajeOk}</div>}

      <div style={{
        background: '#F8FAFC',
        border: '1px solid #CBD5E1',
        borderLeft: '5px solid #10B981',
        borderRadius: '10px',
        padding: '22px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💬</span> WhatsApp de Atención y Ventas
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
              Número al que se dirigen los botones de coordinación en Reservas, Cotizaciones y el encabezado de las Proformas PDF.
            </p>
          </div>
          <span style={{
            background: '#DCFCE7',
            color: '#166534',
            border: '1px solid #86EFAC',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11.5px',
            fontWeight: 800,
            fontFamily: 'monospace'
          }}>
            Activo: {cargando ? 'Cargando...' : configActual.whatsappFormateado}
          </span>
        </div>

        <form onSubmit={handleGuardar}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <label style={{ margin: 0, color: '#0F172A', fontWeight: 700, fontSize: '13px' }}>
              Número de WhatsApp
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{
                  background: '#E2E8F0',
                  color: '#334155',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  border: '1px solid #CBD5E1'
                }}>
                  +51
                </span>
                <input
                  type="tel"
                  required
                  value={whatsappInput}
                  onChange={e => setWhatsappInput(e.target.value.replace(/[^\d\s-]/g, ''))}
                  placeholder="987 654 321"
                  style={{
                    flex: 1,
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>
            </label>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="primary"
                disabled={guardando}
                style={{
                  flex: 1,
                  padding: '11px 18px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                {guardando ? 'Guardando...' : '💾 Guardar Número'}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={handleProbarEnlace}
                style={{
                  padding: '11px 16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                title="Abrir WhatsApp con el número guardado actualmente"
              >
                🔗 Probar Enlace
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
