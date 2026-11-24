import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/productos`;

function getAuthHeaders() {
  const token = localStorage.getItem('lj_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Error al comunicarse con la API.');
  return data;
}

export async function obtenerProductos({ busqueda = '', categoria = '' } = {}) {
  const p = new URLSearchParams();
  if (busqueda.trim()) p.set('busqueda', busqueda.trim());
  if (categoria) p.set('categoria', categoria);
  const r = await fetch(p.toString() ? `${API_URL}?${p}` : API_URL);
  const d = await responseData(r);
  return d.productos || [];
}

export async function crearProducto(producto) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(producto)
  });
  return (await responseData(r)).producto;
}

export async function actualizarProducto(id, producto) {
  const r = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(producto)
  });
  return (await responseData(r)).producto;
}
