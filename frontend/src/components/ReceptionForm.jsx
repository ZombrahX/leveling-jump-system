import { useEffect, useState } from 'react';
import { obtenerHistorialLotes } from '../services/recepcionService';

const STORAGE_DRAFT_KEY = 'lj_reception_draft';

const generarCodigoLote = () => {
  const anio = new Date().getFullYear();
  const aleatorio = Math.floor(100 + Math.random() * 900);
  return `LOT-${anio}-${aleatorio}`;
};

const getFechaHoy = () => new Date().toISOString().split('T')[0];

// P04: Formatear fecha física de llegada sin desfase de zona horaria UTC
const formatearFechaLlegada = (fechaStr) => {
  if (!fechaStr) return '—';
  if (typeof fechaStr === 'string') {
    const parte = fechaStr.split('T')[0];
    const segs = parte.split('-');
    if (segs.length === 3) {
      const [anio, mes, dia] = segs;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${anio}`;
    }
  }
  const d = new Date(fechaStr);
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const crearItemVacio = (defaultProdId = '') => ({
  idProducto: defaultProdId ? String(defaultProdId) : '',
  cantidad: '5',
  costoUnitario: ''
});

const initial = {
  codigoLote: '',
  proveedor: '',
  documentoReferencia: '',
  fechaLlegada: getFechaHoy(),
  observaciones: '',
  items: [crearItemVacio()]
};

const normalizarBorrador = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    return { ...initial, codigoLote: generarCodigoLote() };
  }
  // Migrar borradores antiguos de 1 solo producto al formato de arreglo items[]
  let items = [];
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    items = parsed.items.map(it => ({
      idProducto: it.idProducto ? String(it.idProducto) : '',
      cantidad: it.cantidad !== undefined ? String(it.cantidad) : '5',
      costoUnitario: it.costoUnitario !== undefined ? String(it.costoUnitario) : ''
    }));
  } else {
    items = [
      {
        idProducto: parsed.idProducto ? String(parsed.idProducto) : '',
        cantidad: parsed.cantidad !== undefined ? String(parsed.cantidad) : '5',
        costoUnitario: parsed.costoUnitario !== undefined ? String(parsed.costoUnitario) : ''
      }
    ];
  }

  return {
    codigoLote: parsed.codigoLote || generarCodigoLote(),
    proveedor: parsed.proveedor || '',
    documentoReferencia: parsed.documentoReferencia || '',
    fechaLlegada: parsed.fechaLlegada || getFechaHoy(),
    observaciones: parsed.observaciones || '',
    items
  };
};

export default function ReceptionForm({ productos, onSubmit, cargando }) {
  const [sortField, setSortField] = useState('fechaCreacion');
  const [sortOrder, setSortOrder] = useState('desc');

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
    return <span style={{ color: 'var(--color-cyan)', fontWeight: 'bold', marginLeft: '4px' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        return normalizarBorrador(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('No se pudo leer borrador guardado:', e);
    }
    return { ...initial, codigoLote: generarCodigoLote() };
  });

  const [borradorRestaurado, setBorradorRestaurado] = useState(() => {
    return !!localStorage.getItem(STORAGE_DRAFT_KEY);
  });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [historialLotes, setHistorialLotes] = useState([]);

  const guardarBorrador = (nextForm) => {
    setForm(nextForm);
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(nextForm));
    } catch (err) {
      console.warn('No se pudo guardar borrador:', err);
    }
  };

  const cargarHistorial = async () => {
    try {
      const res = await obtenerHistorialLotes();
      if (res && res.lotes) {
        setHistorialLotes(res.lotes.slice(0, 5));
      }
    } catch (e) {
      console.warn('Error al cargar historial de lotes:', e);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  // Seleccionar automáticamente el primer producto en la primera fila si está vacía
  useEffect(() => {
    if (productos.length > 0 && form.items.length > 0 && !form.items[0].idProducto) {
      const nuevosItems = form.items.map((it, idx) =>
        idx === 0 && !it.idProducto ? { ...it, idProducto: String(productos[0].id) } : it
      );
      setForm(current => ({ ...current, items: nuevosItems }));
    }
  }, [productos, form.items]);

  const change = e => {
    const updated = { ...form, [e.target.name]: e.target.value };
    guardarBorrador(updated);
  };

  const handleItemChange = (index, field, value) => {
    const nuevosItems = form.items.map((it, idx) =>
      idx === index ? { ...it, [field]: value } : it
    );
    guardarBorrador({ ...form, items: nuevosItems });
  };

  const handleAgregarFilaProducto = () => {
    // Sugerir un producto que aún no esté seleccionado en las filas actuales, o el primero disponible
    const usados = new Set(form.items.map(it => String(it.idProducto)));
    const siguienteProd = productos.find(p => !usados.has(String(p.id))) || productos[0];
    const nuevoItem = crearItemVacio(siguienteProd ? siguienteProd.id : '');
    guardarBorrador({
      ...form,
      items: [...form.items, nuevoItem]
    });
  };

  const handleQuitarFilaProducto = (index) => {
    if (form.items.length <= 1) return;
    const nuevosItems = form.items.filter((_, idx) => idx !== index);
    guardarBorrador({
      ...form,
      items: nuevosItems
    });
  };

  const nuevoCodigoLote = () => {
    const nuevo = { ...form, codigoLote: generarCodigoLote() };
    guardarBorrador(nuevo);
  };

  const limpiarBorrador = () => {
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setBorradorRestaurado(false);
    const defaultProd = productos.length ? String(productos[0].id) : '';
    setForm({
      ...initial,
      codigoLote: generarCodigoLote(),
      items: [crearItemVacio(defaultProd)]
    });
  };

  const totalUnidadesLote = form.items.reduce((acc, it) => {
    const n = Number(it.cantidad);
    return acc + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!form.codigoLote.trim()) {
      setError('El código de lote es obligatorio.');
      return;
    }

    if (!form.proveedor.trim()) {
      setError('El proveedor o distribuidor es obligatorio.');
      return;
    }

    if (!form.items || form.items.length === 0) {
      setError('Debes agregar al menos un producto al lote.');
      return;
    }

    const itemsPayload = [];
    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.idProducto) {
        setError(`Por favor selecciona el producto en la fila #${i + 1}.`);
        return;
      }

      const cant = Number(it.cantidad);
      if (!cant || !Number.isInteger(cant) || cant < 1) {
        setError(`La cantidad recibida en la fila #${i + 1} debe ser un número entero mayor que 0.`);
        return;
      }

      itemsPayload.push({
        idProducto: Number(it.idProducto),
        cantidad: cant,
        costoUnitario: it.costoUnitario !== '' && it.costoUnitario !== null ? Number(it.costoUnitario) : null
      });
    }

    try {
      const primerItem = itemsPayload[0];
      await onSubmit({
        codigoLote: form.codigoLote.trim(),
        proveedor: form.proveedor.trim(),
        documentoReferencia: form.documentoReferencia.trim() || null,
        fechaLlegada: form.fechaLlegada ? `${form.fechaLlegada}T12:00:00.000Z` : new Date().toISOString(),
        observaciones: form.observaciones.trim() || null,
        // Compatibilidad con controladores de 1 producto y nuevo soporte multi-producto
        idProducto: primerItem.idProducto,
        cantidad: primerItem.cantidad,
        costoUnitario: primerItem.costoUnitario,
        items: itemsPayload
      });

      const totalUnids = itemsPayload.reduce((acc, cur) => acc + cur.cantidad, 0);
      setMensaje(
        `¡Lote ${form.codigoLote} registrado con éxito! Se ingresaron ${itemsPayload.length} producto(s) y se generaron ${totalUnids} unidades físicas disponibles en inventario.`
      );

      localStorage.removeItem(STORAGE_DRAFT_KEY);
      setBorradorRestaurado(false);
      const defaultProd = productos.length ? String(productos[0].id) : '';
      setForm({
        ...initial,
        codigoLote: generarCodigoLote(),
        items: [crearItemVacio(defaultProd)]
      });

      await cargarHistorial();
    } catch (e) {
      setError(e.message || 'No se pudo registrar la recepción del lote.');
    }
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>Registrar recepción de lote de importación</h2>
          <p className="muted">
            Registra la llegada de mercadería. Puedes incluir uno o varios productos distintos dentro del mismo embarque o factura.
          </p>
        </div>
        {borradorRestaurado && (
          <div className="draft-restored-tag">
            <span>💾 Borrador recuperado</span>
            <button
              type="button"
              onClick={limpiarBorrador}
              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '11.5px' }}
            >
              Descartar
            </button>
          </div>
        )}
      </div>

      <form onSubmit={submit}>
        <div className="two">
          <label>
            Código de lote *
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                name="codigoLote"
                value={form.codigoLote}
                onChange={change}
                placeholder="Ej: LOT-2026-001"
                required
              />
              <button
                type="button"
                className="secondary"
                onClick={nuevoCodigoLote}
                style={{ padding: '8px 10px', fontSize: '12px' }}
                title="Generar nuevo código correlativo"
              >
                Nuevo
              </button>
            </div>
          </label>

          <label>
            Proveedor / Distribuidor *
            <input
              name="proveedor"
              value={form.proveedor}
              onChange={change}
              placeholder="Ej: Bandai Spirits, Good Smile Company, etc."
              required
            />
          </label>
        </div>

        {/* Documento de referencia y Fecha física de arribo */}
        <div className="two">
          <label>
            Doc. de Referencia (Factura / Boleta / Guía)
            <input
              name="documentoReferencia"
              value={form.documentoReferencia}
              onChange={change}
              placeholder="Ej: F001-0004921 / GR-023-991"
            />
          </label>

          <label>
            Fecha de Arribo Físico de Mercadería *
            <input
              type="date"
              name="fechaLlegada"
              value={form.fechaLlegada}
              onChange={change}
              required
            />
          </label>
        </div>

        {/* SECCIÓN DINÁMICA: PRODUCTOS INCLUIDOS EN EL LOTE */}
        <div style={{ marginTop: '6px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-main)' }}>
                Productos recibidos en este lote ({form.items.length}) *
              </span>
              <span style={{
                fontSize: '11.5px',
                background: '#0D1117',
                color: 'var(--color-cyan)',
                padding: '3px 10px',
                borderRadius: '12px',
                fontWeight: 700
              }}>
                Total a generar: {totalUnidadesLote} {totalUnidadesLote === 1 ? 'unidad física' : 'unidades físicas'}
              </span>
            </div>

            <button
              type="button"
              className="secondary"
              onClick={handleAgregarFilaProducto}
              disabled={productos.length === 0}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--color-cyan)',
                color: '#0F172A'
              }}
            >
              ➕ Agregar otro producto al lote
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {form.items.map((item, idx) => {
              const productoSeleccionado = productos.find(p => String(p.id) === String(item.idProducto));
              const precioVentaActual = productoSeleccionado ? Number(productoSeleccionado.precio || 0) : 0;
              const costoUnitarioIngresado = Number(item.costoUnitario) || 0;
              const tieneCostoSuperior =
                productoSeleccionado &&
                costoUnitarioIngresado > 0 &&
                precioVentaActual > 0 &&
                costoUnitarioIngresado > precioVentaActual;
              const diferenciaMargenLote = precioVentaActual - costoUnitarioIngresado;

              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--color-border-strong, #CBD5E1)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    background: '#F8FAFC'
                  }}
                >
                  {form.items.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #E2E8F0' }}>
                      <strong style={{ fontSize: '12px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📦 Producto #{idx + 1} del Lote
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleQuitarFilaProducto(idx)}
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #FCA5A5',
                          color: '#DC2626',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Quitar este producto del lote"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  )}

                  <label style={{ marginBottom: '10px' }}>
                    Producto recibido *
                    <select
                      value={item.idProducto}
                      onChange={e => handleItemChange(idx, 'idProducto', e.target.value)}
                      required
                    >
                      <option value="">Seleccionar producto del catálogo</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre} — {p.marca} (Precio venta: S/ {Number(p.precio || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="two" style={{ marginBottom: 0 }}>
                    <label style={{ marginBottom: 0 }}>
                      Cantidad recibida (unidades físicas) *
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.cantidad}
                        onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                        required
                      />
                    </label>

                    <label style={{ marginBottom: 0 }}>
                      Costo unitario de adquisición (S/ - para validación de margen)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.costoUnitario}
                        onChange={e => handleItemChange(idx, 'costoUnitario', e.target.value)}
                        placeholder="0.00"
                      />
                    </label>
                  </div>

                  {/* Advertencia cuando el costo unitario supera el precio de venta de este producto */}
                  {tieneCostoSuperior && (
                    <div style={{
                      background: '#FFFBEB',
                      border: '1px solid #F59E0B',
                      color: '#92400E',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      marginTop: '12px',
                      fontSize: '12.5px',
                      lineHeight: 1.45
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
                        <span>⚠️</span> Advertencia de Margen Negativo en {productoSeleccionado.nombre}
                      </div>
                      <div>
                        Precio Venta Actual: <strong>S/ {precioVentaActual.toFixed(2)}</strong> · Costo Lote: <strong>S/ {costoUnitarioIngresado.toFixed(2)}</strong> · Margen Estimado: <strong style={{ color: '#DC2626' }}>-S/ {Math.abs(diferenciaMargenLote).toFixed(2)}</strong> por unidad.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {form.items.length > 1 && (
            <div style={{ marginTop: '10px', textAlign: 'right' }}>
              <button
                type="button"
                className="secondary"
                onClick={handleAgregarFilaProducto}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
              >
                ➕ Agregar otro producto más
              </button>
            </div>
          )}
        </div>

        <label>
          Observaciones del lote (opcional)
          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={change}
            rows="2"
            placeholder="Detalles del empaque, flete de aduanas, condiciones de las cajas..."
          />
        </label>

        {productos.length === 0 && (
          <p className="notice">
            Aún no hay productos en el catálogo. Registra primero un producto en 'Gestión de Productos' (el borrador de este lote se conservará automáticamente).
          </p>
        )}

        {error && <div className="alert err">{error}</div>}
        {mensaje && <div className="alert ok">{mensaje}</div>}

        <button className="primary" disabled={cargando || productos.length === 0}>
          {cargando ? 'Procesando recepción…' : `Registrar recepción y generar ${totalUnidadesLote} unidades`}
        </button>
      </form>

      {/* Historial reciente de lotes */}
      {historialLotes.length > 0 && (() => {
        const lotesOrdenados = [...historialLotes].sort((a, b) => {
          let valA = a[sortField];
          let valB = b[sortField];

          if (sortField === 'totalUnidades') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
          } else if (sortField === 'fechaLlegada' || sortField === 'fechaCreacion') {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
          } else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = (valB || '').toLowerCase();
          }

          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });

        return (
          <div style={{ marginTop: '28px', borderTop: '1px solid #30363D', paddingTop: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', color: 'var(--color-cyan)', margin: 0 }}>
                📋 Últimos Lotes Recibidos en Inventario
              </h3>
              <span style={{ fontSize: '12px', color: '#8B949E' }}>
                Ordenado por <b>{sortField === 'fechaCreacion' ? 'Fecha de Registro' : sortField === 'fechaLlegada' ? 'Fecha de Arribo' : sortField === 'codigoLote' ? 'Código de Lote' : sortField}</b> ({sortOrder === 'asc' ? 'más antiguos primero ▲' : 'más recientes primero ▼'})
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363D', color: '#8B949E' }}>
                    <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('codigoLote')} title="Ordenar por Código de Lote">
                      Lote {getSortIcon('codigoLote')}
                    </th>
                    <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('proveedor')} title="Ordenar por Proveedor">
                      Proveedor {getSortIcon('proveedor')}
                    </th>
                    <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('documentoReferencia')} title="Ordenar por Doc. Referencia">
                      Doc. Referencia {getSortIcon('documentoReferencia')}
                    </th>
                    <th style={{ padding: '8px 6px' }}>
                      Productos Recibidos
                    </th>
                    <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('fechaLlegada')} title="Ordenar por Llegada Física">
                      Llegada Física {getSortIcon('fechaLlegada')}
                    </th>
                    <th style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('fechaCreacion')} title="Ordenar por Registro Sistema">
                      Registro Sistema {getSortIcon('fechaCreacion')}
                    </th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('totalUnidades')} title="Ordenar por Cantidad de Unidades">
                      Unidades {getSortIcon('totalUnidades')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lotesOrdenados.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #21262D' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 'bold', color: 'var(--color-cyan)' }}>{l.codigoLote}</td>
                      <td style={{ padding: '8px 6px' }}>{l.proveedor}</td>
                      <td style={{ padding: '8px 6px', color: '#9CA3AF' }}>{l.documentoReferencia || '—'}</td>
                      <td style={{ padding: '8px 6px', fontSize: '12px' }}>
                        {Array.isArray(l.productosResumen) && l.productosResumen.length > 0
                          ? l.productosResumen.map(pr => `${pr.nombre} (${pr.cantidad})`).join(', ')
                          : '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {formatearFechaLlegada(l.fechaLlegada)}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#6E7681' }}>
                        {new Date(l.fechaCreacion).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>{l.totalUnidades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
