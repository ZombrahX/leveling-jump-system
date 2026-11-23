import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/cotizaciones`;

const handleResponse = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.mensaje || 'Error en la solicitud al servidor.');
  }
  return data;
};

export const cotizacionService = {
  // Generar y registrar cotización formal
  async crearCotizacion(payload) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Obtener las cotizaciones propias del cliente autenticado
  async obtenerMisCotizaciones(token) {
    const res = await fetch(`${API_URL}/mis-cotizaciones`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // Consultar cotización por código correlativo (requiere sesión)
  async obtenerPorCodigo(codigo, token) {
    const res = await fetch(`${API_URL}/${encodeURIComponent(codigo)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // Listar todas las cotizaciones para staff
  async listar(token) {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  }
};
