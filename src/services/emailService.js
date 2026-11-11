require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Escapa caracteres HTML básicos para prevenir inyección de marcado en correos.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Obtiene las credenciales SMTP limpiando espacios accidentales en App Passwords.
 */
function getSmtpCredentials() {
  const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
  const rawPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : null;
  const pass = rawPass ? rawPass.replace(/\s+/g, '') : null;
  return user && pass ? { user, pass } : null;
}

/**
 * Construye un transporte SMTP de Gmail forzando IPv4 para evitar cuelgues DNS en contenedores cloud.
 */
function createGmailTransporter({ user, pass, port, secure }) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    family: 4, // Evita timeouts cuando el contenedor no enruta IPv6 hacia smtp.gmail.com
    connectionTimeout: 6000,
    greetingTimeout: 4500,
    socketTimeout: 7000
  });
}

/**
 * Envía correo mediante la API HTTP de Brevo (puerto 443 HTTPS, inmune a bloqueos SMTP en cloud).
 */
async function sendViaBrevo({ to, toName, subject, text, html, senderEmail, senderName }) {
  const apiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : null;
  if (!apiKey || !senderEmail) {
    return { ok: false, skipped: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, ...(toName ? { name: toName } : {}) }],
        subject,
        textContent: text,
        htmlContent: html
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload.message || `Brevo HTTP ${response.status}` };
    }

    return { ok: true, provider: 'brevo-https', messageId: payload.messageId };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Brevo timeout (7s)' : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Envía correo por Gmail SMTP probando primero puerto 465 (SSL) y luego 587 (STARTTLS) ante fallos de red.
 */
async function sendViaGmailSmtp({ creds, from, to, subject, text, html }) {
  const attempts = [
    { port: 465, secure: true, label: 'smtp-465' },
    { port: 587, secure: false, label: 'smtp-587' }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const transporter = createGmailTransporter({
      user: creds.user,
      pass: creds.pass,
      port: attempt.port,
      secure: attempt.secure
    });

    try {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      return { ok: true, provider: attempt.label, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      // Si es error de autenticación (535), no tiene sentido reintentar otro puerto
      if (err.code === 'EAUTH' || (err.message && err.message.includes('535'))) {
        break;
      }
    }
  }

  return { ok: false, error: lastError ? lastError.message : 'Error SMTP desconocido' };
}

/**
 * Orquesta el envío transaccional priorizando API HTTPS (si está configurada) y luego SMTP IPv4.
 */
async function sendTransactionalEmail({ to, toName, fromLabel, subject, text, html, devFallbackCode }) {
  const isDev = process.env.NODE_ENV !== 'production';
  const smtpCreds = getSmtpCredentials();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || (smtpCreds ? smtpCreds.user : '')).trim();
  const senderName = fromLabel || 'Leveling Jump';

  // 1. Prioridad: Brevo API HTTPS (puerto 443) si BREVO_API_KEY está configurado
  if (process.env.BREVO_API_KEY && senderEmail) {
    const brevoRes = await sendViaBrevo({
      to,
      toName,
      subject,
      text,
      html,
      senderEmail,
      senderName
    });
    if (brevoRes.ok) {
      console.log(`[EmailService] Enviado vía ${brevoRes.provider} a ${to} - MsgID: ${brevoRes.messageId}`);
      return { success: true, provider: brevoRes.provider, messageId: brevoRes.messageId };
    }
    console.warn(`[EmailService] Brevo falló para ${to}: ${brevoRes.error}. Probando fallback SMTP...`);
  }

  // 2. Fallback / Local: Gmail SMTP (IPv4, 465 -> 587)
  if (smtpCreds) {
    const smtpRes = await sendViaGmailSmtp({
      creds: smtpCreds,
      from: `"${senderName}" <${smtpCreds.user}>`,
      to,
      subject,
      text,
      html
    });
    if (smtpRes.ok) {
      console.log(`[EmailService] Enviado vía ${smtpRes.provider} a ${to} - MsgID: ${smtpRes.messageId}`);
      return { success: true, provider: smtpRes.provider, messageId: smtpRes.messageId };
    }
    console.warn(`[EmailService] Error SMTP enviando a ${to}: ${smtpRes.error}`);
    if (isDev && devFallbackCode) {
      console.warn(`[EmailService - FALLBACK DEV] Código para ${to}: ${devFallbackCode}`);
    }
    return { success: false, error: smtpRes.error };
  }

  // 3. Sin proveedor configurado
  if (isDev && devFallbackCode) {
    console.warn(`\n=============================================================`);
    console.warn(`[EmailService - MODO DEV] Sin credenciales de correo configuradas`);
    console.warn(`Destinatario: ${to} (${toName || ''}) | Código OTP: ${devFallbackCode}`);
    console.warn(`=============================================================\n`);
    return { success: true, devMode: true };
  }

  console.error('[EmailService] No hay proveedor de correo configurado en producción.');
  return { success: false, error: 'Servicio de correo no configurado en el servidor.' };
}

