const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { enviarCodigoVerificacion } = require('../services/emailService');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

const prisma = new PrismaClient();

// Correo oficial del Superadmin (Dueño)
const CORREO_SUPERADMIN_OFICIAL = 'cesar.sanchez@isil.pe';

/**
 * Sanitiza errores internos o de Prisma para que no revelen rutas del servidor ni detalles técnicos
 */
function sanitizarError(error, defaultMsg = 'Ocurrió un error interno.') {
  if (error.code === 'P2002') {
    return 'Ya existe un registro con esos datos (conflicto de duplicidad).';
  }
  if (error.code && error.code.startsWith('P')) {
    return 'Inconsistencia en la base de datos al procesar la autenticación.';
  }
  if (error.message && !error.message.includes('\n') && !error.message.includes('prisma') && !error.message.includes('C:\\') && !error.message.includes('/') && !error.message.includes('@prisma')) {
    return error.message;
  }
  return defaultMsg;
}

/**
 * Genera código OTP de 6 dígitos y fecha de expiración (15 minutos).
 */
function generarOtpConExpiracion() {
  return {
    codigo: Math.floor(100000 + Math.random() * 900000).toString(),
    expiracion: new Date(Date.now() + 15 * 60 * 1000)
  };
}

/**
 * Envía un código OTP nuevo y solo reemplaza el código previo vigente en BD si el envío tuvo éxito.
 */
async function emitirYPersistirOtp(usuario, emailNormalizado) {
  const { codigo: nuevoCodigo, expiracion } = generarOtpConExpiracion();
  const emailResult = await enviarCodigoVerificacion(emailNormalizado, usuario.nombre, nuevoCodigo);

  const tieneCodigoVigente = Boolean(
    usuario.codigoVerificacion &&
    usuario.expiracionCodigo &&
    new Date() < new Date(usuario.expiracionCodigo)
  );

  // Evita invalidar un código previo ya entregado si el reenvío actual falla por red
  if (emailResult.success || !tieneCodigoVigente) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { codigoVerificacion: nuevoCodigo, expiracionCodigo: expiracion }
    });
  }

  return { emailEnviado: Boolean(emailResult.success), error: emailResult.error };
}

/**
 * PTLJ-43 / HU-11: Registro de usuario con verificación de correo real (OTP)
 */
const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo electrónico y contraseña son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const emailNormalizado = email.trim().toLowerCase();

    // P03: Validación de formato de correo RFC
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailNormalizado)) {
      return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
    }

    // P03: Rechazo de proveedores de correo temporal o desechable
    const dominiosDesechables = [
      'tempmail.com', '10minutemail.com', 'mailinator.com', 'guerrillamail.com',
      'yopmail.com', 'trashmail.com', 'dispostable.com', 'sharklasers.com',
      'temp-mail.org', 'fakeinbox.com', 'getnada.com', 'mohmal.com'
    ];
    const dominioCorreo = emailNormalizado.split('@')[1];
    if (dominiosDesechables.includes(dominioCorreo)) {
      return res.status(400).json({
        error: 'Por motivos de seguridad no se permiten correos temporales o desechables. Utiliza un correo válido.'
      });
    }

    const { codigo: codigoOtp, expiracion } = generarOtpConExpiracion();
    const passwordHash = await bcrypt.hash(password, 10);

    // Determinar si es el Superadmin (Cesar Sanchez / primer usuario) o Cliente
    const totalUsuarios = await prisma.usuario.count();
    const rolAsignado = (emailNormalizado === CORREO_SUPERADMIN_OFICIAL || totalUsuarios === 0) 
      ? 'SUPERADMIN' 
      : 'CLIENTE';

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    let usuario;
    if (usuarioExistente) {
      if (usuarioExistente.emailVerificado) {
        return res.status(400).json({ error: 'Este correo electrónico ya está registrado y verificado. Inicia sesión.' });
      }
      // Si existía pero no estaba verificado, actualizamos el código y la contraseña
      usuario = await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: {
          nombre: nombre.trim(),
          passwordHash,
          telefono: telefono ? telefono.trim() : null,
          codigoVerificacion: codigoOtp,
          expiracionCodigo: expiracion
        }
      });
    } else {
      usuario = await prisma.usuario.create({
        data: {
          nombre: nombre.trim(),
          email: emailNormalizado,
          passwordHash,
          rol: rolAsignado,
          metodoRegistro: 'LOCAL',
          emailVerificado: false,
          codigoVerificacion: codigoOtp,
          expiracionCodigo: expiracion,
          telefono: telefono ? telefono.trim() : null,
          permisosModulos: rolAsignado === 'SUPERADMIN' ? ['PRODUCTOS', 'LOTES', 'RESERVAS', 'USUARIOS'] : null
        }
      });
    }

    // Enviar correo con timeouts acotados dentro de emailService (API HTTPS o SMTP IPv4)
    const emailResult = await enviarCodigoVerificacion(emailNormalizado, usuario.nombre, codigoOtp);

    return res.status(201).json({
      mensaje: emailResult.success
        ? 'Código de 6 dígitos enviado a tu correo. Revisa también tu carpeta de Spam.'
        : 'Cuenta creada, pero no se pudo enviar el correo ahora. Pulsa "Reenviar código" en unos segundos.',
      email: emailNormalizado,
      emailEnviado: Boolean(emailResult.success),
      tiempoExpiracionMinutos: 15
    });

  } catch (error) {
    console.error('[AuthController.registro] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al procesar el registro de usuario.') });
  }
};

