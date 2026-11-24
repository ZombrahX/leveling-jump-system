import { useMemo, useState } from 'react';
import { reservaPoliticaService } from '../services/reservaPoliticaService';

const categories = ['MODEL_KITS', 'FIGURAS', 'ACCESORIOS', 'HERRAMIENTAS', 'OTROS'];

function availability(product) {
  const count = product.stockDisponible ?? product.unidadesDisponibles ?? product.disponibles;
  if (typeof count === 'number') {
    return count > 0 ? `En stock (${count} unidades)` : 'Agotado';
  }
  if (typeof count === 'string' && count.trim() !== '' && !Number.isNaN(Number(count))) {
    const n = Number(count);
    return n > 0 ? `En stock (${n} unidades)` : 'Agotado';
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
          aria-label="Buscar productos"
        />
        <select value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </div>

      {cargando && <p>Cargando catálogo en vivo…</p>}
      {error && <div className="alert err">{error}</div>}
      {!cargando && !error && visibles.length === 0 && (
        <div className="empty-state">
          <strong>No se encontraron productos.</strong>
          <span>Prueba buscando con otro término o seleccionando otra categoría.</span>
        </div>
      )}

      <div className="product-grid">
        {visibles.map(p => {
          const avail = availability(p);
          const isAvail = avail.toLowerCase().includes('en stock');
          const isAgotado = !isAvail || (p.stockDisponible !== undefined && p.stockDisponible <= 0) || (p.disponibles !== undefined && p.disponibles <= 0);
          const cartItem = carrito.find(item => item.id === p.id);

          return (
            <article className="product-card" key={p.id}>
              {p.imagenUrl ? (
                <img src={p.imagenUrl} alt={p.nombre} onError={e => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="product-placeholder">LEVELING JUMP</div>
              )}
              <div className="product-info">
                <span className="product-category">{(p.categoria || 'OTROS').replaceAll('_', ' ')}</span>
                <h3>{p.nombre}</h3>
                <p>{p.marca || 'Marca no especificada'}{p.serie ? ` · ${p.serie}` : ''}</p>

                <div className="product-bottom">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                    <span className={`availability ${isAgotado ? 'sold-out' : 'available'}`}>{avail}</span>
                    <strong>S/ {Number(p.precio).toFixed(2)}</strong>
                  </div>

                  {/* Etiqueta de política de reserva */}
                  <div style={{ marginBottom: '10px' }}>
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

                  {/* Botones de acción unificados */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    {isAgotado ? (
                      <button
                        type="button"
                        className="primary"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
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
                      <button
                        type="button"
                        className="primary"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          background: cartItem ? 'var(--color-cyan)' : undefined,
                          color: cartItem ? '#080B0F' : undefined,
                          fontWeight: 'bold',
                          boxShadow: cartItem ? '0 0 10px var(--color-cyan-glow)' : undefined
                        }}
                        onClick={() => onAddToCart && onAddToCart(p)}
                        title="Añadir al carrito para reservar con adelanto o solicitar cotización"
                      >
                        {cartItem ? `🛒 En Carrito (${cartItem.cantidad}) · Añadir otro +` : '🛒 Agregar al Carrito'}
                      </button>
                    )}
                  </div>
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
            padding: '12px 20px',
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
