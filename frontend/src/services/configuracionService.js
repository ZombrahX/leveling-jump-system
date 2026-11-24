import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/api/configuracion`;
const STORAGE_KEY = 'lj_store_config';

const DEFAULT_CONFIG = {
  whatsappOficial: '999999999',
  whatsappCompleto: '51999999999',
  whatsappFormateado: '+51 999 999 999'
};

export function obtenerConfigLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.whatsappCompleto) {
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch (_) {}
  return DEFAULT_CONFIG;
}

export function obtenerWhatsappTiendaDigits() {
  return obtenerConfigLocal().whatsappCompleto || '51999999999';
}

export function obtenerWhatsappTiendaFormateado() {
  return obtenerConfigLocal().whatsappFormateado || '+51 999 999 999';
}

export const configuracionService = {
  async obtener() {
    try {
      const res = await fetch(BASE_URL);
      const data = await res.json();
      if (res.ok && data.whatsappCompleto) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (_) {}
        return data;
      }
    } catch (_) {}
    return obtenerConfigLocal();
  },

  async actualizar(payload, token) {
    const res = await fetch(BASE_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo actualizar la configuración de la tienda.');
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
    return data;
  }
};
