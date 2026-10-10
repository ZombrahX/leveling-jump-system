import { useMemo, useState } from 'react';

export default function ProductList({
  productos,
  busqueda,
  categoria,
  onBusquedaChange,
  onCategoriaChange,
  onEdit,
  cargando
}) {
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' o 'desc'

  const toggleSort = field => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = field => {
    if (sortField !== field) return <span style={{ opacity: 0.35, marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: '#29366f', fontWeight: 'bold', marginLeft: '4px' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  const productosOrdenados = useMemo(() => {
    const lista = [...productos];
    lista.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'precio') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return lista;
  }, [productos, sortField, sortOrder]);

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Catálogo de productos</h2>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          Ordenado por <b>{sortField.toUpperCase()}</b> ({sortOrder === 'asc' ? 'Ascendente 1➔9' : 'Descendente 9➔1'})
        </span>
      </div>

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
      ) : productosOrdenados.length === 0 ? (
        <p>No se encontraron productos registrados.</p>
      ) : (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none', width: '65px' }} onClick={() => toggleSort('id')} title="Ordenar por ID">
                  # ID {getSortIcon('id')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('codigo')} title="Ordenar por SKU">
                  SKU {getSortIcon('codigo')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('nombre')} title="Ordenar por Producto">
                  Producto {getSortIcon('nombre')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('categoria')} title="Ordenar por Categoría">
                  Categoría {getSortIcon('categoria')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('marca')} title="Ordenar por Marca">
                  Marca {getSortIcon('marca')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('precio')} title="Ordenar por Precio">
                  Precio {getSortIcon('precio')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('estado')} title="Ordenar por Estado">
                  Estado {getSortIcon('estado')}
                </th>
                <th style={{ width: '60px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosOrdenados.map(p => (
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
