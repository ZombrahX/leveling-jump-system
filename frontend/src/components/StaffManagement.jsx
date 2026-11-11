import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

const MODULOS_DISPONIBLES = [
  { id: 'PRODUCTOS', label: 'Catálogo y Precios' },
  { id: 'LOTES', label: 'Recepción de Lotes e Inventario' },
  { id: 'RESERVAS', label: 'Gestión de Reservas y Clientes' },
  { id: 'USUARIOS', label: 'Administración de Personal' }
];

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Control del Pop-up Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busquedaEmail, setBusquedaEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalMsg, setModalMsg] = useState('');

  // Usuario encontrado o modo nuevo registro
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null);
  const [modoNuevoRegistro, setModoNuevoRegistro] = useState(false);

  // Campos de formulario en modal
  const [rolSeleccionado, setRolSeleccionado] = useState('ADMIN');
  const [permisos, setPermisos] = useState(['PRODUCTOS', 'LOTES', 'RESERVAS']);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [guardando, setGuardando] = useState(false);

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

  const abrirModalNuevo = () => {
    setBusquedaEmail('');
    setUsuarioEncontrado(null);
    setModoNuevoRegistro(false);
    setRolSeleccionado('ADMIN');
    setPermisos(['PRODUCTOS', 'LOTES', 'RESERVAS']);
    setNuevoNombre('');
    setNuevoPassword('');
    setModalError('');
    setModalMsg('');
    setIsModalOpen(true);
  };

  const abrirModalEditar = (member) => {
    setBusquedaEmail(member.email);
    setUsuarioEncontrado(member);
    setModoNuevoRegistro(false);
    setRolSeleccionado(member.rol);
    setPermisos(
      member.rol === 'SUPERADMIN'
        ? MODULOS_DISPONIBLES.map(m => m.id)
        : (Array.isArray(member.permisosModulos) && member.permisosModulos.length > 0
            ? member.permisosModulos
            : ['PRODUCTOS', 'LOTES', 'RESERVAS'])
    );
    setModalError('');
    setModalMsg('');
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setUsuarioEncontrado(null);
    setModoNuevoRegistro(false);
    setModalError('');
    setModalMsg('');
  };

  const handleBuscarEmail = async (e) => {
    if (e) e.preventDefault();
    if (!busquedaEmail.trim()) {
      setModalError('Por favor ingresa un correo electrónico para buscar.');
      return;
    }

    setBuscando(true);
    setModalError('');
    setModalMsg('');
    setUsuarioEncontrado(null);
    setModoNuevoRegistro(false);

    try {
      const res = await authService.buscarUsuarioPorEmail(busquedaEmail.trim());
      if (res.encontrado && res.usuario) {
        setUsuarioEncontrado(res.usuario);
        setRolSeleccionado(res.usuario.rol === 'CLIENTE' ? 'ADMIN' : res.usuario.rol);
        setPermisos(
          res.usuario.rol === 'SUPERADMIN'
            ? MODULOS_DISPONIBLES.map(m => m.id)
            : (Array.isArray(res.usuario.permisosModulos) && res.usuario.permisosModulos.length > 0
                ? res.usuario.permisosModulos
                : ['PRODUCTOS', 'LOTES', 'RESERVAS'])
        );
      } else {
        setModoNuevoRegistro(true);
        setModalMsg('No se encontró ninguna cuenta registrada con este correo. Puedes crearla directamente como miembro de staff:');
      }
    } catch (err) {
      setModalError(err.message || 'Error al consultar la cuenta de usuario.');
    } finally {
      setBuscando(false);
    }
  };

  const handleTogglePermiso = modId => {
    if (rolSeleccionado === 'SUPERADMIN') return; // Bloqueado si es superadmin
    if (permisos.includes(modId)) {
      setPermisos(permisos.filter(p => p !== modId));
    } else {
      setPermisos([...permisos, modId]);
    }
  };

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalMsg('');
    setGuardando(true);

    try {
      if (usuarioEncontrado) {
        // CASO 1: Promover o actualizar rol de usuario existente
        const permisosFinales = rolSeleccionado === 'SUPERADMIN'
          ? MODULOS_DISPONIBLES.map(m => m.id)
          : permisos;

        const res = await authService.asignarRolStaff(usuarioEncontrado.id, {
          rol: rolSeleccionado,
          permisosModulos: permisosFinales
        });

        setMsg(`¡Acceso de "${usuarioEncontrado.nombre}" actualizado a ${rolSeleccionado} exitosamente!`);
        await loadStaff();
        cerrarModal();
      } else if (modoNuevoRegistro) {
        // CASO 2: Crear staff desde cero
        if (!nuevoNombre.trim()) {
          setModalError('El nombre completo es obligatorio.');
          setGuardando(false);
          return;
        }
        if (nuevoPassword.length < 6) {
          setModalError('La contraseña inicial debe tener al menos 6 caracteres.');
          setGuardando(false);
          return;
        }

        const permisosFinales = rolSeleccionado === 'SUPERADMIN'
          ? MODULOS_DISPONIBLES.map(m => m.id)
          : permisos;

        await authService.crearStaff({
          nombre: nuevoNombre.trim(),
          email: busquedaEmail.trim(),
          password: nuevoPassword,
          rol: rolSeleccionado,
          permisosModulos: permisosFinales
        });

        setMsg(`¡Nuevo miembro de staff "${nuevoNombre}" registrado con éxito!`);
        await loadStaff();
        cerrarModal();
      }
    } catch (err) {
      setModalError(err.message || 'No se pudo guardar la configuración de staff.');
    } finally {
      setGuardando(false);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Gestión de Staff y Jerarquía de Accesos</h2>
          <p className="muted">
            Panel exclusivo del Propietario. Administra las cuentas del equipo, asigna roles de administración y permisos por módulo.
          </p>
        </div>
        <button
          className="primary"
          onClick={abrirModalNuevo}
        >
          + Nuevo Miembro de Staff
        </button>
      </div>

      {msg && <div className="alert ok" style={{ marginBottom: '16px' }}>{msg}</div>}
      {error && <div className="alert err" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Tabla de Miembros de Staff */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #30363D', color: '#8B949E' }}>
              <th style={{ padding: '10px 8px' }}>Nombre</th>
              <th style={{ padding: '10px 8px' }}>Correo Electrónico</th>
              <th style={{ padding: '10px 8px' }}>Rol Asignado</th>
              <th style={{ padding: '10px 8px' }}>Módulos Habilitados</th>
              <th style={{ padding: '10px 8px' }}>Estado</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Acciones</th>
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
                    ? 'Acceso Total (Todos los Módulos)'
                    : (Array.isArray(member.permisosModulos) && member.permisosModulos.length > 0
                        ? member.permisosModulos.join(', ')
                        : 'Acceso Total')}
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
                <td style={{ padding: '12px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {member.id === 1 || member.email === 'cesar.sanchez@isil.pe' ? (
                    <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 'bold' }}>
                      🛡️ Propietario Principal
                    </span>
                  ) : (
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => abrirModalEditar(member)}
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        title="Modificar rol o permisos"
                      >
                        ⚙️ Permisos
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleToggleStatus(member)}
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                      >
                        {member.activo ? 'Suspender' : 'Reactivar'}
                      </button>
                    </div>
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

      {/* ============================================================== */}
      {/* POP-UP MODAL: ASIGNACIÓN DE STAFF, ROLES Y PERMISOS             */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--color-cyan)' }}>
                {usuarioEncontrado ? 'CONFIGURAR ROL Y PERMISOS DE STAFF' : 'AGREGAR MIEMBRO DE STAFF'}
              </h3>
              <button className="modal-close-btn" onClick={cerrarModal}>&times;</button>
            </div>

            {modalError && <div className="alert err" style={{ margin: '14px 0' }}>{modalError}</div>}
            {modalMsg && <div className="alert ok" style={{ margin: '14px 0' }}>{modalMsg}</div>}

            {/* PASO 1: BUSCADOR POR CORREO */}
            <form onSubmit={handleBuscarEmail} style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                Buscar usuario registrado por correo electrónico:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={busquedaEmail}
                  onChange={e => setBusquedaEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  style={{ flex: 1 }}
                  required
                />
                <button
                  type="submit"
                  className="secondary"
                  disabled={buscando}
                  style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
                >
                  {buscando ? 'Buscando...' : '🔍 Buscar'}
                </button>
              </div>
              <small style={{ color: '#64748B', display: 'block', marginTop: '4px' }}>
                Puedes buscar a cualquier cliente registrado para promoverlo a Staff sin perder su cuenta ni historial.
              </small>
            </form>

            {/* CASO A: USUARIO ENCONTRADO EN LA BD */}
            {usuarioEncontrado && (
              <form onSubmit={handleGuardarCambios}>
                {/* Tarjeta de datos del usuario encontrado */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 'bold', color: '#0F172A' }}>
                      👤 {usuarioEncontrado.nombre}
                    </span>
                    <span className={`badge-role ${usuarioEncontrado.rol.toLowerCase()}`}>
                      {usuarioEncontrado.rol === 'SUPERADMIN' ? '👑 SUPERADMIN' : usuarioEncontrado.rol === 'ADMIN' ? 'STAFF ADMIN' : '🛒 CLIENTE REGISTRADO'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                    <div><strong>Correo:</strong> {usuarioEncontrado.email}</div>
                    <div><strong>Teléfono:</strong> {usuarioEncontrado.telefono || 'No registrado aún'}</div>
                    <div><strong>Método de Registro:</strong> {usuarioEncontrado.metodoRegistro === 'GOOGLE' ? 'Google OAuth' : 'Registro Local (Correo)'}</div>
                  </div>
                </div>

                {/* Rol y Nivel de Jerarquía */}
                <label style={{ display: 'block', marginBottom: '14px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                    Rol y Nivel de Jerarquía *
                  </span>
                  <select
                    value={rolSeleccionado}
                    onChange={e => {
                      const nuevoRol = e.target.value;
                      setRolSeleccionado(nuevoRol);
                      if (nuevoRol === 'SUPERADMIN') {
                        setPermisos(MODULOS_DISPONIBLES.map(m => m.id));
                      }
                    }}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                  >
                    <option value="ADMIN">STAFF (Administrador de Operaciones)</option>
                    <option value="SUPERADMIN">SUPERADMIN (Administrador General / Acceso Total)</option>
                    <option value="CLIENTE">CLIENTE (Remover de Staff y dejar como cliente regular)</option>
                  </select>
                </label>

                {/* Permisos de Módulos Asignados */}
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Permisos de Módulos Asignados:
                  </span>

                  {rolSeleccionado === 'SUPERADMIN' ? (
                    <div style={{
                      padding: '12px 14px',
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      borderRadius: '6px',
                      color: '#92400E',
                      fontSize: '12.5px',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                        ⭐ Acceso Total Irrestricto
                      </div>
                      <div>
                        Las casillas de permisos se encuentran habilitadas y bloqueadas. El Superadministrador tiene acceso garantizado a todos los módulos comerciales y de auditoría.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px' }}>
                        {MODULOS_DISPONIBLES.map(m => (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', opacity: 0.9 }}>
                            <input type="checkbox" checked={true} disabled={true} />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : rolSeleccionado === 'CLIENTE' ? (
                    <div style={{ padding: '10px 14px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#475569', fontSize: '12.5px' }}>
                      ℹ️ Al asignar el rol de <strong>Cliente</strong>, la cuenta pierde acceso al panel administrativo pero conserva todas sus reservas e historial personal.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      {MODULOS_DISPONIBLES.map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={permisos.includes(m.id)}
                            onChange={() => handleTogglePermiso(m.id)}
                          />
                          <span>{m.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="secondary" onClick={cerrarModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary" disabled={guardando}>
                    {guardando ? 'Guardando...' : '💾 Guardar Permisos y Asignar Rol'}
                  </button>
                </div>
              </form>
            )}

            {/* CASO B: USUARIO NO ENCONTRADO -> REGISTRAR NUEVO DESDE CERO */}
            {modoNuevoRegistro && (
              <form onSubmit={handleGuardarCambios}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                  <label>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Nombre Completo *</span>
                    <input
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Ej: Daniel Carrión"
                      required
                    />
                  </label>

                  <label>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Correo Electrónico *</span>
                    <input
                      type="email"
                      value={busquedaEmail}
                      disabled={true}
                      style={{ background: '#F1F5F9' }}
                    />
                  </label>

                  <label>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Contraseña Temporal Inicial *</span>
                    <input
                      type="password"
                      value={nuevoPassword}
                      onChange={e => setNuevoPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </label>

                  <label>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Rol y Nivel de Jerarquía *</span>
                    <select
                      value={rolSeleccionado}
                      onChange={e => {
                        const nuevoRol = e.target.value;
                        setRolSeleccionado(nuevoRol);
                        if (nuevoRol === 'SUPERADMIN') {
                          setPermisos(MODULOS_DISPONIBLES.map(m => m.id));
                        }
                      }}
                    >
                      <option value="ADMIN">STAFF (Administrador de Operaciones)</option>
                      <option value="SUPERADMIN">SUPERADMIN (Administrador General)</option>
                    </select>
                  </label>
                </div>

                {/* Permisos */}
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Permisos de Módulos Asignados:
                  </span>
                  {rolSeleccionado === 'SUPERADMIN' ? (
                    <div style={{ padding: '10px 14px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', color: '#92400E', fontSize: '12.5px' }}>
                      ⭐ Superadmin cuenta con acceso automático a todos los módulos.
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                        {MODULOS_DISPONIBLES.map(m => (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                            <input type="checkbox" checked={true} disabled={true} />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#F8FAFC', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      {MODULOS_DISPONIBLES.map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={permisos.includes(m.id)}
                            onChange={() => handleTogglePermiso(m.id)}
                          />
                          <span>{m.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="secondary" onClick={cerrarModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary" disabled={guardando}>
                    {guardando ? 'Creando...' : 'Crear Cuenta de Staff'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