/**
 * PTLJ-43 / HU-11: Validar código OTP y activar cuenta
 */
const verificarCodigo = async (req, res) => {
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      return res.status(400).json({ error: 'El correo y el código de verificación son obligatorios.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'No se encontró ninguna cuenta asociada a este correo.' });
    }

    if (usuario.emailVerificado) {
      return res.status(200).json({ mensaje: 'Esta cuenta ya está verificada. Puedes iniciar sesión.' });
    }

    if (usuario.codigoVerificacion !== codigo.trim()) {
      return res.status(400).json({ error: 'Código de verificación incorrecto.' });
    }

    if (usuario.expiracionCodigo && new Date() > usuario.expiracionCodigo) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita un nuevo código de verificación.' });
    }

    // Activar cuenta
    const usuarioVerificado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        codigoVerificacion: null,
        expiracionCodigo: null
      }
    });

    // Generar sesión JWT
    const token = jwt.sign({
      id: usuarioVerificado.id,
      email: usuarioVerificado.email,
      nombre: usuarioVerificado.nombre,
      rol: usuarioVerificado.rol,
      permisosModulos: usuarioVerificado.permisosModulos
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      mensaje: '¡Correo verificado con éxito! Bienvenido a Leveling Jump.',
      token,
      usuario: {
        id: usuarioVerificado.id,
        nombre: usuarioVerificado.nombre,
        email: usuarioVerificado.email,
        rol: usuarioVerificado.rol,
        permisosModulos: usuarioVerificado.permisosModulos
      }
    });

  } catch (error) {
    console.error('[AuthController.verificarCodigo] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al verificar código.') });
  }
};

/**
 * Reenviar código OTP de verificación
 */
const reenviarCodigo = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'No se encontró la cuenta.' });
    }

    if (usuario.emailVerificado) {
      return res.status(400).json({ error: 'La cuenta ya está verificada.' });
    }

    const { emailEnviado } = await emitirYPersistirOtp(usuario, emailNormalizado);

    if (!emailEnviado) {
      return res.status(503).json({
        error: 'No pudimos entregar el nuevo código ahora. Revisa tu carpeta de Spam por si llegó uno previo o reintenta en unos segundos.'
      });
    }

    return res.status(200).json({
      mensaje: 'Nuevo código de verificación enviado. Revisa Recibidos o Spam.',
      emailEnviado: true
    });
  } catch (error) {
    console.error('[AuthController.reenviarCodigo] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al reenviar código.') });
  }
};

/**
 * PTLJ-43 / HU-11: Inicio de sesión con correo y contraseña
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    // Rechazar credenciales inválidas sin revelar si el correo existe (Criterio Jira & OWASP)
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    if (!usuario.passwordHash) {
      return res.status(400).json({ 
        error: 'Esta cuenta fue creada mediante Google. Por favor, inicia sesión con Google.' 
      });
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    // Verificar si el correo ya fue confirmado
    if (!usuario.emailVerificado) {
      const { emailEnviado } = await emitirYPersistirOtp(usuario, emailNormalizado);

      return res.status(403).json({
        error: emailEnviado
          ? 'Tu cuenta aún no ha sido verificada. Te enviamos un nuevo código a tu correo (revisa también Spam).'
          : 'Tu cuenta aún no ha sido verificada y el envío del correo falló por red. Ingresa tu código previo o pulsa Reenviar.',
        requiereVerificacion: true,
        emailEnviado,
        email: emailNormalizado
      });
    }

    // Generar token JWT con rol
    const token = jwt.sign({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      permisosModulos: usuario.permisosModulos
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        permisosModulos: usuario.permisosModulos
      }
    });

  } catch (error) {
    console.error('[AuthController.login] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al iniciar sesión.') });
  }
};

/**
 * PTLJ-43 / HU-11: Inicio de sesión con Google (OAuth)
 */
