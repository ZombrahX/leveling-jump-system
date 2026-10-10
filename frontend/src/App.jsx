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
          <small>LEVELING JUMP · SPRINT 1</small>
          <h1>Plataforma de productos e inventario</h1>
          <p>Frontend del proyecto · HU03, HU04 y HU01</p>
        </div>
      </header>
      <nav className="main-nav" aria-label="Secciones del sistema">
        <button className={vista === 'productos' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('productos')}>Gestión de productos <span>HU03</span></button>
        <button className={vista === 'recepcion' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('recepcion')}>Recepción de lotes <span>HU04</span></button>
        <button className={vista === 'catalogo' ? 'nav-button active' : 'nav-button'} onClick={() => chooseView('catalogo')}>Catálogo público <span>HU01</span></button>
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
      <footer className="app-footer">Leveling Jump · Interfaz frontend para integración con las API del equipo.</footer>
    </main>
  );
}
