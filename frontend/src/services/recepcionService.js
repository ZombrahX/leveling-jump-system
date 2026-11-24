import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/lotes`;

function getAuthHeaders() {
  const token = localStorage.getItem('lj_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo procesar la solicitud de lotes.');
  }
  return data;
}

export async function registrarRecepcion(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return responseData(response);
}

export async function obtenerHistorialLotes() {
  const response = await fetch(API_URL, {
    headers: getAuthHeaders()
  });
  return responseData(response);
}