const loginGoogle = async (req, res) => {
  try {
    const { email, nombre } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo de Google es obligatorio.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    let usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    if (!usuario) {
      const total = await prisma.usuario.count();
      const rol = (emailNormalizado === CORREO_SUPERADMIN_OFICIAL || total === 0) ? 'SUPERADMIN' : 'CLIENTE';

      usuario = await prisma.usuario.create({
        data: {
          nombre: nombre ? nombre.trim() : emailNormalizado.split('@')[0],
          email: emailNormalizado,
          rol,
          metodoRegistro: 'GOOGLE',
          emailVerificado: true, // Google ya verificó el correo
          permisosModulos: rol === 'SUPERADMIN' ? ['PRODUCTOS', 'LOTES', 'RESERVAS', 'USUARIOS'] : null
        }
      });
    } else {
      // Si existía, aseguramos que su correo figure verificado
      if (!usuario.emailVerificado) {
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: { emailVerificado: true }
        });
      }
    }

    const token = jwt.sign({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      permisosModulos: usuario.permisosModulos
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      mensaje: 'Autenticado con Google exitosamente.',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        permisosModulos: usuario.permisosModulos
      }
    });

  } catch (error) {
    console.error('[AuthController.loginGoogle] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al autenticar con Google.') });
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
const obtenerPerfil = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        metodoRegistro: true,
        emailVerificado: true,
        telefono: true,
        permisosModulos: true,
        fechaCreacion: true
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.status(200).json(usuario);
  } catch (error) {
    console.error('[AuthController.obtenerPerfil] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al consultar perfil.') });
  }
};

/**
 * Actualizar datos personales del perfil del usuario autenticado
 */
const actualizarPerfil = async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    const dataUpdate = {};

    if (nombre && nombre.trim()) {
      dataUpdate.nombre = nombre.trim();
    }
    if (telefono !== undefined) {
      dataUpdate.telefono = telefono ? telefono.trim() : null;
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: dataUpdate,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        metodoRegistro: true,
        emailVerificado: true,
        telefono: true,
        permisosModulos: true,
        fechaCreacion: true
      }
    });

    return res.status(200).json({
      mensaje: 'Perfil actualizado correctamente.',
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('[AuthController.actualizarPerfil] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al actualizar perfil.') });
  }
};

/**
 * Crear miembro de Staff (Solo Superadmin puede crearlos)
 */
const crearStaff = async (req, res) => {
  try {
    const { nombre, email, password, rol = 'ADMIN', permisosModulos } = req.body;

    // Solo el Superadmin puede crear staff
    if (req.usuario.rol !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Solo el Superadministrador puede registrar personal de staff.' });
    }

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const existe = await prisma.usuario.findUnique({
      where: { email: emailNormalizado }
    });

    if (existe) {
      return res.status(400).json({ error: 'El correo ya se encuentra registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const rolFinal = rol === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN';
    const nuevoStaff = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailNormalizado,
        passwordHash,
        rol: rolFinal,
        metodoRegistro: 'LOCAL',
        emailVerificado: true, // Cuenta de staff creada por el dueño, ya verificada
        permisosModulos: rolFinal === 'SUPERADMIN' 
          ? ['PRODUCTOS', 'LOTES', 'RESERVAS', 'USUARIOS'] 
          : (permisosModulos || ['PRODUCTOS', 'LOTES', 'RESERVAS'])
      }
    });

    return res.status(201).json({
      mensaje: `Miembro de staff (${nuevoStaff.rol}) creado exitosamente.`,
      staff: {
        id: nuevoStaff.id,
        nombre: nuevoStaff.nombre,
        email: nuevoStaff.email,
        rol: nuevoStaff.rol,
        permisosModulos: nuevoStaff.permisosModulos
      }
    });

  } catch (error) {
    console.error('[AuthController.crearStaff] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al crear miembro de staff.') });
  }
};

/**
 * Listar miembros de Staff (SUPERADMIN y ADMIN)
 */