/**
 * Envía un correo con el código OTP de verificación de 6 dígitos (versión texto + HTML).
 */
async function enviarCodigoVerificacion(destinatario, nombre, codigo) {
  const safeName = escapeHtml(nombre || 'coleccionista');
  const safeCode = escapeHtml(codigo);
  const subject = `Tu código de verificación: ${codigo} — Leveling Jump`;

  const text = [
    `Hola ${nombre || 'coleccionista'},`,
    '',
    `Tu código de verificación de Leveling Jump es: ${codigo}`,
    '',
    'Este código es válido durante los próximos 15 minutos.',
    'Si no solicitaste este registro, puedes ignorar este mensaje.',
    '',
    'Leveling Jump · Gunpla & Collectors Store · Lima, Perú'
  ].join('\n');

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: auto; background-color: #0D1117; color: #FFFFFF; border-radius: 10px; overflow: hidden; border: 1px solid #30363D;">
      <div style="background-color: #161B22; padding: 22px; text-align: center; border-bottom: 3px solid #00D2EE;">
        <h1 style="margin: 0; color: #00D2EE; font-size: 22px; letter-spacing: 1.5px; text-transform: uppercase;">LEVELING JUMP</h1>
        <p style="margin: 4px 0 0; color: #F59E0B; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Gunpla &amp; Collectors Store · Lima, Perú</p>
      </div>

      <div style="padding: 28px; background-color: #0D1117;">
        <h2 style="color: #FFFFFF; margin-top: 0; font-size: 19px;">Hola, ${safeName}</h2>
        <p style="color: #C9D1D9; line-height: 1.6; font-size: 14px;">
          Para verificar tu correo electrónico y activar tu cuenta en <strong>Leveling Jump</strong>, ingresa el siguiente código de seguridad:
        </p>

        <div style="background: #161B22; border: 2px dashed #00D2EE; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Código de Verificación</span>
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #00D2EE; font-family: monospace;">${safeCode}</span>
          <span style="font-size: 12px; color: #F59E0B; display: block; margin-top: 8px;">Válido durante los próximos 15 minutos</span>
        </div>

        <p style="color: #8B949E; font-size: 13px; line-height: 1.5;">
          Si no solicitaste este registro, puedes ignorar este mensaje de forma segura.
        </p>
      </div>

      <div style="background-color: #080B0F; padding: 16px 24px; text-align: center; border-top: 1px solid #21262D; color: #6B7280; font-size: 11.5px;">
        <p style="margin: 0;">Leveling Jump &copy; 2026 · Gunpla &amp; Anime Collectibles · Lima, Perú</p>
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    to: destinatario,
    toName: nombre,
    fromLabel: 'Leveling Jump',
    subject,
    text,
    html,
    devFallbackCode: codigo
  });
}

/**
 * Envía un correo con el comprobante de reserva de unidad.
 */
