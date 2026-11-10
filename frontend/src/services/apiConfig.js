/**
 * Configuración centralizada de la URL de la API del Backend.
 * En desarrollo local: 'http://localhost:4000'
 * En producción (Vercel): toma el valor de VITE_API_URL configurado en Vercel
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
