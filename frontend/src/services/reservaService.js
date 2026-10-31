const API_URL = 'http://localhost:4000/api/reservas';

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
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Registrar reservas en masa (Bolsa de Reserva / Carrito Multi-kit)
  async crearReservasEnMasa(items, clienteData) {
    const reservasCreadas = [];
    for (const item of items) {
      const res = await this.crearReserva({
        idProducto: item.id,
        nombreCliente: clienteData.nombreCliente,
        telefonoCliente: clienteData.telefonoCliente,
        emailCliente: clienteData.emailCliente || null,
        montoTotal: Number(item.precio),
        montoAdelanto: Number(item.adelantoAsignado),
        notas: clienteData.notas || '',
        idUsuario: clienteData.idUsuario || null
      });
      reservasCreadas.push(res.reserva);
    }
    return reservasCreadas;
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
  }
};
