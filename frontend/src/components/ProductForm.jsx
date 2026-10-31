import { useEffect, useState } from 'react';
import { reservaPoliticaService, MODOS_POLITICA } from '../services/reservaPoliticaService';

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
  const [politicaReserva, setPoliticaReserva] = useState(MODOS_POLITICA.ESTANDAR);

  useEffect(() => {
    setForm(initialData);
    if (initialData.marca && !marcasComunes.includes(initialData.marca)) {
      setMarcaPersonalizada(initialData.marca);
    }
    if (initialData.serie && !seriesComunes.includes(initialData.serie)) {
      setSeriePersonalizada(initialData.serie);
    }
    if (initialData.id) {
      const pol = reservaPoliticaService.obtenerPoliticaProducto(initialData.id);
      setPoliticaReserva(pol.modo || MODOS_POLITICA.ESTANDAR);
    } else {
      const global = reservaPoliticaService.obtenerPoliticaGlobal();
      setPoliticaReserva(global.modo || MODOS_POLITICA.ESTANDAR);
    }
  }, [initialData]);

  const change = e => setForm({ ...form, [e.target.name]: e.target.value });

  const generarSku = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, codigo: `LJ-${random}` });
  };

  const costoRef = Number(form.costoReferencia || initialData.costoReferencia || 0);
  const precioNum = Number(form.precio) || 0;
  const esMargenNegativo = costoRef > 0 && precioNum > 0 && precioNum < costoRef;
  const diferenciaMargen = costoRef - precioNum;

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

    // P06: Bloquear guardado si el precio de venta es menor al costo de adquisición (HU-13 / CA1)
    if (esMargenNegativo) {
      alert(`⚠️ Acción Bloqueada (HU-13 / CA1):\nEl precio de venta (S/ ${precioNum.toFixed(2)}) no puede ser inferior al costo de adquisición registrado (S/ ${costoRef.toFixed(2)}).\nMargen negativo: -S/ ${diferenciaMargen.toFixed(2)} por unidad.\n\nPor política comercial, debes asignar un precio igual o superior al costo.`);
      return;
    }

    const serieFinal = form.serie === 'Otra / Ninguna' 
      ? (seriePersonalizada?.trim() || null) 
      : (form.serie?.trim() || null);

    const imagenFinal = form.imagenUrl?.trim() || 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500';

    onSubmit({
      ...form,
      codigo: form.codigo?.trim() || '',
      nombre: form.nombre?.trim() || '',
      descripcion: form.descripcion?.trim() || null,
      serie: serieFinal,
      marca: marcaFinal,
      precio: Number(form.precio),
      imagenUrl: imagenFinal,
      estado: form.estado || 'ACTIVO',
      politicaReserva
    });
  };

  const mostrarMarcaCustom = form.marca === 'Otra';
  const mostrarSerieCustom = form.serie === 'Otra / Ninguna';

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
          </label>
        </div>

        {/* Fila dedicada y alineada cuando el usuario elige 'Otra' */}
        {(mostrarMarcaCustom || mostrarSerieCustom) && (
          <div className="two" style={{ marginTop: '-4px', marginBottom: '4px' }}>
            <div>
              {mostrarMarcaCustom ? (
                <label>
                  Especificar fabricante *
                  <input
                    placeholder="Ej: Volks, Sentinel, etc."
                    value={marcaPersonalizada}
                    onChange={e => setMarcaPersonalizada(e.target.value)}
                    required
                  />
                </label>
              ) : <div style={{ height: 0 }} />}
            </div>

            <div>
              {mostrarSerieCustom ? (
                <label>
                  Especificar franquicia
                  <input
                    placeholder="Ej: Macross, Fate, etc."
                    value={seriePersonalizada}
                    onChange={e => setSeriePersonalizada(e.target.value)}
                  />
                </label>
              ) : <div style={{ height: 0 }} />}
            </div>
          </div>
        )}

        <div className="two">
          <label>
            Precio de venta al público (S/) *
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
          Condición de Reserva Comercial *
          <select
            name="politicaReserva"
            value={politicaReserva}
            onChange={e => setPoliticaReserva(e.target.value)}
          >
            <option value={MODOS_POLITICA.ESTANDAR}>
              Caso 1: Flexible / Estándar (3 tramos: Mínimo configurable, Intermedio y Total)
            </option>
            <option value={MODOS_POLITICA.CINCUENTA_TOTAL}>
              Caso 2: Económico (2 tramos: Mínimo 50% y Total 100%)
            </option>
            <option value={MODOS_POLITICA.PAGO_TOTAL}>
              Caso 3: Exclusivo / Especial (1 tramo: Solo 100% Pago Total)
            </option>
          </select>
        </label>

        {/* P05 & P06: Alerta de precio menor al costo con desglose explícito (CA1 - HU-13) */}
        {esMargenNegativo && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: '14px 18px',
            borderRadius: '8px',
            margin: '14px 0',
            lineHeight: 1.5,
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px', color: '#B91C1C', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span>Alerta de Margen Negativo (HU-13 / CA1 — Guardado Bloqueado)</span>
            </div>
            <p style={{ margin: '0 0 8px', color: '#7F1D1D' }}>
              El precio de venta ingresado genera pérdida comercial respecto al costo unitario de adquisición:
            </p>
            <ul style={{ margin: '0 0 10px', paddingLeft: '22px' }}>
              <li><strong>Precio de Venta Ingresado:</strong> S/ {precioNum.toFixed(2)}</li>
              <li><strong>Costo Unitario de Adquisición (Lote):</strong> S/ {costoRef.toFixed(2)}</li>
              <li><strong>Margen Negativo Estimado:</strong> <strong style={{ color: '#DC2626' }}>-S/ {diferenciaMargen.toFixed(2)}</strong> por unidad</li>
            </ul>
            <div style={{ fontSize: '12px', color: '#991B1B', background: '#FEE2E2', padding: '6px 10px', borderRadius: '4px', border: '1px solid #FECACA' }}>
              🚫 <strong>Restricción del Sistema:</strong> No es posible guardar este producto mientras el precio de venta sea inferior al costo de adquisición.
            </div>
          </div>
        )}

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
          <button
            className="primary"
            type="submit"
            disabled={esMargenNegativo}
            style={{
              opacity: esMargenNegativo ? 0.5 : 1,
              cursor: esMargenNegativo ? 'not-allowed' : 'pointer'
            }}
            title={esMargenNegativo ? 'No se puede guardar: el precio es menor al costo de adquisición' : ''}
          >
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