const listarStaff = async (req, res) => {
  try {
    const staff = await prisma.usuario.findMany({
      where: {
        rol: { in: ['SUPERADMIN', 'ADMIN'] }
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        emailVerificado: true,
        permisosModulos: true,
        fechaCreacion: true
      },
      orderBy: { fechaCreacion: 'asc' }
    });

    return res.status(200).json(staff);
  } catch (error) {
    console.error('[AuthController.listarStaff] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al listar personal de staff.') });
  }
};

/**
 * Alternar estado activo/inactivo de miembro de staff.
 * REGLA INMUTABLE: La cuenta del Propietario Principal NUNCA puede ser desactivada ni eliminada.
 */
const toggleEstadoStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUsuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    });

    if (!targetUsuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (targetUsuario.id === 1 || targetUsuario.email === CORREO_SUPERADMIN_OFICIAL) {
      return res.status(403).json({ 
        error: 'Operación denegada: La cuenta del Propietario Principal no puede ser desactivada ni revocada.' 
      });
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { activo: !targetUsuario.activo }
    });

    return res.status(200).json({
      mensaje: `Usuario ${usuarioActualizado.nombre} ${usuarioActualizado.activo ? 'activado' : 'desactivado'} con éxito.`,
      usuario: {
        id: usuarioActualizado.id,
        nombre: usuarioActualizado.nombre,
        activo: usuarioActualizado.activo
      }
    });
  } catch (error) {
    console.error('[AuthController.toggleEstadoStaff] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al actualizar estado del usuario.') });
  }
};

/**
 * Buscar usuario por correo electrónico para asignación de roles / staff (Solo Superadmin)
 */
const buscarUsuarioPorEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Debes ingresar un correo electrónico para buscar.' });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        metodoRegistro: true,
        emailVerificado: true,
        telefono: true,
        permisosModulos: true,
        activo: true,
        fechaCreacion: true
      }
    });

    if (!usuario) {
      return res.status(200).json({
        encontrado: false,
        mensaje: 'No se encontró ningún usuario registrado con este correo.'
      });
    }

    return res.status(200).json({
      encontrado: true,
      usuario
    });
  } catch (error) {
    console.error('[AuthController.buscarUsuarioPorEmail] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al buscar usuario.') });
  }
};

/**
 * Promover o actualizar rol y permisos de un usuario existente (Solo Superadmin)
 */
const asignarRolStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, permisosModulos } = req.body;

    const idUsuario = parseInt(id);
    const usuario = await prisma.usuario.findUnique({
      where: { id: idUsuario }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Regla inmutable: La cuenta del Propietario Principal no puede ser degradada de Superadmin
    if ((usuario.id === 1 || usuario.email === CORREO_SUPERADMIN_OFICIAL) && rol !== 'SUPERADMIN') {
      return res.status(403).json({
        error: 'Operación denegada: La cuenta del Propietario Principal no puede ser degradada de Superadmin.'
      });
    }

    const rolFinal = rol === 'SUPERADMIN' ? 'SUPERADMIN' : (rol === 'CLIENTE' ? 'CLIENTE' : 'ADMIN');
    
    // Si es SUPERADMIN, tiene todos los módulos habilitados; si es CLIENTE, null; si es ADMIN, los seleccionados
    const permisosFinales = rolFinal === 'SUPERADMIN'
      ? ['PRODUCTOS', 'LOTES', 'RESERVAS', 'USUARIOS']
      : (rolFinal === 'ADMIN' ? (permisosModulos || ['PRODUCTOS', 'LOTES', 'RESERVAS']) : null);

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: idUsuario },
      data: {
        rol: rolFinal,
        permisosModulos: permisosFinales,
        emailVerificado: true // Al ser promovido por el superadmin, se garantiza su verificación
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        metodoRegistro: true,
        emailVerificado: true,
        telefono: true,
        permisosModulos: true,
        activo: true
      }
    });

    return res.status(200).json({
      mensaje: `Rol de ${usuarioActualizado.nombre} actualizado a ${usuarioActualizado.rol} con éxito.`,
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('[AuthController.asignarRolStaff] Detalle técnico:', error);
    return res.status(500).json({ error: sanitizarError(error, 'Error al actualizar el rol del usuario.') });
  }
};

module.exports = {
  registro,
  verificarCodigo,
  reenviarCodigo,
  login,
  loginGoogle,
  obtenerPerfil,
  actualizarPerfil,
  crearStaff,
  listarStaff,
  toggleEstadoStaff,
  buscarUsuarioPorEmail,
  asignarRolStaff
};
