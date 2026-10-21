const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'leveling_jump_secure_jwt_token_2026_cesar_sanchez';

/**
 * Middleware para validar el JWT en cabecera Authorization: Bearer <token>
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado. Por favor inicia sesión nuevamente.' });
  }
};

/**
 * Middleware para restringir acceso según roles permitidos.
 * Ejemplo: requerirRol(['SUPERADMIN', 'ADMIN'])
 */
const requerirRol = (rolesPermitidos = []) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ 
        error: 'Acceso denegado. No tienes permisos para acceder a este módulo.' 
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  requerirRol,
  JWT_SECRET
};
