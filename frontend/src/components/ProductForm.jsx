import {useEffect,useState} from 'react';
const categorias=['MODEL_KITS','FIGURAS','ACCESORIOS','HERRAMIENTAS','OTROS'];
const escalas=['ESCALA_1_144','ESCALA_1_100','ESCALA_1_60','SIN_ESCALA','NO_APLICA'];
const estados=['ACTIVO','INACTIVO'];
export default function ProductForm({initialData,isEditing,onSubmit,onCancel}){
 const [form,setForm]=useState(initialData); useEffect(()=>setForm(initialData),[initialData]);
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 const submit=e=>{e.preventDefault();const f=[];if(!form.codigo.trim())f.push('código SKU');if(!form.nombre.trim())f.push('nombre');if(!form.categoria)f.push('categoría');if(!form.escala)f.push('escala');if(!form.marca.trim())f.push('marca');if(!form.precio||Number(form.precio)<=0)f.push('precio');if(!form.imagenUrl.trim())f.push('imagen');if(f.length){alert(`Completa los campos: ${f.join(', ')}.`);return;}onSubmit({...form,codigo:form.codigo.trim(),nombre:form.nombre.trim(),descripcion:form.descripcion.trim(),serie:form.serie.trim()||null,marca:form.marca.trim(),precio:Number(form.precio),imagenUrl:form.imagenUrl.trim()});};
 return <section className="card"><h2>{isEditing?'Editar producto':'Registrar producto'}</h2><form onSubmit={submit}>
 <label>SKU *<input name="codigo" value={form.codigo} onChange={change} maxLength="20" placeholder="LJ-000001"/></label>
 <label>Nombre *<input name="nombre" value={form.nombre} onChange={change} maxLength="150"/></label>
 <label>Descripción<textarea name="descripcion" value={form.descripcion} onChange={change}/></label>
 <div className="two"><label>Categoría *<select name="categoria" value={form.categoria} onChange={change}>{categorias.map(x=><option key={x}>{x}</option>)}</select></label><label>Escala *<select name="escala" value={form.escala} onChange={change}>{escalas.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <div className="two"><label>Serie / franquicia<input name="serie" value={form.serie} onChange={change}/></label><label>Marca *<input name="marca" value={form.marca} onChange={change}/></label></div>
 <div className="two"><label>Precio (S/) *<input name="precio" type="number" min="0.01" step="0.01" value={form.precio} onChange={change}/></label><label>Estado<select name="estado" value={form.estado} onChange={change}>{estados.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <label>URL de imagen *<input name="imagenUrl" value={form.imagenUrl} onChange={change} maxLength="500"/></label>
 <div><button className="primary">{isEditing?'Guardar cambios':'Registrar producto'}</button>{isEditing&&<button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}</div>
 </form></section>;
}
