import { useMemo, useState } from 'react';

const categories = ['MODEL_KITS', 'FIGURAS', 'ACCESORIOS', 'HERRAMIENTAS', 'OTROS'];

function availability(product) {
  const count = product.unidadesDisponibles ?? product.stockDisponible ?? product.disponibles;
  if (typeof count === 'number') return count > 0 ? `Disponible (${count})` : 'Agotado';
  if (typeof count === 'string' && count.trim() !== '' && !Number.isNaN(Number(count))) {
    return Number(count) > 0 ? `Disponible (${Number(count)})` : 'Agotado';
  }
  if (typeof product.disponibilidad === 'string') return product.disponibilidad;
  return 'Por confirmar';
}

export default function PublicCatalog({ productos, cargando, error, onRecargar }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');

  const visibles = useMemo(() => productos.filter(p => {
    const text = `${p.nombre || ''} ${p.marca || ''} ${p.serie || ''}`.toLowerCase();
    return text.includes(busqueda.trim().toLowerCase()) && (!categoria || p.categoria === categoria) && p.estado !== 'INACTIVO';
  }), [productos, busqueda, categoria]);

  return (
    <section className="public-catalog">
      <div className="catalog-heading">
        <div>
          <div className="section-kicker">HU01 · HU01-T04 / T05 / T06</div>
          <h2>Catálogo de productos</h2>
          <p className="muted">Explora los productos de Leveling Jump y consulta su disponibilidad.</p>
        </div>
        <button className="secondary" type="button" onClick={onRecargar}>Actualizar</button>
      </div>
      <div className="filters">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, marca o serie…" aria-label="Buscar productos" />
        <select value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      {cargando && <p>Cargando catálogo…</p>}
      {error && <div className="alert err">{error}</div>}
      {!cargando && !error && visibles.length === 0 && <div className="empty-state"><strong>No encontramos productos.</strong><span>Prueba con otra búsqueda o categoría.</span></div>}
      <div className="product-grid">
        {visibles.map(p => (
          <article className="product-card" key={p.id}>
            {p.imagenUrl
              ? <img src={p.imagenUrl} alt={p.nombre} onError={e => { e.currentTarget.style.display = 'none'; }} />
              : <div className="product-placeholder">LEVELING JUMP</div>}
            <div className="product-info">
              <span className="product-category">{(p.categoria || 'OTROS').replaceAll('_', ' ')}</span>
              <h3>{p.nombre}</h3>
              <p>{p.marca || 'Marca no especificada'}{p.serie ? ` · ${p.serie}` : ''}</p>
              <div className="product-bottom">
                <strong>{p.precio != null ? `S/ ${Number(p.precio).toFixed(2)}` : 'Precio por confirmar'}</strong>
                <span className={`availability ${availability(p).toLowerCase().startsWith('disponible') ? 'available' : ''}`}>{availability(p)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="small-note">La disponibilidad depende de los datos que exponga la API. Si el backend no devuelve unidades disponibles, se muestra “Por confirmar” en lugar de asumir stock.</p>
    </section>
  );
}
