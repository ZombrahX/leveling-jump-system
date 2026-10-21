import { useEffect, useMemo, useState } from 'react';
import { obtenerHistorialLotes } from '../services/recepcionService';

const STORAGE_DRAFT_KEY = 'lj_reception_draft';

const generarCodigoLote = () => {
  const anio = new Date().getFullYear();
  const aleatorio = Math.floor(100 + Math.random() * 900);
  return `LOT-${anio}-${aleatorio}`;
};

const getFechaHoy = () => new Date().toISOString().split('T')[0];

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
        fechaLlegada: form.fechaLlegada ? new Date(form.fechaLlegada) : new Date(),
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
                Ordenado por <b>{sortField.toUpperCase()}</b> ({sortOrder === 'asc' ? 'Ascendente ▲' : 'Descendente ▼'})
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
                        {l.fechaLlegada ? new Date(l.fechaLlegada).toLocaleDateString('es-PE') : '—'}
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
