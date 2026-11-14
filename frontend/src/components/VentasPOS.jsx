import { useState, useEffect, useMemo } from 'react';
import { ventaService } from '../services/ventaService';

const CANALES = [
  { id: 'FERIA', label: '🎪 Feria / Stand Presencial', color: '#10B981' },
  { id: 'TIKTOK', label: '🎵 TikTok (Live / DM)', color: '#00D2EE' },
  { id: 'FACEBOOK', label: '📘 Facebook (Marketplace / DM)', color: '#3B82F6' },
  { id: 'WHATSAPP', label: '💬 WhatsApp Directo', color: '#22C55E' },
  { id: 'WEB', label: '🌐 Venta Web', color: '#F59E0B' },
  { id: 'OTRO', label: '📦 Otro Canal', color: '#8B5CF6' }
];

const MEDIOS_PAGO = [
  { id: 'YAPE', label: '📱 Yape' },
  { id: 'PLIN', label: '📱 Plin' },
  { id: 'EFECTIVO', label: '💵 Efectivo' },
  { id: 'TRANSFERENCIA', label: '🏦 Transferencia Bancaria' },
  { id: 'TARJETA', label: '💳 Tarjeta (POS Físico)' },
  { id: 'OTRO', label: 'Otro' }
];

export default function VentasPOS({ productos = [], onVentaCompletada, token, usuarioActual }) {
  // Pestaña activa: 'pos' (Punto de Venta) o 'historial' (Auditoría de Ventas)
  const [tab, setTab] = useState('pos');

  // Estado del Carrito POS
  const [carrito, setCarrito] = useState([]);
  const [canalSeleccionado, setCanalSeleccionado] = useState('FERIA');
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('YAPE');
  const [clienteRef, setClienteRef] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Buscador y filtros de catálogo en POS
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');

  // Feedback y carga
  const [procesando, setProcesando] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');
  const [ventaConfirmada, setVentaConfirmada] = useState(null);

  // Estado del Historial de Ventas
  const [historialVentas, setHistorialVentas] = useState([]);
  const [resumenHistorial, setResumenHistorial] = useState({ totalMontoRecaudado: 0, totalUnidadesVendidas: 0 });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [filtroCanalHistorial, setFiltroCanalHistorial] = useState('TODOS');
  const [filtroEstadoHistorial, setFiltroEstadoHistorial] = useState('TODOS');
  const [ventaSeleccionadaModal, setVentaSeleccionadaModal] = useState(null);
  const [anulandoId, setAnulandoId] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  // Cargar historial al cambiar a la pestaña de historial
  useEffect(() => {
    if (tab === 'historial') {
      cargarHistorial();
    }
  }, [tab, filtroCanalHistorial, filtroEstadoHistorial]);

  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const res = await ventaService.obtenerVentas(
        { canal: filtroCanalHistorial, estado: filtroEstadoHistorial },
        token
      );
      setHistorialVentas(res.ventas || []);
      setResumenHistorial(res.resumen || { totalMontoRecaudado: 0, totalUnidadesVendidas: 0 });
    } catch (err) {
      console.error('Error cargando historial de ventas:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Filtrado de productos disponibles para la caja POS
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      if (p.estado !== 'ACTIVO') return false;
      const matchTexto = !busqueda.trim() || 
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.serie && p.serie.toLowerCase().includes(busqueda.toLowerCase()));
      const matchCat = categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
      return matchTexto && matchCat;
    });
  }, [productos, busqueda, categoriaFiltro]);

  // Agregar producto al carrito POS
  const agregarAlCarrito = (producto) => {
    setErrorVenta('');
    const stockDisp = producto.stockDisponible || 0;
    if (stockDisp <= 0) {
      setErrorVenta(`"${producto.nombre}" no tiene unidades disponibles en este momento.`);
      return;
    }

    setCarrito(prev => {
      const index = prev.findIndex(item => item.id === producto.id);
      if (index >= 0) {
        const itemActual = prev[index];
        if (itemActual.cantidad >= stockDisp) {
          setErrorVenta(`No puedes agregar más de ${stockDisp} unidad(es) de "${producto.nombre}" (límite de stock disponible).`);
          return prev;
        }
        const updated = [...prev];
        updated[index] = { ...itemActual, cantidad: itemActual.cantidad + 1 };
        return updated;
      } else {
        return [...prev, {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          stockDisponible: stockDisp,
          imagenUrl: producto.imagenUrl,
          cantidad: 1
        }];
      }
    });
  };

  // Actualizar cantidad en carrito
  const actualizarCantidad = (idProducto, nuevaCantidad) => {
    setErrorVenta('');
    setCarrito(prev => {
      return prev.map(item => {
        if (item.id === idProducto) {
          if (nuevaCantidad > item.stockDisponible) {
            setErrorVenta(`Solo hay ${item.stockDisponible} unidad(es) disponibles de "${item.nombre}".`);
            return item;
          }
          if (nuevaCantidad <= 0) return null;
          return { ...item, cantidad: nuevaCantidad };
        }
        return item;
      }).filter(Boolean);
    });
  };

  // Quitar del carrito
  const quitarDelCarrito = (idProducto) => {
    setCarrito(prev => prev.filter(item => item.id !== idProducto));
  };

  // Limpiar carrito
  const vaciarCarrito = () => {
    setCarrito([]);
    setErrorVenta('');
  };

  // Cálculo del total
  const totalCarrito = useMemo(() => {
    return carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  }, [carrito]);

  // Enviar Venta
  const handleRegistrarVenta = async (e) => {
    e.preventDefault();
    setErrorVenta('');

    if (carrito.length === 0) {
      setErrorVenta('Debes agregar al menos un producto al carrito para registrar la venta.');
      return;
    }

    try {
      setProcesando(true);
      const payload = {
        canal: canalSeleccionado,
        medioPago: medioPagoSeleccionado,
        clienteRef: clienteRef.trim() || undefined,
        telefonoCliente: telefonoCliente.trim() || undefined,
        emailCliente: emailCliente.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        items: carrito.map(item => ({
          idProducto: item.id,
          cantidad: item.cantidad,
          precioUnitario: item.precio
        }))
      };

      const respuesta = await ventaService.registrarVenta(payload, token);
      setVentaConfirmada(respuesta.venta);
      vaciarCarrito();
      setClienteRef('');
      setTelefonoCliente('');
      setEmailCliente('');
      setObservaciones('');

      if (onVentaCompletada) {
        onVentaCompletada();
      }
    } catch (err) {
      console.error('Error al registrar venta:', err);
      setErrorVenta(err.message || 'No se pudo completar la venta. Verifique la disponibilidad del stock.');
    } finally {
      setProcesando(false);
    }
  };

  // Anular Venta
  const handleAnularVenta = async (idVenta) => {
    if (!motivoAnulacion.trim()) {
      alert('Por favor ingrese el motivo de la anulación.');
      return;
    }
    try {
      setProcesando(true);
      await ventaService.anularVenta(idVenta, motivoAnulacion.trim(), token);
      alert('Venta anulada con éxito y stock devuelto a Disponible.');
      setAnulandoId(null);
      setMotivoAnulacion('');
      setVentaSeleccionadaModal(null);
      cargarHistorial();
      if (onVentaCompletada) onVentaCompletada();
    } catch (err) {
      alert(err.message || 'Error al anular la venta.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="ventas-pos-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '10px' }}>
      {/* Header con Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#161B22',
        padding: '16px 24px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid #30363D',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>💳</span>
          <div>
            <h2 style={{ margin: 0, color: '#00D2EE', fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
              PUNTO DE VENTA MULTICANAL (POS)
            </h2>
            <small style={{ color: '#94A3B8' }}>
              Registro rápido de ventas para Ferias, TikTok Live, Redes Sociales y Web
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#0D1117', padding: '4px', borderRadius: '8px', border: '1px solid #30363D' }}>
          <button
            type="button"
            onClick={() => setTab('pos')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              background: tab === 'pos' ? '#00D2EE' : 'transparent',
              color: tab === 'pos' ? '#0D1117' : '#94A3B8',
              transition: 'all 0.2s ease'
            }}
          >
            🛒 Caja Rápida (Nueva Venta)
          </button>
          <button
            type="button"
            onClick={() => setTab('historial')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              background: tab === 'historial' ? '#00D2EE' : 'transparent',
              color: tab === 'historial' ? '#0D1117' : '#94A3B8',
              transition: 'all 0.2s ease'
            }}
          >
            📊 Historial de Ventas
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: PUNTO DE VENTA RÁPIDO (POS) */}
      {/* ============================================================== */}
      {tab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Buscador y Catálogo de Productos */}
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            
            {/* Barra de Filtros */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por Gunpla, herramienta, código..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Selector de Categoría */}
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                  background: '#F8FAFC',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="TODAS">Todas las categorías</option>
                <option value="MODEL_KITS">Model Kits / Gunpla</option>
                <option value="HERRAMIENTAS">Herramientas</option>
                <option value="ACCESORIOS">Accesorios</option>
                <option value="FIGURAS">Figuras</option>
                <option value="OTROS">Otros</option>
              </select>
            </div>

            {/* Grid de Productos Disponibles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '14px',
              maxHeight: '620px',
              overflowY: 'auto',
              paddingRight: '6px'
            }}>
              {productosFiltrados.map(prod => {
                const stock = prod.stockDisponible || 0;
                const sinStock = stock <= 0;
                const enCarrito = carrito.find(c => c.id === prod.id);

                return (
                  <div
                    key={prod.id}
                    style={{
                      border: enCarrito ? '2px solid #00D2EE' : '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: sinStock ? '#F8FAFC' : '#FFFFFF',
                      opacity: sinStock ? 0.65 : 1,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    <div>
                      {/* Imagen Thumbnail */}
                      <div style={{
                        width: '100%',
                        height: '110px',
                        background: '#F1F5F9',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px'
                      }}>
                        {prod.imagenUrl ? (
                          <img
                            src={prod.imagenUrl}
                            alt={prod.nombre}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span style={{ fontSize: '32px' }}>📦</span>
                        )}
                      </div>

                      {/* Info del Producto */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{prod.codigo}</span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: sinStock ? '#FEE2E2' : '#DCFCE7',
                          color: sinStock ? '#991B1B' : '#166534'
                        }}>
                          {sinStock ? 'Agotado/Reservado' : `Disp: ${stock}`}
                        </span>
                      </div>

                      <h4 style={{
                        margin: '0 0 6px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0F172A',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {prod.nombre}
                      </h4>

                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#D97706', marginBottom: '8px' }}>
                        S/ {Number(prod.precio).toFixed(2)}
                      </div>
                    </div>

                    {/* Botón Añadir */}
                    <button
                      type="button"
                      disabled={sinStock}
                      onClick={() => agregarAlCarrito(prod)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: sinStock ? '#CBD5E1' : (enCarrito ? '#00D2EE' : '#161B22'),
                        color: enCarrito ? '#0D1117' : '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: sinStock ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {sinStock ? 'Sin unidades' : (enCarrito ? `+ En Carrito (${enCarrito.cantidad})` : '+ Agregar')}
                    </button>
                  </div>
                );
              })}

              {productosFiltrados.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  No se encontraron productos disponibles con ese criterio de búsqueda.
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Ticket / Resumen de Venta */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
            position: 'sticky',
            top: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #F1F5F9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🧾</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Ticket de Venta
                </h3>
              </div>
              {carrito.length > 0 && (
                <button
                  type="button"
                  onClick={vaciarCarrito}
                  style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Vaciar
                </button>
              )}
            </div>

            {errorVenta && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #F87171',
                color: '#991B1B',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '12px',
                lineHeight: 1.4
              }}>
                ⚠️ {errorVenta}
              </div>
            )}

            {/* Lista de Items en Carrito */}
            <div style={{ maxHeight: '230px', overflowY: 'auto', marginBottom: '16px' }}>
              {carrito.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '6px' }}>🛒</div>
                  El carrito de venta está vacío.<br />Selecciona productos a la izquierda para agregarlos.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {carrito.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0'
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {item.nombre}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          S/ {item.precio.toFixed(2)} c/u
                        </div>
                      </div>

                      {/* Controles de Cantidad */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => quitarDelCarrito(item.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            marginLeft: '4px',
                            fontSize: '14px'
                          }}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario de Metadatos de la Venta */}
            <form onSubmit={handleRegistrarVenta}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Canal de Origen *
                  </label>
                  <select
                    value={canalSeleccionado}
                    onChange={(e) => setCanalSeleccionado(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#F8FAFC', fontWeight: 600 }}
                  >
                    {CANALES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Medio de Pago *
                  </label>
                  <select
                    value={medioPagoSeleccionado}
                    onChange={(e) => setMedioPagoSeleccionado(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#F8FAFC', fontWeight: 600 }}
                  >
                    {MEDIOS_PAGO.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Cliente / @Handle / Celular (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: @otaku_99 o Juan Pérez"
                  value={clienteRef}
                  onChange={(e) => setClienteRef(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Notas / Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Retiro en puerta o feria sábado"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Total Banner */}
              <div style={{
                background: '#0D1117',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                border: '1px solid #30363D'
              }}>
                <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600 }}>TOTAL A COBRAR:</span>
                <span style={{ color: '#00D2EE', fontSize: '20px', fontWeight: 800 }}>
                  S/ {totalCarrito.toFixed(2)}
                </span>
              </div>

              {/* Botón de Confirmación */}
              <button
                type="submit"
                disabled={procesando || carrito.length === 0}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (procesando || carrito.length === 0) ? '#94A3B8' : '#10B981',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: (procesando || carrito.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'background 0.2s ease'
                }}
              >
                {procesando ? 'Procesando Venta y Stock...' : '🟢 CONFIRMAR Y REGISTRAR VENTA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: HISTORIAL DE VENTAS MULTICANAL (AUDITORÍA & REPORTES) */}
      {/* ============================================================== */}
      {tab === 'historial' && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          
          {/* Métricas / KPIs Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>💰 Total Recaudado</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '6px' }}>
                S/ {Number(resumenHistorial.totalMontoRecaudado || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>📦 Unidades Vendidas</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#00D2EE', marginTop: '6px' }}>
                {resumenHistorial.totalUnidadesVendidas || 0} u.
              </div>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>🧾 Total Operaciones</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B', marginTop: '6px' }}>
                {historialVentas.length} transacciones
              </div>
            </div>
          </div>

          {/* Filtros del Historial */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Filtrar por:</span>
            
            <select
              value={filtroCanalHistorial}
              onChange={(e) => setFiltroCanalHistorial(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F8FAFC', fontWeight: 600 }}
            >
              <option value="TODOS">Todos los Canales</option>
              <option value="FERIA">🎪 Feria Presencial</option>
              <option value="TIKTOK">🎵 TikTok</option>
              <option value="FACEBOOK">📘 Facebook</option>
              <option value="WHATSAPP">💬 WhatsApp</option>
              <option value="WEB">🌐 Web</option>
              <option value="OTRO">📦 Otro</option>
            </select>

            <select
              value={filtroEstadoHistorial}
              onChange={(e) => setFiltroEstadoHistorial(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F8FAFC', fontWeight: 600 }}
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="COMPLETADA">Completada</option>
              <option value="ANULADA">Anulada</option>
            </select>

            <button
              type="button"
              onClick={cargarHistorial}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 Actualizar
            </button>
          </div>

          {/* Tabla de Historial */}
          {cargandoHistorial ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Cargando historial de ventas...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '12px' }}>Código</th>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>Canal</th>
                    <th style={{ padding: '12px' }}>Medio Pago</th>
                    <th style={{ padding: '12px' }}>Cliente / Ref</th>
                    <th style={{ padding: '12px' }}>Total</th>
                    <th style={{ padding: '12px' }}>Estado</th>
                    <th style={{ padding: '12px' }}>Vendedor</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialVentas.map(v => {
                    const canalObj = CANALES.find(c => c.id === v.canal);
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A' }}>{v.codigoVenta}</td>
                        <td style={{ padding: '12px', color: '#64748B' }}>{new Date(v.fechaVenta).toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#F1F5F9',
                            color: canalObj ? canalObj.color : '#475569',
                            border: `1px solid ${canalObj ? canalObj.color : '#CBD5E1'}`
                          }}>
                            {v.canal}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{v.medioPago}</td>
                        <td style={{ padding: '12px', color: '#334155' }}>{v.clienteRef || '—'}</td>
                        <td style={{ padding: '12px', fontWeight: 800, color: '#0F172A' }}>S/ {Number(v.montoTotal).toFixed(2)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: v.estado === 'COMPLETADA' ? '#DCFCE7' : '#FEE2E2',
                            color: v.estado === 'COMPLETADA' ? '#166534' : '#991B1B'
                          }}>
                            {v.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#64748B' }}>{v.vendedor ? v.vendedor.nombre : 'Staff'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setVentaSeleccionadaModal(v)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '5px',
                              border: '1px solid #00D2EE',
                              background: '#F0FDFF',
                              color: '#0891B2',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            👁️ Ver Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {historialVentas.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                        No hay ventas registradas con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: COMPROBANTE / VENTA CONFIRMADA RECIÉN CREADA */}
      {/* ============================================================== */}
      {ventaConfirmada && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ margin: 0, color: '#166534', fontSize: '20px', fontWeight: 800 }}>
                ¡Venta Registrada con Éxito!
              </h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '13px' }}>
                El stock fue descontado y asignado a esta transacción.
              </p>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Código de Venta:</span>
                <strong style={{ color: '#0F172A' }}>{ventaConfirmada.codigoVenta}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Canal de Origen:</span>
                <strong>{ventaConfirmada.canal}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Medio de Pago:</span>
                <strong>{ventaConfirmada.medioPago}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Monto Total:</span>
                <strong style={{ color: '#10B981', fontSize: '15px' }}>S/ {Number(ventaConfirmada.montoTotal).toFixed(2)}</strong>
              </div>
            </div>

            {/* Unidades Físicas Asignadas */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>
                Items y Series Asignadas:
              </h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ventaConfirmada.detalles?.map(d => (
                  <div key={d.id} style={{ background: '#F1F5F9', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {d.cantidad}x {d.producto?.nombre} (S/ {Number(d.subtotal).toFixed(2)})
                    </div>
                    {d.unidadesVendidas?.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#0891B2', marginTop: '2px' }}>
                        Series: {d.unidadesVendidas.map(u => u.codigoSerie).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setVentaConfirmada(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0D1117',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cerrar / Nueva Venta
              </button>
              <button
                type="button"
                onClick={() => {
                  setVentaConfirmada(null);
                  setTab('historial');
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Ver en Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DETALLE DE VENTA SELECCIONADA EN HISTORIAL */}
      {/* ============================================================== */}
      {ventaSeleccionadaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                Detalle de Venta {ventaSeleccionadaModal.codigoVenta}
              </h3>
              <button
                type="button"
                onClick={() => { setVentaSeleccionadaModal(null); setAnulandoId(null); }}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '16px', background: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
              <div><strong>Canal:</strong> {ventaSeleccionadaModal.canal}</div>
              <div><strong>Medio de Pago:</strong> {ventaSeleccionadaModal.medioPago}</div>
              <div><strong>Fecha:</strong> {new Date(ventaSeleccionadaModal.fechaVenta).toLocaleString()}</div>
              <div><strong>Estado:</strong> {ventaSeleccionadaModal.estado}</div>
              <div><strong>Cliente / Ref:</strong> {ventaSeleccionadaModal.clienteRef || '—'}</div>
              <div><strong>Vendedor:</strong> {ventaSeleccionadaModal.vendedor?.nombre || 'Staff'}</div>
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>Productos y Unidades Incluidas:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {ventaSeleccionadaModal.detalles?.map(d => (
                <div key={d.id} style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{d.cantidad}x {d.producto?.nombre}</span>
                    <span>S/ {Number(d.subtotal).toFixed(2)}</span>
                  </div>
                  <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>
                    Precio unitario: S/ {Number(d.precioUnitario).toFixed(2)}
                  </div>
                  {d.unidadesVendidas?.length > 0 && (
                    <div style={{ marginTop: '4px', color: '#0891B2', fontWeight: 600 }}>
                      Series de almacén: {d.unidadesVendidas.map(u => u.codigoSerie).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Opción de anular si está completada */}
            {ventaSeleccionadaModal.estado === 'COMPLETADA' && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                {anulandoId !== ventaSeleccionadaModal.id ? (
                  <button
                    type="button"
                    onClick={() => setAnulandoId(ventaSeleccionadaModal.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #EF4444',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ Anular Venta (Devolver stock a Disponible)
                  </button>
                ) : (
                  <div style={{ background: '#FEF2F2', padding: '12px', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>
                      Motivo de Anulación:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Error en medio de pago, cliente desistió..."
                      value={motivoAnulacion}
                      onChange={(e) => setMotivoAnulacion(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleAnularVenta(ventaSeleccionadaModal.id)}
                        disabled={procesando}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#DC2626',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {procesando ? 'Anulando...' : 'Confirmar Anulación'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAnulandoId(null); setMotivoAnulacion(''); }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
