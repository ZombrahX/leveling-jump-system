// frontend/src/services/reservaPoliticaService.js
// Gestión flexible de políticas de reserva (HU-06) sin requerir modificaciones en SQL ni backend
// Desarrollado para Leveling Jump - Grupo 6 (ISIL)

const STORAGE_GLOBAL_KEY = 'lj_reserva_politica_global';
const STORAGE_PRODUCTOS_KEY = 'lj_reserva_politicas_productos';

// Modos de política de reserva soportados
export const MODOS_POLITICA = {
  ESTANDAR: 'ESTANDAR',             // Caso 1: Flexible (3 tramos: Mínimo configurable, Intermedio configurable, 100%)
  CINCUENTA_TOTAL: 'CINCUENTA_TOTAL', // Caso 2: Económico (2 tramos: 50% y 100%)
  PAGO_TOTAL: 'PAGO_TOTAL'          // Caso 3: Exclusivo / Especial (1 tramo: 100% únicamente)
};

export const DEFAULT_GLOBAL_POLITICA = {
  modo: MODOS_POLITICA.ESTANDAR,
  p1: 20,
  p2: 50
};

export const reservaPoliticaService = {
  // Obtener la política global por defecto
  obtenerPoliticaGlobal() {
    try {
      const raw = localStorage.getItem(STORAGE_GLOBAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          modo: parsed.modo || MODOS_POLITICA.ESTANDAR,
          p1: Number(parsed.p1) || 20,
          p2: Number(parsed.p2) || 50
        };
      }
    } catch (_) {}
    return { ...DEFAULT_GLOBAL_POLITICA };
  },

  // Guardar la política global por defecto
  guardarPoliticaGlobal(politica) {
    try {
      const toSave = {
        modo: politica.modo || MODOS_POLITICA.ESTANDAR,
        p1: Math.max(1, Math.min(99, Number(politica.p1) || 20)),
        p2: Math.max(1, Math.min(99, Number(politica.p2) || 50))
      };
      localStorage.setItem(STORAGE_GLOBAL_KEY, JSON.stringify(toSave));
      return toSave;
    } catch (_) {
      return politica;
    }
  },

  // Obtener mapa de políticas por producto
  obtenerTodasPoliticasProductos() {
    try {
      const raw = localStorage.getItem(STORAGE_PRODUCTOS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  },

  // Obtener política efectiva para un producto específico
  // Si el producto tiene política propia 1x1, se usa esa; de lo contrario, se usa la global
  obtenerPoliticaProducto(productoId) {
    if (!productoId) return this.obtenerPoliticaGlobal();
    const mapa = this.obtenerTodasPoliticasProductos();
    if (mapa && mapa[productoId]) {
      return {
        ...mapa[productoId],
        esEspecifica: true
      };
    }
    return {
      ...this.obtenerPoliticaGlobal(),
      esEspecifica: false
    };
  },

  // Guardar política para un producto específico (Edición 1x1)
  guardarPoliticaProducto(productoId, politica) {
    if (!productoId) return;
    try {
      const mapa = this.obtenerTodasPoliticasProductos();
      mapa[productoId] = {
        modo: politica.modo || MODOS_POLITICA.ESTANDAR,
        p1: Math.max(1, Math.min(99, Number(politica.p1) || 20)),
        p2: Math.max(1, Math.min(99, Number(politica.p2) || 50)),
        fechaActualizacion: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_PRODUCTOS_KEY, JSON.stringify(mapa));
      return mapa[productoId];
    } catch (_) {}
  },

  // Revertir producto específico a la política global
  removerPoliticaProducto(productoId) {
    if (!productoId) return;
    try {
      const mapa = this.obtenerTodasPoliticasProductos();
      delete mapa[productoId];
      localStorage.setItem(STORAGE_PRODUCTOS_KEY, JSON.stringify(mapa));
    } catch (_) {}
  },

  // Aplicar una política a TODOS los productos de golpe ("zas de golpe")
  aplicarATodosDeGolpe(modo, p1 = 20, p2 = 50) {
    try {
      // 1. Actualizar la global
      const global = this.guardarPoliticaGlobal({ modo, p1, p2 });
      // 2. Limpiar sobreescrituras individuales para que todos sincronicen con la nueva regla
      localStorage.removeItem(STORAGE_PRODUCTOS_KEY);
      return global;
    } catch (_) {}
  }
};
