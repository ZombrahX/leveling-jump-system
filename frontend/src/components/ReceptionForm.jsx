import { useEffect, useState } from 'react';

const initial = { productoId: '', cantidad: '1', fechaRecepcion: new Date().toISOString().slice(0, 10), observaciones: '' };

export default function ReceptionForm({ productos, onSubmit, cargando }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!form.productoId && productos.length) {
      setForm(current => ({ ...current, productoId: String(productos[0].id) }));
    }
  }, [productos, form.productoId]);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    if (!form.productoId) {
      setError('Selecciona el producto que se está recibiendo.');
      return;
    }
    if (!form.cantidad || !Number.isInteger(Number(form.cantidad)) || Number(form.cantidad) < 1) {
      setError('La cantidad es obligatoria y debe ser un número entero mayor que cero.');
      return;
    }
    if (!form.fechaRecepcion) {
      setError('La fecha de recepción es obligatoria.');
      return;
    }
    try {
      await onSubmit({
        productoId: Number(form.productoId),
        cantidad: Number(form.cantidad),
        fechaRecepcion: form.fechaRecepcion,
        observaciones: form.observaciones.trim() || null,
      });
      setMensaje('Solicitud de recepción enviada. Confirma el registro con la API del backend.');
      setForm({ ...initial, fechaRecepcion: new Date().toISOString().slice(0, 10), productoId: form.productoId });
    } catch (e) {
      setError(e.message || 'No se pudo registrar la recepción.');
    }
  };

  return (
    <section className="card">
      <div className="section-kicker">HU04 · HU04-T07 / HU04-T08</div>
      <h2>Registrar recepción de lote</h2>
      <p className="muted">Registra la llegada de productos para que el backend procese la recepción y genere las unidades de inventario.</p>
      <form onSubmit={submit}>
        <label>Producto recibido *
          <select name="productoId" value={form.productoId} onChange={change} required>
            <option value="">Seleccionar producto</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} — ` : ''}{p.nombre}</option>)}
          </select>
        </label>
        <div className="two">
          <label>Cantidad recibida *
            <input name="cantidad" type="number" min="1" step="1" value={form.cantidad} onChange={change} required />
          </label>
          <label>Fecha de recepción *
            <input name="fechaRecepcion" type="date" value={form.fechaRecepcion} onChange={change} required />
          </label>
        </div>
        <label>Observaciones (opcional)
          <textarea name="observaciones" value={form.observaciones} onChange={change} rows="3" placeholder="Referencia del lote o comentario adicional" />
        </label>
        {productos.length === 0 && <p className="notice">No hay productos cargados. Verifica que el backend esté disponible y que existan productos registrados.</p>}
        {error && <div className="alert err">{error}</div>}
        {mensaje && <div className="alert ok">{mensaje}</div>}
        <button className="primary" disabled={cargando || productos.length === 0}>{cargando ? 'Enviando…' : 'Registrar recepción'}</button>
      </form>
      <p className="small-note">Nota técnica: el endpoint y el formato del payload son provisionales hasta que Adriano confirme el contrato de la API.</p>
    </section>
  );
}
