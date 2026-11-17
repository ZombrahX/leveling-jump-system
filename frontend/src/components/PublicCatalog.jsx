import { useState, useMemo } from 'react';
import { reservaPoliticaService } from '../services/reservaPoliticaService';

function formatDisponibilidad(producto) {
  if (typeof producto.disponibles === 'number') {
    if (producto.disponibles === 0) return 'Agotado (0 disp.)';
    if (producto.disponibles === 1) return '¡Última unidad!';
    return `${producto.disponibles} disponibles`;
  }
  if (producto.stockActual !== undefined) {
    if (producto.stockActual <= 0) return 'Agotado';
    return `${producto.stockActual} en stock`;
  }
  return 'En stock (Por verificar)';
}

export default function PublicCatalog({
  productos,
  cargando,
  error,
  onRecargar,
  carrito = [],
  onAddToCart,
  onApartarDirecto,
  onAbrirCarrito,
  onAvisarStock
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');

  const cartCount = useMemo(() => {
    return carrito.reduce((acc, curr) => acc + (curr.cantidad || 1), 0);
  }, [carrito]);

  const visibles = useMemo(() => productos.filter(p => {
    const text = `${p.nombre || ''} ${p.marca || ''} ${p.serie || ''}`.toLowerCase();
    return text.includes(busqueda.trim().toLowerCase()) && (!categoria || p.categoria === categoria) && p.estado !== 'INACTIVO';
  }), [productos, busqueda, categoria]);

  return (
    <section className="public-catalog">
      <div className="catalog-heading">
        <div>
          <h2>Catálogo de productos</h2>
          <p className="muted">Explora el catálogo disponible de Leveling Jump con disponibilidad de stock en tiempo real.</p>
        </div>
        <div>
          <button className="secondary" type="button" onClick={onRecargar}>Actualizar lista</button>
        </div>
      </div>

      <div className="filters">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, marca o serie…"
        />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="GUNPLA">Gunpla</option>
          <option value="HERRAMIENTAS">Herramientas</option>
          <option value="PINTURAS">Pinturas</option>
          <option value="ACCESORIOS">Accesorios</option>
          <option value="OTROS">Otros</option>
        </select>
      </div>

      {cargando && <p className="muted">Cargando catálogo…</p>}
      {error && <div className="alert err">{error}</div>}

      <div className="catalog-grid">
        {visibles.map(p => {
          const disp = formatDisponibilidad(p);
          const isAgotado = (typeof p.disponibles === 'number' && p.disponibles === 0) || (p.stockActual !== undefined && p.stockActual <= 0);
          const cartItem = carrito.find(item => item.id === p.id);

          return (
            <article key={p.id} className="catalog-card">
              <div className="catalog-card-image">
                {p.imagenUrl ? (
                  <img
                    src={p.imagenUrl}
                    alt={p.nombre}
                    loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="placeholder-image">Sin imagen</span>
                )}
                <span className={`badge-disponibilidad ${isAgotado ? 'agotado' : 'disponible'}`}>
                  {disp}
                </span>
              </div>
              <div className="catalog-card-body">
                <span className="catalog-card-brand">{p.marca || 'Marca'} · {p.serie || 'Serie'}</span>
                <h3>{p.nombre}</h3>
                {p.descripcion && <p className="catalog-card-desc">{p.descripcion}</p>}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span className="catalog-card-price">
                    {p.precio !== undefined ? `S/ ${Number(p.precio).toFixed(2)}` : 'Consultar'}
                  </span>
                  
                  {/* Etiqueta de política de reserva */}
                  <div>
                    {(() => {
                      const pol = reservaPoliticaService.obtenerPoliticaProducto(p.id);
                      if (pol.modo === 'PAGO_TOTAL') {
                        return <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 'bold' }}>⭐ Pago 100%</span>;
                      }
                      if (pol.modo === 'CINCUENTA_TOTAL') {
                        return <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 'bold' }}>💡 Mín. 50%</span>;
                      }
                      return <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>🔖 Mín. {pol.p1 || 20}%</span>;
                    })()}
                  </div>
                </div>

                {/* Botones de acción unificados (HU-02) */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {isAgotado ? (
                    <button
                      type="button"
                      className="primary"
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        fontSize: '12.5px',
                        background: '#D97706',
                        color: '#FFFFFF',
                        cursor: 'pointer'
                      }}
                      onClick={() => onAvisarStock && onAvisarStock(p)}
                      title="Anotarme en la lista de espera para cuando llegue stock"
                    >
                      🔔 Avisarme (Waitlist)
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="primary"
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          background: cartItem ? 'var(--color-cyan)' : undefined,
                          color: cartItem ? '#080B0F' : undefined,
                          fontWeight: cartItem ? 'bold' : 'normal',
                          boxShadow: cartItem ? '0 0 10px var(--color-cyan-glow)' : undefined
                        }}
                        onClick={() => onAddToCart && onAddToCart(p)}
                        title="Añadir al carrito de compras"
                      >
                        {cartItem ? `🛒 En Carrito (${cartItem.cantidad}) +` : '🛒 Al Carrito'}
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        style={{
                          padding: '9px 12px',
                          fontSize: '12.5px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                        onClick={() => onApartarDirecto && onApartarDirecto(p)}
                        title="Apartar inmediatamente este kit con adelanto"
                      >
                        🔖 Apartar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Botón flotante para acceder al carrito desde cualquier punto */}
      {cartCount > 0 && (
        <div
          onClick={onAbrirCarrito}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--color-cyan)',
            color: '#080B0F',
            padding: '12px 22px',
            borderRadius: '30px',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 8px 24px rgba(0, 210, 238, 0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 999,
            transition: 'all 0.2s ease',
            border: '2px solid #FFFFFF'
          }}
        >
          <span style={{ fontSize: '18px' }}>🛒</span>
          <span>Ver Carrito ({cartCount} {cartCount === 1 ? 'kit' : 'kits'})</span>
        </div>
      )}
    </section>
  );
}
