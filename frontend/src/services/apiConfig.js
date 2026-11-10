/**
 * Configuración centralizada de la URL de la API del Backend.
 * Por defecto apunta a la API desplegada en producción (Render).
 * En entorno local se puede sobreescribir mediante la variable VITE_API_URL.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://leveling-jump-system.onrender.com').replace(/\/+$/, '');

