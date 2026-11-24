/**
 * Middlewares de endurecimiento HTTP (Helmet nativo) y Rate Limiting en memoria contra fuerza bruta y DoS L7.
 */

const securityHeaders = (req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

/**
 * Crea un limitador de peticiones por IP en ventana deslizante
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 30,
  message = 'Demasiadas solicitudes desde esta dirección IP. Por favor intenta nuevamente en unos minutos.'
} = {}) => {
  const hits = new Map();

  // Limpieza periódica de entradas expiradas cada 5 minutos
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (interval.unref) interval.unref();

  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || 'unknown';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));

    if (record.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

module.exports = {
  securityHeaders,
  createRateLimiter
};
