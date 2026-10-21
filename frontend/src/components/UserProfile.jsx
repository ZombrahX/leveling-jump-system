import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

export default function UserProfile({ usuario, onPerfilActualizado, onVerMisReservas }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre || '');
      setTelefono(usuario.telefono || '');
    }
  }, [usuario]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!nombre.trim()) {
      setError('El nombre completo no puede estar vacío.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.actualizarPerfil({
        nombre: nombre.trim(),
        telefono: telefono ? telefono.trim() : null
      });

      setMsg('Datos de perfil actualizados correctamente.');
      if (onPerfilActualizado && res.usuario) {
        onPerfilActualizado(res.usuario);
      }
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  if (!usuario) return null;

  return (
    <section className="card" style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h2>Mi Perfil de Usuario</h2>
      <p className="muted">
        Gestiona tus datos personales de contacto para agilizar la entrega y coordinación de tus pedidos.
      </p>

      {msg && <div className="alert ok" style={{ marginBottom: '16px' }}>{msg}</div>}
      {error && <div className="alert err" style={{ marginBottom: '16px' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="two">
          <label>
            Nombre Completo *
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Carlos Gómez"
              required
            />
          </label>

          <label>
            Teléfono o WhatsApp de Contacto
            <input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="Ej: 987 654 321"
            />
          </label>
        </div>

        <small style={{ display: 'block', color: '#64748B', fontSize: '12px', marginTop: '-6px', marginBottom: '14px' }}>
          Este número se completará de forma automática al registrar reservas en el catálogo para coordinar entregas por WhatsApp.
        </small>

        <label>
          Correo Electrónico
          <input
            value={usuario.email}
            disabled
            style={{ background: '#F8FAFC', color: '#64748B', borderColor: '#CBD5E1', cursor: 'not-allowed' }}
          />
        </label>

        {/* Estado de verificación en diseño claro */}
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '6px',
            padding: '12px 16px',
            margin: '14px 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px'
          }}
        >
          <span style={{ fontSize: '18px', color: '#16A34A', flexShrink: 0 }}>✓</span>
          <div>
            <strong style={{ display: 'block', color: '#15803D', fontSize: '13.5px' }}>
              Correo Electrónico Verificado
            </strong>
            <small style={{ color: '#166534', fontSize: '12px' }}>
              Tu cuenta se encuentra activa y habilitada para reservas en el catálogo oficial.
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button type="submit" className="primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Guardando cambios...' : 'Guardar Cambios'}
          </button>

          {onVerMisReservas && (
            <button
              type="button"
              className="secondary"
              onClick={onVerMisReservas}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🔖</span> Consultar Mis Reservas
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
