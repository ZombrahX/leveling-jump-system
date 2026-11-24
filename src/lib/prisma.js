const { PrismaClient } = require('@prisma/client');

/**
 * Patrón Singleton Global para PrismaClient.
 * Evita abrir múltiples pools de conexiones simultáneos hacia Supabase (PgBouncer puerto 6543)
 * previniendo errores P2024 (Connection Pool Exhaustion) y exceso de consumo de RAM en Render.
 */
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__ljPrismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__ljPrismaClient = prisma;
}

module.exports = prisma;
