import { API_BASE_URL } from './apiConfig';

const API_BASE = `${API_BASE_URL}/api/auth`;

const TOKEN_KEY = 'lj_auth_token';
const USER_KEY = 'lj_auth_user';

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || data.mensaje || 'Error en la solicitud de autenticación.');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const authService = {
  // PTLJ-43 / HU-11: Registro con código OTP al correo
  async registro(nombre, email, password, telefono) {
    const res = await fetch(`${API_BASE}/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, telefono })
    });
    return handleResponse(res);
  },

  // Validar código OTP de 6 dígitos
  async verificarCodigo(email, codigo) {
    const res = await fetch(`${API_BASE}/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo })
    });
    const data = await handleResponse(res);
    if (data.token && data.usuario) {
      this.guardarSesion(data.token, data.usuario);
    }
    return data;
  },

  // Reenviar código OTP
  async reenviarCodigo(email) {
    const res = await fetch(`${API_BASE}/reenviar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  // Inicio de sesión normal
  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await handleResponse(res);
    if (data.token && data.usuario) {
      this.guardarSesion(data.token, data.usuario);
    }
    return data;
  },

  // Inicio de sesión con Google (One-Click)
  async loginGoogle(email, nombre) {
    const res = await fetch(`${API_BASE}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nombre })
    });
    const data = await handleResponse(res);
    if (data.token && data.usuario) {
      this.guardarSesion(data.token, data.usuario);
    }
    return data;
  },

  // Obtener perfil actualizado
  async obtenerPerfil() {
    const res = await fetch(`${API_BASE}/perfil`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Actualizar datos personales del perfil (nombre, teléfono)
  async actualizarPerfil(datos) {
    const res = await fetch(`${API_BASE}/perfil`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(datos)
    });
    const data = await handleResponse(res);
    if (data.usuario) {
      const sesion = this.obtenerSesionActual();
      if (sesion) {
        this.guardarSesion(sesion.token, { ...sesion.usuario, ...data.usuario });
      }
    }
    return data;
  },

  // HU-11 / Staff: Listar equipo (Solo Superadmin)
  async listarStaff() {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Crear miembro de Staff
  async crearStaff(data) {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Alternar estado activo/inactivo (Superadmin protegido)
  async toggleEstadoStaff(id) {
    const res = await fetch(`${API_BASE}/staff/${id}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Buscar usuario por correo para asignación de roles / staff (Superadmin)
  async buscarUsuarioPorEmail(email) {
    const res = await fetch(`${API_BASE}/usuarios/buscar?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Promover o actualizar rol y permisos de un usuario existente (Superadmin)
  async asignarRolStaff(idUsuario, payload) {
    const res = await fetch(`${API_BASE}/staff/${idUsuario}/rol`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Gestión de sesión local
  guardarSesion(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  },

  obtenerSesionActual() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
    try {
      return { token, usuario: JSON.parse(userStr) };
    } catch {
      return null;
    }
  },

  cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};
