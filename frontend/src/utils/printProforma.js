/**
 * Imprime únicamente la hoja de Proforma / Cotización oficial en formato A4 limpio,
 * evitando que salga el fondo oscuro o las tablas de la aplicación detrás del modal.
 */
export function imprimirProformaOficial(cotizacion) {
  if (!cotizacion) return;

  const fechaEmision = cotizacion.fechaEmision
    ? new Date(cotizacion.fechaEmision).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const fechaVencimiento = cotizacion.fechaVencimiento
    ? new Date(cotizacion.fechaVencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const filasHTML = (cotizacion.items || [])
    .map(it => {
      const cant = Number(it.cantidad || 1);
      const pUnit = parseFloat(it.precioUnitario || 0).toFixed(2);
      const sub = parseFloat(it.subtotal || 0).toFixed(2);
      const alerta = it.mensajeAlerta
        ? `<div style="color:#B45309;font-size:10.5px;margin-top:2px;">⚠️ ${it.mensajeAlerta}</div>`
        : '';
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-weight:600;">
            ${it.nombreProducto || 'Producto'}
            ${alerta}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;text-align:center;color:#334155;">${cant}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:monospace;color:#334155;">S/ ${pUnit}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:monospace;font-weight:700;color:#0F172A;">S/ ${sub}</td>
        </tr>
      `;
    })
    .join('');

  const totalFormateado = parseFloat(cotizacion.total || 0).toFixed(2);

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Proforma ${cotizacion.codigoCotizacion} - Leveling Jump</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 18mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #FFFFFF;
          color: #0F172A;
          margin: 0;
          padding: 0;
        }
        .sheet {
          max-width: 760px;
          margin: 0 auto;
          padding: 16px;
          background: #FFFFFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0F172A;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .brand h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #0F172A;
          letter-spacing: 0.5px;
        }
        .brand p {
          margin: 3px 0 0;
          font-size: 12px;
          color: #475569;
        }
        .doc-meta {
          text-align: right;
        }
        .doc-meta .code {
          font-size: 18px;
          font-weight: 900;
          color: #0284C7;
          font-family: monospace;
          margin: 0 0 4px;
        }
        .doc-meta small {
          display: block;
          font-size: 11.5px;
          color: #475569;
          margin-top: 2px;
        }
        .client-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 18px;
          font-size: 12.5px;
        }
        .client-box .label {
          font-size: 10.5px;
          text-transform: uppercase;
          color: #64748B;
          font-weight: 700;
          display: block;
          margin-bottom: 3px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 18px;
        }
        th {
          border-bottom: 2px solid #CBD5E1;
          color: #475569;
          text-align: left;
          padding: 8px;
          font-size: 12px;
          text-transform: uppercase;
        }
        .total-row td {
          border-top: 2px solid #0F172A;
          padding: 12px 8px;
          font-weight: 800;
        }
        .legal {
          background: #FFFBEB;
          border: 1px solid #FDE68A;
          color: #92400E;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 11.5px;
          line-height: 1.45;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div class="brand">
            <h1>LEVELING JUMP</h1>
            <p>Tienda Oficial de Gunpla, Model Kits Bandai & Anime Collectibles</p>
            <p>Lima, Perú · WhatsApp Comercial: +51 999 888 777</p>
          </div>
          <div class="doc-meta">
            <div class="code">${cotizacion.codigoCotizacion}</div>
            <small>Fecha de Emisión: <strong>${fechaEmision}</strong></small>
            <small style="color:#D97706;font-weight:700;">Válida hasta: ${fechaVencimiento}</small>
          </div>
        </div>

        <div class="client-box">
          <div>
            <span class="label">Datos del Cliente</span>
            <div style="font-weight:700;color:#0F172A;font-size:13.5px;">${cotizacion.nombreCliente || 'Cliente'}</div>
            <div style="color:#334155;margin-top:2px;">WhatsApp: ${cotizacion.telefonoCliente || '—'}</div>
          </div>
          <div>
            <span class="label">Contacto & Observaciones</span>
            <div style="color:#334155;">Correo: ${cotizacion.emailCliente || 'No especificado'}</div>
            <div style="color:#475569;font-style:italic;margin-top:2px;">Notas: ${cotizacion.observaciones || 'Sin observaciones adicionales'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Ítem / Producto Cotizado</th>
              <th style="text-align:center;">Cant.</th>
              <th style="text-align:right;">P. Unitario</th>
              <th style="text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${filasHTML}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align:right;color:#334155;font-size:13.5px;">IMPORTE TOTAL COTIZADO:</td>
              <td style="text-align:right;font-family:monospace;font-size:17px;color:#0284C7;">S/ ${totalFormateado}</td>
            </tr>
          </tfoot>
        </table>

        <div class="legal">
          <strong>Condiciones comerciales:</strong> Los precios unitarios indicados en esta proforma tienen una vigencia de 7 días calendario desde su fecha de emisión. Esta cotización es referencial y <strong>no reserva stock físico en almacén</strong> hasta que se confirme la reserva con adelanto o la compra.
        </div>
      </div>
    </body>
    </html>
  `;

  let iframe = document.getElementById('lj-print-proforma-iframe');
  if (iframe) {
    document.body.removeChild(iframe);
  }

  iframe = document.createElement('iframe');
  iframe.id = 'lj-print-proforma-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 150);
}
