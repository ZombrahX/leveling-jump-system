import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Formulario nuevo staff
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState('ADMIN');
  const [permisos, setPermisos] = useState(['PRODUCTOS', 'LOTES', 'RESERVAS']);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.listarStaff();
      setStaffList(data);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista de personal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleTogglePermiso = mod => {
    if (permisos.includes(mod)) {
      setPermisos(permisos.filter(p => p !== mod));
    } else {
      setPermisos([...permisos, mod]);
    }
  };

  const handleCreateStaff = async e => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      await authService.crearStaff({
        nombre,
        email,
        password,
        rol: rolSeleccionado,
        permisosModulos: rolSeleccionado === 'SUPERADMIN' 
          ? ['PRODUCTOS', 'LOTES', 'RESERVAS', 'USUARIOS'] 
          : permisos
      });
      setMsg(`¡Miembro de staff "${nombre}" (${rolSeleccionado}) creado exitosamente!`);
      setNombre('');
      setEmail('');
      setPassword('');
      setRolSeleccionado('ADMIN');
      setShowForm(false);
      await loadStaff();
    } catch (err) {
      setError(err.message || 'No se pudo crear el miembro de staff.');
    }
  };

  const handleToggleStatus = async (member) => {
    if (member.id === 1 || member.email === 'cesar.sanchez@isil.pe') {
      alert('Por directriz de seguridad del sistema, la cuenta del Propietario Principal no puede ser suspendida.');
      return;
    }
    const accion = member.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Deseas ${accion} el acceso de "${member.nombre}"?`)) return;

    setError('');
    setMsg('');
    try {
      await authService.toggleEstadoStaff(member.id);
      setMsg(`Acceso de "${member.nombre}" ${member.activo ? 'desactivado' : 'activado'} correctamente.`);
      await loadStaff();
    } catch (err) {
      setError(err.message || 'No se pudo modificar el estado del usuario.');
    }
  };

  return (
    <section className="card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2>Gestión de Staff y Jerarquía de Accesos</h2>
          <p className="muted">
            Panel exclusivo del Propietario. Administra las cuentas del equipo, roles de administración y permisos por módulo.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => { setShowForm(!showForm); setError(''); setMsg(''); }}
        >
          {showForm ? 'Cancelar' : '+ Nuevo Miembro de Staff'}
        </button>
      </div>

      {msg && <div className="alert ok" style={{ marginBottom: '16px' }}>{msg}</div>}
      {error && <div className="alert err" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Formulario desplegable */}
      {showForm && (
        <form onSubmit={handleCreateStaff} style={{ background: '#F8FAFC', padding: '18px 20px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 14px', color: '#0F172A', fontSize: '16px' }}>
            Registrar Nuevo Administrador / Staff
          </h3>
          <div className="two">
            <label>
              Nombre Completo *
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Carlos Mendoza"
                required
              />
            </label>
            <label>
              Correo Electrónico *
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="staff@levelingjump.com"
                required
              />
            </label>
          </div>

          <div className="two">
            <label>
              Contraseña Temporal *
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </label>

            <label>
              Rol y Nivel de Jerarquía *
              <select value={rolSeleccionado} onChange={e => setRolSeleccionado(e.target.value)}>
                <option value="ADMIN">STAFF (Administrador de Tienda / Feria)</option>
                <option value="SUPERADMIN">SUPERADMIN (Administrador General)</option>
              </select>
            </label>
          </div>

          {rolSeleccionado === 'ADMIN' ? (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '13px', color: '#9CA3AF', display: 'block', marginBottom: '8px' }}>
                Permisos de Módulos Asignados:
              </span>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                {['PRODUCTOS', 'LOTES', 'RESERVAS'].map(mod => (
                  <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={permisos.includes(mod)}
                      onChange={() => handleTogglePermiso(mod)}
                    />
                    {mod}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-gold)', borderRadius: '6px' }}>
              <small style={{ color: 'var(--color-gold)', fontSize: '12.5px', display: 'block' }}>
                ⭐ Los Superadministradores cuentan con acceso total a todos los módulos y configuración de personal.
              </small>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <button className="primary" type="submit">
              Guardar y Conceder Acceso
            </button>
          </div>
        </form>
      )}

      {/* Tabla de Miembros */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #30363D', color: '#8B949E' }}>
              <th style={{ padding: '10px 8px' }}>Nombre</th>
              <th style={{ padding: '10px 8px' }}>Correo Electrónico</th>
              <th style={{ padding: '10px 8px' }}>Rol Asignado</th>
              <th style={{ padding: '10px 8px' }}>Módulos Habilitados</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(member => (
              <tr key={member.id} style={{ borderBottom: '1px solid #21262D' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                  {member.nombre}
                </td>
                <td style={{ padding: '12px 8px', color: '#9CA3AF' }}>
                  {member.email}
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <span className={`badge-role ${member.rol.toLowerCase()}`}>
                    {member.rol === 'SUPERADMIN' ? '👑 SUPERADMIN' : 'STAFF ADMIN'}
                  </span>
                </td>
                <td style={{ padding: '12px 8px', fontSize: '12px', color: '#9CA3AF' }}>
                  {member.rol === 'SUPERADMIN'
                    ? 'Acceso Total'
                    : (Array.isArray(member.permisosModulos) ? member.permisosModulos.join(', ') : 'Acceso Total')}
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: member.activo ? '#10B981' : '#EF4444',
                    marginRight: '6px'
                  }} />
                  {member.activo ? 'Activo' : 'Suspendido'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {member.id === 1 || member.email === 'cesar.sanchez@isil.pe' ? (
                    <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 'bold' }}>
                      🛡️ Propietario Principal
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleToggleStatus(member)}
                      style={{ padding: '4px 8px', fontSize: '11.5px' }}
                    >
                      {member.activo ? 'Suspender' : 'Reactivar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staffList.length === 0 && !loading && (
          <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
            No hay miembros registrados aparte del Propietario.
          </p>
        )}
      </div>
    </section>
  );
}
