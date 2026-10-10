import { useCallback, useEffect, useState } from 'react';
import ProductForm from './components/ProductForm';
import ProductList from './components/ProductList';
import ReceptionForm from './components/ReceptionForm';
import PublicCatalog from './components/PublicCatalog';
import { obtenerProductos, crearProducto, actualizarProducto } from './services/productService';
import { registrarRecepcion } from './services/recepcionService';

const empty = { codigo: '', nombre: '', descripcion: '', categoria: 'MODEL_KITS', serie: '', escala: 'NO_APLICA', marca: '', precio: '', imagenUrl: '', estado: 'ACTIVO' };

export default function App() {
  const [vista, setVista] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setProductos(await obtenerProductos({ busqueda: vista === 'productos' ? busqueda : '', categoria: vista === 'productos' ? categoria : '' }));
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [busqueda, categoria, vista]);

  useEffect(() => { load(); }, [load]);

  const saveProduct = async data => {
    setError('');
    setMsg('');
    if (edit) {
      await actualizarProducto(edit.id, data);
      setMsg('Producto actualizado correctamente.');
    } else {
      await crearProducto(data);
      setMsg('Producto registrado correctamente.');
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

  const chooseView = next => {
    setVista(next);
    setError('');
    setMsg('');
    if (next !== 'productos') setEdit(null);
  };

  return (
    <main>
      <header className="app-header">
        <div>
          <small>LEVELING JUMP · SISTEMA DE GESTIÓN</small>
          <h1>Control de Inventario y Catálogo Comercial</h1>
          <p>Model Kits, Figuras Coleccionables y Accesorios</p>
        </div>
      </header>
      <nav className="main-nav" aria-label="Secciones del sistema">
        <button className={vista === 'productos' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('productos')}>Gestión de Productos</button>
        <button className={vista === 'recepcion' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('recepcion')}>Recepción de Lotes</button>
        <button className={vista === 'catalogo' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('catalogo')}>Catálogo Público</button>
      </nav>

      {vista === 'productos' && (
        <>
          <div className="grid">
            <ProductForm initialData={edit || empty} isEditing={!!edit} onSubmit={saveProduct} onCancel={() => setEdit(null)} />
            <ProductList productos={productos} busqueda={busqueda} categoria={categoria} onBusquedaChange={setBusqueda} onCategoriaChange={setCategoria} onEdit={setEdit} cargando={loading} />
          </div>
          {msg && <div className="alert ok">{msg}</div>}
          {error && <div className="alert err">{error}</div>}
        </>
      )}

      {vista === 'recepcion' && (
        <div className="single-view">
          <ReceptionForm productos={productos} onSubmit={saveReception} cargando={loading} />
          {error && <div className="alert err">{error}</div>}
        </div>
      )}

      {vista === 'catalogo' && (
        <div className="single-view">
          <PublicCatalog productos={productos} cargando={loading} error={error} onRecargar={load} />
        </div>
      )}
      <footer className="app-footer">© 2026 Leveling Jump · Sistema Integral de Gestión de Inventario y Catálogo Multicanal.</footer>
    </main>
  );
}
