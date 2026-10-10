import { useEffect, useState } from 'react';

const generarCodigoLote = () => {
  const anio = new Date().getFullYear();
  const aleatorio = Math.floor(100 + Math.random() * 900);
  return `LOT-${anio}-${aleatorio}`;
};

const initial = {
  codigoLote: '',
  proveedor: 'Bandai Namco Importaciones',
  idProducto: '',
  cantidad: '5',
  costoUnitario: '',
  observaciones: ''
};

export default function ReceptionForm({ productos, onSubmit, cargando }) {
  const [form, setForm] = useState({ ...initial, codigoLote: generarCodigoLote() });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!form.idProducto && productos.length) {
      setForm(current => ({ ...current, idProducto: String(productos[0].id) }));
    }
  }, [productos, form.idProducto]);

  const change = e => setForm({ ...form, [e.target.name]: e.target.value });

  const nuevoCodigoLote = () => {
    setForm(f => ({ ...f, codigoLote: generarCodigoLote() }));
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
        idProducto: Number(form.idProducto),
        cantidad: cant,
        costoUnitario: form.costoUnitario ? Number(form.costoUnitario) : null,
        observaciones: form.observaciones.trim() || null
      });

      setMensaje(`¡Lote ${form.codigoLote} registrado con éxito! Se crearon ${cant} unidades en inventario disponibles.`);
      setForm({
        ...initial,
        codigoLote: generarCodigoLote(),
        idProducto: form.idProducto
      });
    } catch (e) {
      setError(e.message || 'No se pudo registrar la recepción del lote.');
    }
  };

  return (
    <section className="card">
      <h2>Registrar recepción de lote de importación</h2>
      <p className="muted">
        Registra la llegada de mercadería. El sistema creará el lote y generará automáticamente cada unidad física en el inventario disponible.
      </p>

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
                title="Generar nuevo código"
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
              placeholder="Ej: Bandai Namco, Good Smile, etc."
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
            Costo unitario de adquisición (S/ - opcional)
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
            placeholder="Detalles del envío, estado de las cajas, flete aduanero, etc."
          />
        </label>

        {productos.length === 0 && (
          <p className="notice">
            Aún no hay productos en el catálogo. Registra primero un producto en la pestaña 'Gestión de productos'.
          </p>
        )}

        {error && <div className="alert err">{error}</div>}
        {mensaje && <div className="alert ok">{mensaje}</div>}

        <button className="primary" disabled={cargando || productos.length === 0}>
          {cargando ? 'Procesando recepción…' : 'Registrar recepción y generar unidades'}
        </button>
      </form>
    </section>
  );
}
