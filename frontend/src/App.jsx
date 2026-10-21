import { useCallback, useEffect, useState } from 'react';
import ProductForm from './components/ProductForm';
import ProductList from './components/ProductList';
import ReceptionForm from './components/ReceptionForm';
import PublicCatalog from './components/PublicCatalog';
import ReservasList from './components/ReservasList';
import CustomerReservations from './components/CustomerReservations';
import UserProfile from './components/UserProfile';
import StaffManagement from './components/StaffManagement';
import LoginModal from './components/LoginModal';
import ReservationModal from './components/ReservationModal';
import MultiReservationModal from './components/MultiReservationModal';
import { obtenerProductos, crearProducto, actualizarProducto } from './services/productService';
import { registrarRecepcion } from './services/recepcionService';
import { authService } from './services/authService';
import { reservaPoliticaService } from './services/reservaPoliticaService';

const emptyProduct = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria: 'MODEL_KITS',
  serie: '',
  escala: 'NO_APLICA',
  marca: '',
  precio: '',
  imagenUrl: '',
  estado: 'ACTIVO'
};

export default function App() {
  // Sesión del usuario autenticado
  const [sesion, setSesion] = useState(() => authService.obtenerSesionActual());
  const usuario = sesion?.usuario || null;
  const token = sesion?.token || null;
  const esStaff = usuario && (usuario.rol === 'SUPERADMIN' || usuario.rol === 'ADMIN');
  const esSuperadmin = usuario?.rol === 'SUPERADMIN';

  // Por defecto, vista catálogo para clientes y visitantes
  const [vista, setVista] = useState(() => (esStaff ? 'productos' : 'catalogo'));
  const [productos, setProductos] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Control de menús desplegables del Navbar
  const [openDropdown, setOpenDropdown] = useState(null);

  // Modales
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [productoReserva, setProductoReserva] = useState(null);
  const [showMultiModal, setShowMultiModal] = useState(false);

  // Bolsa de Reserva (Reservas en Masa) con persistencia en localStorage
  const [bolsaReservas, setBolsaReservas] = useState(() => {
    try {
      const saved = localStorage.getItem('lj_bolsa_reservas');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const toggleBolsa = (producto) => {
    setBolsaReservas(prev => {
      const existe = prev.some(item => item.id === producto.id);
      const updated = existe
        ? prev.filter(item => item.id !== producto.id)
        : [...prev, producto];
      try {
        localStorage.setItem('lj_bolsa_reservas', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const removeFromBolsa = (productoId) => {
    setBolsaReservas(prev => {
      const updated = prev.filter(item => item.id !== productoId);
      try {
        localStorage.setItem('lj_bolsa_reservas', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const clearBolsa = () => {
    setBolsaReservas([]);
    try {
      localStorage.removeItem('lj_bolsa_reservas');
    } catch (_) {}
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.nav-dropdown-wrapper')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await obtenerProductos({
        busqueda: vista === 'productos' ? busqueda : '',
        categoria: vista === 'productos' ? categoria : ''
      });
      setProductos(data);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [busqueda, categoria, vista]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLoginSuccess = (usuarioLogueado) => {
    const ses = authService.obtenerSesionActual();
    setSesion(ses);
    if (usuarioLogueado.rol === 'SUPERADMIN' || usuarioLogueado.rol === 'ADMIN') {
      setVista('productos');
    } else {
      setVista('catalogo');
    }
  };

  const handleLogout = () => {
    authService.cerrarSesion();
    setSesion(null);
    setVista('catalogo');
    setMsg('Sesión cerrada correctamente.');
  };

  const saveProduct = async data => {
    setError('');
    setMsg('');
    const { politicaReserva, ...productData } = data;
    let savedId = null;

    if (edit) {
      await actualizarProducto(edit.id, productData);
      savedId = edit.id;
      setMsg('Producto actualizado correctamente.');
    } else {
      const res = await crearProducto(productData);
      savedId = res?.producto?.id;
      setMsg('Producto registrado correctamente.');
    }

    if (savedId && politicaReserva) {
      reservaPoliticaService.guardarPoliticaProducto(savedId, { modo: politicaReserva });
    }

    setEdit(null);
    await load();
  };

  const saveReception = async payload => {
    setError('');
    setMsg('');
    await registrarRecepcion(payload);
    setMsg('Recepción registrada correctamente.');
    await load();
  };

  const toggleEstadoProduct = async producto => {
    try {
      const nuevoEstado = producto.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const accion = nuevoEstado === 'INACTIVO' ? 'desactivado' : 'activado';
      if (!window.confirm(`¿Deseas ${nuevoEstado === 'INACTIVO' ? 'desactivar' : 'activar'} el producto "${producto.nombre}"?`)) {
        return;
      }
      setError('');
      setMsg('');
      await actualizarProducto(producto.id, { estado: nuevoEstado });
      setMsg(`Producto ${accion} correctamente en el catálogo.`);
      await load();
    } catch (e) {
      setError(e.message || 'No se pudo cambiar el estado del producto.');
    }
  };

  const chooseView = next => {
    setVista(next);
    setOpenDropdown(null);
    setError('');
    setMsg('');
    if (next !== 'productos') setEdit(null);
  };

  const toggleDropdown = name => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  return (
    <main>
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-logo-circle">
            <img
              src="/logo_leveling_jump.jpg"
              alt="Leveling Jump Logo"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <small>LEVELING JUMP · TIENDA OFICIAL DE HOBBY & COLECCIONABLES</small>
            <h1>Gunpla, Model Kits & Anime Collectibles</h1>
            <p>Model Kits originales Bandai, figuras importadas y preventas exclusivas</p>
          </div>
        </div>

        {/* Sección de autenticación, perfil y acceso a la bolsa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {bolsaReservas.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setShowMultiModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderColor: 'var(--color-cyan)',
                color: 'var(--color-cyan)',
                background: 'rgba(0, 210, 238, 0.08)'
              }}
            >
              <span>🛒</span> Bolsa ({bolsaReservas.length})
            </button>
          )}

          {usuario ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#161B22', padding: '8px 14px', borderRadius: '8px', border: '1px solid #30363D' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: '#FFFFFF', fontSize: '14px' }}>
                    {(usuario.nombre || '').replace(/\s*\((Google|Local)\)/gi, '').trim()}
                  </strong>
                  {usuario.rol !== 'CLIENTE' && (
                    <span className={`badge-role ${usuario.rol.toLowerCase()}`}>
                      {usuario.rol === 'SUPERADMIN' ? '👑 SUPERADMIN' : 'STAFF'}
                    </span>
                  )}
                </div>
                <small style={{ color: '#8B949E', fontSize: '11px' }}>{usuario.email}</small>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', borderLeft: '1px solid #30363D', paddingLeft: '10px' }}>
                <button
                  type="button"
                  className={`secondary ${vista === 'perfil' ? 'active' : ''}`}
                  onClick={() => chooseView('perfil')}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  title="Mi perfil de usuario"
                >
                  👤 Mi Perfil
                </button>
                <button
                  type="button"
                  className={`secondary ${vista === 'mis-reservas' ? 'active' : ''}`}
                  onClick={() => chooseView('mis-reservas')}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  title="Mis reservas registradas"
                >
                  🔖 Mis Reservas
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleLogout}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  title="Cerrar sesión"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => setShowLoginModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px' }}
            >
              <span>👤</span> Iniciar Sesión / Registrarse
            </button>
          )}
        </div>
      </header>

      {/* Barra de Navegación Empresarial con Menús Desplegables */}
      <nav className="main-nav-bar" aria-label="Navegación principal del sistema">
        {!esStaff ? (
          <>
            <button
              className={`nav-bar-btn ${vista === 'catalogo' ? 'active' : ''}`}
              onClick={() => chooseView('catalogo')}
            >
              <span>🛍️</span> Catálogo Comercial
            </button>
            {usuario && (
              <>
                <button
                  className={`nav-bar-btn ${vista === 'mis-reservas' ? 'active' : ''}`}
                  onClick={() => chooseView('mis-reservas')}
                >
                  <span>🔖</span> Mis Reservas
                </button>
                <button
                  className={`nav-bar-btn ${vista === 'perfil' ? 'active' : ''}`}
                  onClick={() => chooseView('perfil')}
                >
                  <span>👤</span> Mi Perfil
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {/* Menú Desplegable 1: Catálogo & Tienda */}
            <div className="nav-dropdown-wrapper">
              <button
                type="button"
                className={`nav-bar-btn has-dropdown ${vista === 'catalogo' || vista === 'productos' ? 'active' : ''}`}
                onClick={() => toggleDropdown('catalogo')}
              >
                <span>📦</span> Catálogo & Tienda
                <span className={`nav-chevron ${openDropdown === 'catalogo' ? 'open' : ''}`}>▾</span>
              </button>
              {openDropdown === 'catalogo' && (
                <div className="nav-dropdown-menu">
                  <div
                    className={`nav-dropdown-item ${vista === 'catalogo' ? 'active' : ''}`}
                    onClick={() => chooseView('catalogo')}
                  >
                    <span className="item-icon">🛍️</span>
                    <div>
                      <strong>Catálogo Comercial</strong>
                      <small>Vista de venta con stock y reservas en vivo</small>
                    </div>
                  </div>
                  <div
                    className={`nav-dropdown-item ${vista === 'productos' ? 'active' : ''}`}
                    onClick={() => chooseView('productos')}
                  >
                    <span className="item-icon">📋</span>
                    <div>
                      <strong>Gestión de Productos</strong>
                      <small>Catálogo maestro, edición, precios y márgenes</small>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Menú Desplegable 2: Almacén & Lotes */}
            <div className="nav-dropdown-wrapper">
              <button
                type="button"
                className={`nav-bar-btn has-dropdown ${vista === 'recepcion' ? 'active' : ''}`}
                onClick={() => toggleDropdown('almacen')}
              >
                <span>📥</span> Almacén & Lotes
                <span className={`nav-chevron ${openDropdown === 'almacen' ? 'open' : ''}`}>▾</span>
              </button>
              {openDropdown === 'almacen' && (
                <div className="nav-dropdown-menu">
                  <div
                    className={`nav-dropdown-item ${vista === 'recepcion' ? 'active' : ''}`}
                    onClick={() => chooseView('recepcion')}
                  >
                    <span className="item-icon">📦</span>
                    <div>
                      <strong>Recepción de Lotes</strong>
                      <small>Ingreso de embarques, fletes e inventario unitario</small>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Menú Desplegable 3: Ventas & Reservas */}
            <div className="nav-dropdown-wrapper">
              <button
                type="button"
                className={`nav-bar-btn has-dropdown ${vista === 'reservas' || vista === 'mis-reservas' ? 'active' : ''}`}
                onClick={() => toggleDropdown('ventas')}
              >
                <span>🔖</span> Ventas & Reservas
                <span className={`nav-chevron ${openDropdown === 'ventas' ? 'open' : ''}`}>▾</span>
              </button>
              {openDropdown === 'ventas' && (
                <div className="nav-dropdown-menu">
                  <div
                    className={`nav-dropdown-item ${vista === 'reservas' ? 'active' : ''}`}
                    onClick={() => chooseView('reservas')}
                  >
                    <span className="item-icon">📑</span>
                    <div>
                      <strong>Control de Reservas de Tienda</strong>
                      <small>Auditoría de adelantos, saldos y retiros en ferias</small>
                    </div>
                  </div>
                  <div
                    className={`nav-dropdown-item ${vista === 'mis-reservas' ? 'active' : ''}`}
                    onClick={() => chooseView('mis-reservas')}
                  >
                    <span className="item-icon">🔖</span>
                    <div>
                      <strong>Mis Reservas Personales</strong>
                      <small>Historial de kits apartados a mi nombre</small>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Menú Desplegable 4: Administración (Solo Superadmin) */}
            {esSuperadmin && (
              <div className="nav-dropdown-wrapper">
                <button
                  type="button"
                  className={`nav-bar-btn has-dropdown ${vista === 'staff' ? 'active' : ''}`}
                  onClick={() => toggleDropdown('admin')}
                >
                  <span>👑</span> Administración
                  <span className={`nav-chevron ${openDropdown === 'admin' ? 'open' : ''}`}>▾</span>
                </button>
                {openDropdown === 'admin' && (
                  <div className="nav-dropdown-menu">
                    <div
                      className={`nav-dropdown-item ${vista === 'staff' ? 'active' : ''}`}
                      onClick={() => chooseView('staff')}
                    >
                      <span className="item-icon">👥</span>
                      <div>
                        <strong>Gestión de Staff</strong>
                        <small>Creación de administradores y control de roles</small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Acceso a Mi Perfil para Staff */}
            <button
              className={`nav-bar-btn ${vista === 'perfil' ? 'active' : ''}`}
              onClick={() => chooseView('perfil')}
            >
              <span>👤</span> Mi Perfil
            </button>
          </>
        )}
      </nav>

      {/* Vistas según navegación */}
      {vista === 'catalogo' && (
        <div className="single-view">
          <PublicCatalog
            productos={productos}
            cargando={loading}
            error={error}
            onRecargar={load}
            onReservarProducto={prod => setProductoReserva(prod)}
            bolsa={bolsaReservas}
            onToggleBolsa={toggleBolsa}
            onAbrirBolsa={() => setShowMultiModal(true)}
          />
        </div>
      )}

      {vista === 'mis-reservas' && usuario && (
        <div className="single-view">
          <CustomerReservations
            token={token}
            onExplorarCatalogo={() => chooseView('catalogo')}
          />
        </div>
      )}

      {vista === 'perfil' && usuario && (
        <div className="single-view">
          <UserProfile
            usuario={usuario}
            onPerfilActualizado={() => {
              const ses = authService.obtenerSesionActual();
              setSesion(ses);
            }}
            onVerMisReservas={() => chooseView('mis-reservas')}
          />
        </div>
      )}

      {vista === 'productos' && esStaff && (
        <>
          <div className="grid">
            <ProductForm
              initialData={edit || emptyProduct}
              isEditing={!!edit}
              onSubmit={saveProduct}
              onCancel={() => setEdit(null)}
            />
            <ProductList
              productos={productos}
              busqueda={busqueda}
              categoria={categoria}
              onBusquedaChange={setBusqueda}
              onCategoriaChange={setCategoria}
              onEdit={setEdit}
              onToggleEstado={toggleEstadoProduct}
              cargando={loading}
            />
          </div>
          {msg && <div className="alert ok">{msg}</div>}
          {error && <div className="alert err">{error}</div>}
        </>
      )}

      {vista === 'recepcion' && esStaff && (
        <div className="single-view">
          <ReceptionForm productos={productos} onSubmit={saveReception} cargando={loading} />
          {error && <div className="alert err">{error}</div>}
        </div>
      )}

      {vista === 'reservas' && esStaff && (
        <div className="single-view">
          <ReservasList token={token} />
        </div>
      )}

      {vista === 'staff' && esSuperadmin && (
        <div className="single-view">
          <StaffManagement />
        </div>
      )}

      <footer className="app-footer">
        &copy; 2026 Leveling Jump · Gunpla, Model Kits & Anime Collectibles · Proyecto Tecnológico ISIL
      </footer>

      {/* Modales Globales */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <ReservationModal
        isOpen={!!productoReserva}
        producto={productoReserva}
        usuarioActual={usuario}
        onClose={() => setProductoReserva(null)}
      />

      <MultiReservationModal
        isOpen={showMultiModal}
        items={bolsaReservas}
        onClose={() => setShowMultiModal(false)}
        onRemoveItem={removeFromBolsa}
        onClearBag={clearBolsa}
        usuarioActual={usuario}
        onReservaExitosa={() => {
          load();
          setMsg('¡Reserva múltiple confirmada con éxito!');
        }}
      />
    </main>
  );
}
