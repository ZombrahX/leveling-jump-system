import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/lotes`;
const API_FALLBACK = `${API_BASE_URL}/api/recepciones`;

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo procesar la solicitud de lotes.');
  }
  return data;
}

export async function registrarRecepcion(payload) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await responseData(response);
  } catch (err) {
    const responseFallback = await fetch(API_FALLBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return responseData(responseFallback);
  }
}

export async function obtenerHistorialLotes() {
  const response = await fetch(API_URL);
  return responseData(response);
}