async function enviarComprobanteReserva(destinatario, nombre, reserva) {
  const safeName = escapeHtml(nombre || 'cliente');
  const safeCodigo = escapeHtml(reserva.codigoSeguimiento);
  const safeProd = escapeHtml(reserva.nombreProducto);
  const total = Number(reserva.montoTotal).toFixed(2);
  const adelanto = Number(reserva.montoAdelanto).toFixed(2);
  const saldo = Number(reserva.saldoPendiente).toFixed(2);

  const subject = `Reserva Confirmada [${reserva.codigoSeguimiento}] — Leveling Jump`;

  const text = [
    `Hola ${nombre || 'cliente'},`,
    '',
    `Tu reserva en Leveling Jump ha sido registrada con éxito.`,
    `Código de Seguimiento: ${reserva.codigoSeguimiento}`,
    `Producto: ${reserva.nombreProducto}`,
    `Precio Total: S/ ${total}`,
    `Adelanto Abonado: S/ ${adelanto}`,
    `Saldo Pendiente: S/ ${saldo}`,
    '',
    'Leveling Jump · Gunpla & Anime Collectibles'
  ].join('\n');

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: auto; background-color: #0D1117; color: #FFFFFF; border-radius: 10px; overflow: hidden; border: 1px solid #30363D;">
      <div style="background-color: #161B22; padding: 22px; text-align: center; border-bottom: 3px solid #00D2EE;">
        <h1 style="margin: 0; color: #00D2EE; font-size: 22px;">LEVELING JUMP</h1>
        <p style="margin: 4px 0 0; color: #F59E0B; font-size: 12px; letter-spacing: 1px;">COMPROBANTE DE RESERVA DE PRODUCTO</p>
      </div>

      <div style="padding: 28px;">
        <h2 style="color: #FFFFFF; margin-top: 0;">¡Reserva Registrada con Éxito!</h2>
        <p style="color: #9CA3AF; font-size: 14px;">Hola ${safeName}, tu reserva ha sido ingresada al sistema. A continuación los detalles:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px; color: #FFFFFF;">
          <tr style="border-bottom: 1px solid #30363D;">
            <td style="padding: 8px 0; color: #9CA3AF;">Código de Seguimiento:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #00D2EE;">${safeCodigo}</td>
          </tr>
          <tr style="border-bottom: 1px solid #30363D;">
            <td style="padding: 8px 0; color: #9CA3AF;">Producto:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${safeProd}</td>
          </tr>
          <tr style="border-bottom: 1px solid #30363D;">
            <td style="padding: 8px 0; color: #9CA3AF;">Precio Total:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">S/ ${total}</td>
          </tr>
          <tr style="border-bottom: 1px solid #30363D;">
            <td style="padding: 8px 0; color: #9CA3AF;">Adelanto Abonado:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10B981;">S/ ${adelanto}</td>
          </tr>
          <tr style="border-bottom: 1px solid #30363D;">
            <td style="padding: 8px 0; color: #9CA3AF;">Saldo Pendiente:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #F59E0B;">S/ ${saldo}</td>
          </tr>
        </table>

        <div style="background-color: #161B22; border-left: 4px solid #00D2EE; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 12.5px; color: #C9D1D9;">
          Recuerda que para coordinar la entrega en la feria del sábado o tu envío courier, puedes comunicarte indicando tu código de seguimiento <strong>${safeCodigo}</strong>.
        </div>
      </div>

      <div style="background-color: #080B0F; padding: 14px 20px; text-align: center; border-top: 1px solid #21262D; color: #6B7280; font-size: 11px;">
        Leveling Jump &copy; 2026 · Gunpla &amp; Anime Collectibles
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    to: destinatario,
    toName: nombre,
    fromLabel: 'Leveling Jump — Reservas',
    subject,
    text,
    html
  });
}

module.exports = {
  enviarCodigoVerificacion,
  enviarComprobanteReserva
};
