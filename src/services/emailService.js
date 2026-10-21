const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Envía un correo con el código OTP de verificación de 6 dígitos.
 */
async function enviarCodigoVerificacion(destinatario, nombre, codigo) {
  const mailOptions = {
    from: `"Leveling Jump — Verificación Oficial" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: `🔐 Tu código de verificación: ${codigo} — Leveling Jump`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: auto; background-color: #0D1117; color: #FFFFFF; border-radius: 10px; overflow: hidden; border: 1px solid #30363D;">
        <div style="background-color: #161B22; padding: 24px; text-align: center; border-bottom: 3px solid #00D2EE;">
          <h1 style="margin: 0; color: #00D2EE; font-size: 24px; letter-spacing: 1.5px; text-transform: uppercase;">LEVELING JUMP</h1>
          <p style="margin: 5px 0 0; color: #F59E0B; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">Gunpla & Collectors Store · Lima, Perú</p>
        </div>

        <div style="padding: 32px 28px; background-color: #0D1117;">
          <h2 style="color: #FFFFFF; margin-top: 0; font-size: 20px;">¡Hola, ${nombre}! 👋</h2>
          <p style="color: #9CA3AF; line-height: 1.6; font-size: 14px;">
            Gracias por registrarte en la plataforma oficial de <strong>Leveling Jump</strong>. Para verificar que tu correo electrónico es auténtico y activar tu cuenta, ingresa el siguiente código de seguridad en la aplicación:
          </p>

          <div style="background: #161B22; border: 2px dashed #00D2EE; border-radius: 8px; padding: 20px; text-align: center; margin: 26px 0;">
            <span style="font-size: 12px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Código de Verificación OTP</span>
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00D2EE; font-family: monospace;">${codigo}</span>
            <span style="font-size: 12px; color: #EF4444; display: block; margin-top: 8px;">⏱️ Válido durante los próximos 15 minutos</span>
          </div>

          <p style="color: #6B7280; font-size: 13px; line-height: 1.5;">
            Si tú no solicitaste este registro en Leveling Jump, puedes ignorar este mensaje de forma segura.
          </p>
        </div>

        <div style="background-color: #080B0F; padding: 18px 24px; text-align: center; border-top: 1px solid #21262D; color: #6B7280; font-size: 11.5px;">
          <p style="margin: 0;">Leveling Jump &copy; 2026 · Proyecto Tecnológico (ISIL — NRC 30633)</p>
          <p style="margin: 4px 0 0; color: #4B5563;">Mensaje transaccional automático enviado desde el servidor de desarrollo.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Correo enviado a ${destinatario} - MsgID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Error al enviar correo a ${destinatario}:`, error.message);
    throw error;
  }
}

/**
 * Envía un correo con el comprobante de reserva de unidad (HU-06).
 */
async function enviarComprobanteReserva(destinatario, nombre, reserva) {
  const mailOptions = {
    from: `"Leveling Jump — Reservas" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: `📦 Reserva Confirmada [${reserva.codigoSeguimiento}] — Leveling Jump`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: auto; background-color: #0D1117; color: #FFFFFF; border-radius: 10px; overflow: hidden; border: 1px solid #30363D;">
        <div style="background-color: #161B22; padding: 22px; text-align: center; border-bottom: 3px solid #00D2EE;">
          <h1 style="margin: 0; color: #00D2EE; font-size: 22px;">LEVELING JUMP</h1>
          <p style="margin: 4px 0 0; color: #F59E0B; font-size: 12px; letter-spacing: 1px;">COMPROBANTE DE RESERVA DE PRODUCTO</p>
        </div>

        <div style="padding: 28px;">
          <h2 style="color: #FFFFFF; margin-top: 0;">¡Reserva Registrada con Éxito!</h2>
          <p style="color: #9CA3AF; font-size: 14px;">Hola ${nombre}, tu reserva ha sido ingresada al sistema. A continuación los detalles:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px; color: #FFFFFF;">
            <tr style="border-bottom: 1px solid #30363D;">
              <td style="padding: 8px 0; color: #9CA3AF;">Código de Seguimiento:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #00D2EE;">${reserva.codigoSeguimiento}</td>
            </tr>
            <tr style="border-bottom: 1px solid #30363D;">
              <td style="padding: 8px 0; color: #9CA3AF;">Producto:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${reserva.nombreProducto}</td>
            </tr>
            <tr style="border-bottom: 1px solid #30363D;">
              <td style="padding: 8px 0; color: #9CA3AF;">Precio Total:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">S/ ${Number(reserva.montoTotal).toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #30363D;">
              <td style="padding: 8px 0; color: #9CA3AF;">Adelanto Abonado:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10B981;">S/ ${Number(reserva.montoAdelanto).toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #30363D;">
              <td style="padding: 8px 0; color: #9CA3AF;">Saldo Pendiente:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #F59E0B;">S/ ${Number(reserva.saldoPendiente).toFixed(2)}</td>
            </tr>
          </table>

          <p style="color: #9CA3AF; font-size: 13px;">
            Presenta tu código <strong>${reserva.codigoSeguimiento}</strong> por WhatsApp o en la feria del sábado para retirar tu kit una vez cancelado el saldo.
          </p>
        </div>
      </div>
    `
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`[EmailService] Error al enviar comprobante de reserva:`, error.message);
  }
}

module.exports = {
  enviarCodigoVerificacion,
  enviarComprobanteReserva
};
