export default function ProductList({
  productos,
  busqueda,
  categoria,
  onBusquedaChange,
  onCategoriaChange,
  onEdit,
  cargando
}) {
  return (
    <section className="card">
      <h2>Catálogo de productos</h2>
      <div className="filters">
        <input
          value={busqueda}
          onChange={e => onBusquedaChange(e.target.value)}
          placeholder="Buscar por nombre o serie..."
        />
        <select value={categoria} onChange={e => onCategoriaChange(e.target.value)}>
          <option value="">Todas las categorías</option>
          {['MODEL_KITS', 'FIGURAS', 'ACCESORIOS', 'HERRAMIENTAS', 'OTROS'].map(x => (
            <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p>Cargando catálogo...</p>
      ) : productos.length === 0 ? (
        <p>No se encontraron productos registrados.</p>
      ) : (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th style={{ width: '45px' }}># ID</th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Precio</th>
                <th>Estado</th>
                <th style={{ width: '60px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.id}</strong></td>
                  <td><code>{p.codigo}</code></td>
                  <td>
                    <b>{p.nombre}</b>
                    {p.serie && <small style={{ display: 'block', color: '#6b7280' }}>{p.serie}</small>}
                  </td>
                  <td>{p.categoria ? p.categoria.replaceAll('_', ' ') : '-'}</td>
                  <td>{p.marca}</td>
                  <td><strong>S/ {Number(p.precio).toFixed(2)}</strong></td>
                  <td>
                    <span className={`status-badge ${p.estado === 'ACTIVO' ? 'active' : 'inactive'}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td>
                    <button className="link" onClick={() => onEdit(p)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
