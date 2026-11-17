import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/intereses`;

const handleResponse = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.mensaje || 'Error en la solicitud al servidor.');
  }
  return data;
};

export const interesService = {
  // Anotarse en lista de espera / notificar reposición
  async registrarInteres(payload) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Consultar resumen de demanda para Staff
  async listarResumen(token) {
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // Actualizar estado de notificación al cliente
  async actualizarEstado(idInteres, estado, token) {
    const res = await fetch(`${API_URL}/${idInteres}/estado`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ estado })
    });
    return handleResponse(res);
  }
};
