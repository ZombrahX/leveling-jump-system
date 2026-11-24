import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/reservas`;

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al procesar la reserva.');
  }
  return data;
}

export const reservaService = {
  // PTLJ-4 / HU-06: Registrar reserva individual
  async crearReserva(payload) {
    const token = localStorage.getItem('lj_auth_token');
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

  // Registrar reservas en masa atómicamente (Carrito Multi-kit sin confirmaciones parciales)
  async crearReservasEnMasa(items, clienteData) {
    const token = localStorage.getItem('lj_auth_token');
    const res = await fetch(`${API_URL}/en-masa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        items: items.map(it => ({
          idProducto: it.id,
          adelantoAsignado: Number(it.adelantoAsignado || 0)
        })),
        nombreCliente: clienteData.nombreCliente,
        telefonoCliente: clienteData.telefonoCliente,
        emailCliente: clienteData.emailCliente || null,
        notas: clienteData.notas || '',
        idUsuario: clienteData.idUsuario || null
      })
    });
    const data = await handleResponse(res);
    return data.reservas;
  },

  // Obtener reservas con filtros (Staff - requiere token de ADMIN o SUPERADMIN)
  async obtenerReservas(filtros = {}, token) {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

    const res = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // Obtener las reservas del cliente autenticado
  async obtenerMisReservas(token) {
    const res = await fetch(`${API_URL}/mis-reservas`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // Actualizar estado de reserva
  async actualizarEstado(id, nuevoEstado, token) {
    const res = await fetch(`${API_URL}/${id}/estado`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ estadoReserva: nuevoEstado })
    });
    return handleResponse(res);
  },

  // HU-09: Registrar adelanto o abono sobre saldo pendiente
  async registrarPago(idReserva, payload, token) {
    const res = await fetch(`${API_URL}/${idReserva}/pagos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // HU-09: Obtener historial de pagos de una reserva
  async obtenerHistorialPagos(idReserva, token) {
    const res = await fetch(`${API_URL}/${idReserva}/pagos`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return handleResponse(res);
  },

  // HU-10: Consultar seguimiento público de un pedido por código
  async consultarSeguimientoPublico(codigo) {
    const res = await fetch(`${API_URL}/seguimiento/${encodeURIComponent(codigo)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return handleResponse(res);
  },

  // HU-10: Actualizar modalidad y estado de entrega (Staff)
  async actualizarEntrega(idReserva, payload, token) {
    const res = await fetch(`${API_URL}/${idReserva}/entrega`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  }
};
