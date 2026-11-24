const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { securityHeaders } = require('./middlewares/securityMiddleware');
const productRoutes = require('./routes/productRoutes');
const loteRoutes = require('./routes/loteRoutes');
const authRoutes = require('./routes/authRoutes');
const reservaRoutes = require('./routes/reservaRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const cotizacionRoutes = require('./routes/cotizacionRoutes');
const interesRoutes = require('./routes/interesRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');

const app = express();
app.disable('x-powered-by');

// 1. Cabeceras HTTP de endurecimiento (HSTS, nosniff, X-Frame-Options, Referrer-Policy)
app.use(securityHeaders);

// 2. Configuración CORS con validación de orígenes permitidos
const customOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        customOrigins.includes(origin);

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error('Origen no autorizado por política CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true
  })
);

// 3. Límite estricto de tamaño de payload JSON contra ataques DoS de Capa 7
app.use(express.json({ limit: '500kb' }));

app.use('/api', productRoutes);
app.use('/api', loteRoutes);
app.use('/api', reservaRoutes);
app.use('/api', ventaRoutes);
app.use('/api', cotizacionRoutes);
app.use('/api', interesRoutes);
app.use('/api', configuracionRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servicio: 'Leveling Jump API',
    mensaje: 'Servidor operativo y listo para recibir peticiones.'
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
