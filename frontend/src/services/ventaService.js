import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/ventas`;

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al procesar la operación de venta.');
  }
  return data;
}

export const ventaService = {
  /**
   * HU-05: Registrar una venta multicanal
   * @param {Object} payload { canal, medioPago, clienteRef, telefonoCliente, emailCliente, observaciones, items: [{ idProducto, cantidad, precioUnitario }] }
   * @param {string} token JWT del staff
   */
  async registrarVenta(payload, token) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  /**
   * HU-05: Consultar el historial de ventas
   * @param {Object} filtros { canal, estado, fechaInicio, fechaFin }
   * @param {string} token JWT del staff
   */
  async obtenerVentas(filtros = {}, token) {
    const params = new URLSearchParams();
    if (filtros.canal && filtros.canal !== 'TODOS') params.append('canal', filtros.canal);
    if (filtros.estado && filtros.estado !== 'TODOS') params.append('estado', filtros.estado);
    if (filtros.fechaInicio) params.append('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params.append('fechaFin', filtros.fechaFin);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}${queryStr}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  /**
   * Obtener detalle de una venta por ID
   */
  async obtenerVentaPorId(id, token) {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  /**
   * Anular una venta y revertir stock
   */
  async anularVenta(id, motivo, token) {
    const res = await fetch(`${API_URL}/${id}/anular`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ motivo })
    });
    return handleResponse(res);
  }
};
