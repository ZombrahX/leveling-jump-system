import {useEffect,useState} from 'react';
import ProductForm from './components/ProductForm';
import ProductList from './components/ProductList';
import {obtenerProductos,crearProducto,actualizarProducto} from './services/productService';
const empty={codigo:'',nombre:'',descripcion:'',categoria:'MODEL_KITS',serie:'',escala:'NO_APLICA',marca:'',precio:'',imagenUrl:'',estado:'ACTIVO'};
export default function App(){const [productos,setProductos]=useState([]),[edit,setEdit]=useState(null),[busqueda,setBusqueda]=useState(''),[categoria,setCategoria]=useState(''),[loading,setLoading]=useState(false),[msg,setMsg]=useState(''),[error,setError]=useState('');
 const load=async()=>{try{setLoading(true);setError('');setProductos(await obtenerProductos({busqueda,categoria}));}catch(e){setError(e.message)}finally{setLoading(false)}};useEffect(()=>{load()},[busqueda,categoria]);
 const save=async data=>{try{setError('');if(edit){await actualizarProducto(edit.id,data);setMsg('Producto actualizado correctamente.')}else{await crearProducto(data);setMsg('Producto registrado correctamente.')}setEdit(null);await load()}catch(e){setError(e.message)}};
 return <main><header><small>LEVELING JUMP · SPRINT 1</small><h1>Gestión de productos</h1><p>HU-03 · Registrar, consultar y actualizar productos del catálogo.</p></header><div className="grid"><ProductForm initialData={edit||empty} isEditing={!!edit} onSubmit={save} onCancel={()=>setEdit(null)}/><ProductList productos={productos} busqueda={busqueda} categoria={categoria} onBusquedaChange={setBusqueda} onCategoriaChange={setCategoria} onEdit={setEdit} cargando={loading}/></div>{msg&&<div className="alert ok">{msg}</div>}{error&&<div className="alert err">{error}</div>}</main>}
