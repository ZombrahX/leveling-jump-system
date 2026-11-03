import { useEffect, useMemo, useState } from 'react';
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

const initial = {
  codigoLote: '',
  proveedor: '', // Limpio por solicitud del usuario
  documentoReferencia: '',
  fechaLlegada: getFechaHoy(),
  idProducto: '',
  cantidad: '5',
  costoUnitario: '',
  observaciones: ''
};

export default function ReceptionForm({ productos, onSubmit, cargando }) {
  const [sortField, setSortField] = useState('fechaCreacion');
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
    return <span style={{ color: 'var(--color-cyan)', fontWeight: 'bold', marginLeft: '4px' }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        return JSON.parse(saved);
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

  const cargarHistorial = async () => {
    try {
      const res = await obtenerHistorialLotes();
      if (res && res.lotes) {
        setHistorialLotes(res.lotes.slice(0, 5)); // Mostrar los 5 más recientes
      }
    } catch (e) {
      console.warn('Error al cargar historial de lotes:', e);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  // Seleccionar automáticamente el primer producto si no hay ninguno seleccionado
  useEffect(() => {
    if (!form.idProducto && productos.length) {
      setForm(current => ({ ...current, idProducto: String(productos[0].id) }));
    }
  }, [productos, form.idProducto]);

  // Guardar en localStorage cada vez que el usuario modifica el formulario
  const change = e => {
    const updated = { ...form, [e.target.name]: e.target.value };
    setForm(updated);
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('No se pudo guardar borrador:', err);
    }
  };

  const nuevoCodigoLote = () => {
    const nuevo = { ...form, codigoLote: generarCodigoLote() };
    setForm(nuevo);
    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(nuevo));
  };

  const limpiarBorrador = () => {
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setBorradorRestaurado(false);
    setForm({
      ...initial,
      codigoLote: generarCodigoLote(),
      idProducto: productos.length ? String(productos[0].id) : ''
    });
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!form.idProducto) {
      setError('Por favor selecciona el producto que se está recibiendo.');
      return;
    }

    if (!form.codigoLote.trim()) {
      setError('El código de lote es obligatorio.');
      return;
    }

    if (!form.proveedor.trim()) {
      setError('El proveedor o distribuidor es obligatorio.');
      return;
    }

    const cant = Number(form.cantidad);
    if (!cant || !Number.isInteger(cant) || cant < 1) {
      setError('La cantidad recibida es obligatoria y debe ser un número entero mayor que 0.');
      return;
    }

    try {
      await onSubmit({
        codigoLote: form.codigoLote.trim(),
        proveedor: form.proveedor.trim(),
        documentoReferencia: form.documentoReferencia.trim() || null,
        fechaLlegada: form.fechaLlegada ? `${form.fechaLlegada}T12:00:00.000Z` : new Date().toISOString(),
        idProducto: Number(form.idProducto),
        cantidad: cant,
        costoUnitario: form.costoUnitario ? Number(form.costoUnitario) : null,
        observaciones: form.observaciones.trim() || null
      });

      setMensaje(`¡Lote ${form.codigoLote} registrado con éxito! Se crearon ${cant} unidades en inventario disponibles.`);
      
      // Limpiar borrador en memoria
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      setBorradorRestaurado(false);
      setForm({
        ...initial,
        codigoLote: generarCodigoLote(),
        idProducto: form.idProducto
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
            Registra la llegada de mercadería. El sistema crea el lote, vincula el documento de referencia y genera automáticamente las unidades individuales.
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

        {/* HU-12: Documento de referencia y Fecha física de arribo */}
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

        <label>
          Producto recibido *
          <select name="idProducto" value={form.idProducto} onChange={change} required>
            <option value="">Seleccionar producto del catálogo</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre} — {p.marca}
              </option>
            ))}
          </select>
        </label>

        <div className="two">
          <label>
            Cantidad recibida (unidades físicas) *
            <input
              name="cantidad"
              type="number"
              min="1"
              step="1"
              value={form.cantidad}
              onChange={change}
              required
            />
          </label>

          <label>
            Costo unitario de adquisición (S/ - para validación de margen)
            <input
              name="costoUnitario"
              type="number"
              min="0.01"
              step="0.01"
              value={form.costoUnitario}
              onChange={change}
              placeholder="0.00"
            />
          </label>
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

        {/* P07: Advertencia cuando el costo del lote supera el precio de venta (HU-13 / CA2 / PTLJ-82) */}
        {(() => {
          const productoSeleccionado = productos.find(p => String(p.id) === String(form.idProducto));
          const precioVentaActual = productoSeleccionado ? Number(productoSeleccionado.precio || 0) : 0;
          const costoUnitarioIngresado = Number(form.costoUnitario) || 0;
          const tieneCostoSuperior = productoSeleccionado && costoUnitarioIngresado > 0 && precioVentaActual > 0 && costoUnitarioIngresado > precioVentaActual;
          const diferenciaMargenLote = precioVentaActual - costoUnitarioIngresado;

          if (!tieneCostoSuperior) return null;

          return (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #F59E0B',
              color: '#92400E',
              padding: '12px 16px',
              borderRadius: '6px',
              margin: '14px 0',
              fontSize: '13px',
              lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
                <span>⚠️</span> Advertencia de Margen Negativo en Lote
              </div>
              <p style={{ margin: '0 0 6px' }}>
                El costo unitario ingresado supera el precio de venta registrado para <strong>{productoSeleccionado.nombre}</strong>:
              </p>
              <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>
                <li><strong>Precio de Venta Actual en Catálogo:</strong> S/ {precioVentaActual.toFixed(2)}</li>
                <li><strong>Costo Unitario del Lote:</strong> S/ {costoUnitarioIngresado.toFixed(2)}</li>
                <li><strong>Margen Negativo Estimado:</strong> <strong style={{ color: '#DC2626' }}>-S/ {Math.abs(diferenciaMargenLote).toFixed(2)}</strong> por unidad</li>
              </ul>
              <small style={{ color: '#B45309', display: 'block' }}>
                ℹ️ El sistema permite registrar el lote, pero se recomienda actualizar el precio de venta en el catálogo para asegurar la rentabilidad comercial.
              </small>
            </div>
          );
        })()}

        {error && <div className="alert err">{error}</div>}
        {mensaje && <div className="alert ok">{mensaje}</div>}

        <button className="primary" disabled={cargando || productos.length === 0}>
          {cargando ? 'Procesando recepción…' : 'Registrar recepción y generar unidades'}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
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
