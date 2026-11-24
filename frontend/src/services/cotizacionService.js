import { API_BASE_URL } from './apiConfig';

const BASE_URL = `${API_BASE_URL}/api/cotizaciones`;

export const cotizacionService = {
  /**
   * HU-07: Crear una nueva cotización formal (válida por 7 días)
   */
  async crearCotizacion(datos) {
    const token = localStorage.getItem('lj_auth_token');
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(datos)
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Error al generar la cotización.');
      err.data = data;
      throw err;
    }
    return data;
  },

  /**
   * Obtener todas las cotizaciones asociadas al usuario autenticado
   */
  async obtenerMisCotizaciones(token, codigosLocales = []) {
    const query = codigosLocales.length > 0 ? `?codigos=${encodeURIComponent(codigosLocales.join(','))}` : '';
    const res = await fetch(`${BASE_URL}/mis-cotizaciones${query}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener tus cotizaciones.');
    }
    return data;
  },

  /**
   * HU-07: Consultar cotización por su código correlativo (COT-2026-XXXX)
   */
  async obtenerPorCodigo(codigo, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(codigo)}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se encontró la cotización solicitada.');
    }
    return data;
  },

  /**
   * HU-07: Listar todas las cotizaciones (Staff)
   */
  async listar(token) {
    const res = await fetch(BASE_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener listado de cotizaciones.');
    }
    return data;
  },

  /**
   * HU-07 Escenario 1 y 3: Confirmar o recalcular cotización con el stock disponible actual
   */
  async confirmarORecalcular(id, accion = 'confirmar', token) {
    const res = await fetch(`${BASE_URL}/${id}/confirmar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ accion })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al procesar la cotización.');
    }
    return data;
  },

  /**
   * HU-07 Escenario 3: Eliminar una cotización
   */
  async eliminar(id, token) {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al eliminar la cotización.');
    }
    return data;
  }
};
