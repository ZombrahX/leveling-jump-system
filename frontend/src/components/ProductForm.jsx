import { useEffect, useState } from 'react';

const categorias = ['MODEL_KITS', 'FIGURAS', 'ACCESORIOS', 'HERRAMIENTAS', 'OTROS'];
const escalas = ['ESCALA_1_144', 'ESCALA_1_100', 'ESCALA_1_60', 'SIN_ESCALA', 'NO_APLICA'];
const estados = ['ACTIVO', 'INACTIVO'];

const marcasComunes = [
  'Bandai',
  'Kotobukiya',
  'Good Smile Company',
  'Tamashii Nations',
  'Banpresto',
  'MegaHouse',
  'Sega',
  'FuRyu',
  'Otra'
];

const seriesComunes = [
  'Mobile Suit Gundam',
  'Zoids',
  'One Piece',
  'Dragon Ball',
  'Neon Genesis Evangelion',
  'Demon Slayer (Kimetsu no Yaiba)',
  'Jujutsu Kaisen',
  'Pokemon',
  'Otra / Ninguna'
];

export default function ProductForm({ initialData, isEditing, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialData);
  const [marcaPersonalizada, setMarcaPersonalizada] = useState('');
  const [seriePersonalizada, setSeriePersonalizada] = useState('');

  useEffect(() => {
    setForm(initialData);
    if (initialData.marca && !marcasComunes.includes(initialData.marca)) {
      setMarcaPersonalizada(initialData.marca);
    }
    if (initialData.serie && !seriesComunes.includes(initialData.serie)) {
      setSeriePersonalizada(initialData.serie);
    }
  }, [initialData]);

  const change = e => setForm({ ...form, [e.target.name]: e.target.value });

  const generarSku = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, codigo: `LJ-${random}` });
  };

  const submit = e => {
    e.preventDefault();
    const faltantes = [];

    if (!form.codigo.trim()) faltantes.push('Código SKU');
    if (!form.nombre.trim()) faltantes.push('Nombre comercial');
    
    const marcaFinal = form.marca === 'Otra' ? marcaPersonalizada.trim() : form.marca.trim();
    if (!marcaFinal) faltantes.push('Marca');

    if (!form.precio || Number(form.precio) <= 0) faltantes.push('Precio');

    if (faltantes.length) {
      alert(`Por favor completa los campos obligatorios: ${faltantes.join(', ')}.`);
      return;
    }

    const serieFinal = form.serie === 'Otra / Ninguna' 
      ? (seriePersonalizada.trim() || null) 
      : (form.serie.trim() || null);

    const imagenFinal = form.imagenUrl.trim() || 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500';

    onSubmit({
      ...form,
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      serie: serieFinal,
      marca: marcaFinal,
      precio: Number(form.precio),
      imagenUrl: imagenFinal
    });
  };

  return (
    <section className="card">
      <h2>{isEditing ? 'Editar producto' : 'Registrar producto'}</h2>
      <form onSubmit={submit}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <label style={{ flex: 1 }}>
            Código SKU *
            <input
              name="codigo"
              value={form.codigo}
              onChange={change}
              maxLength="20"
              placeholder="Ej: LJ-001045"
              disabled={isEditing}
              required
            />
          </label>
          {!isEditing && (
            <button
              type="button"
              className="secondary"
              onClick={generarSku}
              style={{ marginBottom: '8px', padding: '9px 12px', fontSize: '13px' }}
              title="Generar código correlativo de SKU"
            >
              Generar SKU
            </button>
          )}
        </div>

        <label>
          Nombre comercial *
          <input
            name="nombre"
            value={form.nombre}
            onChange={change}
            maxLength="150"
            placeholder="Ej: RG 1/144 Wing Gundam Zero EW"
            required
          />
        </label>

        <label>
          Descripción (opcional)
          <textarea
            name="descripcion"
            value={form.descripcion || ''}
            onChange={change}
            rows="2"
            placeholder="Detalles de la versión, accesorios incluidos o empaque..."
          />
        </label>

        <div className="two">
          <label>
            Categoría *
            <select name="categoria" value={form.categoria} onChange={change} required>
              {categorias.map(x => (
                <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>

          <label>
            Escala *
            <select name="escala" value={form.escala} onChange={change} required>
              {escalas.map(x => (
                <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="two">
          <label>
            Marca / Fabricante *
            <select
              name="marca"
              value={marcasComunes.includes(form.marca) ? form.marca : (form.marca ? 'Otra' : '')}
              onChange={change}
              required
            >
              <option value="">Seleccionar marca</option>
              {marcasComunes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {form.marca === 'Otra' && (
              <input
                style={{ marginTop: '6px' }}
                placeholder="Especifica el fabricante..."
                value={marcaPersonalizada}
                onChange={e => setMarcaPersonalizada(e.target.value)}
                required
              />
            )}
          </label>

          <label>
            Serie / Franquicia (opcional)
            <select
              name="serie"
              value={seriesComunes.includes(form.serie) ? form.serie : (form.serie ? 'Otra / Ninguna' : '')}
              onChange={change}
            >
              <option value="">Seleccionar serie (o ninguna)</option>
              {seriesComunes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {form.serie === 'Otra / Ninguna' && (
              <input
                style={{ marginTop: '6px' }}
                placeholder="Especifica la franquicia..."
                value={seriePersonalizada}
                onChange={e => setSeriePersonalizada(e.target.value)}
              />
            )}
          </label>
        </div>

        <div className="two">
          <label>
            Precio (S/) *
            <input
              name="precio"
              type="number"
              min="0.01"
              step="0.01"
              value={form.precio}
              onChange={change}
              placeholder="0.00"
              required
            />
          </label>

          <label>
            Estado en catálogo
            <select name="estado" value={form.estado} onChange={change}>
              {estados.map(x => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          URL de imagen (opcional)
          <input
            name="imagenUrl"
            value={form.imagenUrl || ''}
            onChange={change}
            maxLength="500"
            placeholder="https://ejemplo.com/foto.jpg"
          />
        </label>

        <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
          <button className="primary" type="submit">
            {isEditing ? 'Guardar cambios' : 'Registrar producto'}
          </button>
          {isEditing && (
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
