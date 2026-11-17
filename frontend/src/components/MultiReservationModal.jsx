import React, { useState, useEffect, useMemo } from 'react';
import { reservaService } from '../services/reservaService';

export default function MultiReservationModal({
  isOpen,
  onClose,
  items = [],
  usuarioActual,
  politicasGlobales,
  onRemoveItem,
  onClearBag,
  onReservaExitosa
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [adelantoManual, setAdelantoManual] = useState('');
  const [reservarParaCliente, setReservarParaCliente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reservasConfirmadas, setReservasConfirmadas] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const esStaff = usuarioActual && (usuarioActual.rol === 'ADMIN' || usuarioActual.rol === 'OPERADOR' || usuarioActual.rol === 'VENDEDOR');

  // Calcular la política por cada ítem individualmente
  const itemsConPolitica = useMemo(() => {
    return items.map(prod => {
      const precio = Number(prod.precio || 0);
      let pct = 0.20; // 20% base por defecto
      let badgeLabel = 'Estándar (20%)';
      let badgeColor = 'var(--color-cyan)';

      const nombreL = (prod.nombre || '').toLowerCase();
      const catL = (prod.categoria || '').toLowerCase();

      // Criterios de políticas diferenciadas (HU-06)
      if (nombreL.includes('p-bandai') || nombreL.includes('edición limitada') || catL.includes('limitada')) {
        pct = 0.50;
        badgeLabel = 'Ed. Limitada (50%)';
        badgeColor = 'var(--color-gold)';
      } else if (precio >= 400 || nombreL.includes('perfect grade') || nombreL.includes('pg ') || nombreL.includes('metal build')) {
        pct = 0.30;
        badgeLabel = 'Alta Gama (30%)';
        badgeColor = '#A78BFA';
      } else if (prod.stockActual > 0) {
        pct = 0.20;
        badgeLabel = 'En Stock (20%)';
        badgeColor = '#10B981';
      }

      const minAdelanto = Number((precio * pct).toFixed(2));

      return {
        ...prod,
        precio,
        pct,
        badgeLabel,
        badgeColor,
        minAdelanto
      };
    });
  }, [items]);

  const totalCompra = useMemo(() => {
    return itemsConPolitica.reduce((acc, curr) => acc + curr.precio, 0);
  }, [itemsConPolitica]);

  const adelantoMinimoTotal = useMemo(() => {
    return itemsConPolitica.reduce((acc, curr) => acc + curr.minAdelanto, 0);
  }, [itemsConPolitica]);

  // Al abrir el modal, sincronizar datos iniciales (sin resetear si ya confirmó reservas)
  useEffect(() => {
    if (isOpen && !reservasConfirmadas) {
      setError('');
      if (usuarioActual) {
        setNombre(usuarioActual.nombre || '');
        setEmail(usuarioActual.email || '');
        setTelefono(usuarioActual.telefono || '');
      } else {
        setNombre('');
        setEmail('');
        setTelefono('');
      }
      setAdelantoManual(adelantoMinimoTotal.toFixed(2));
    }
  }, [isOpen, usuarioActual, adelantoMinimoTotal, reservasConfirmadas]);

  const handleClose = () => {
    if (reservasConfirmadas && onClearBag) {
      onClearBag();
    }
    setReservasConfirmadas(null);
    setError('');
    setCopiado(false);
    onClose();
  };

  if (!isOpen) return null;

  const adelantoNum = parseFloat(adelantoManual) || 0;
  const saldoPendiente = Math.max(0, totalCompra - adelantoNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (items.length === 0) {
      setError('La bolsa de reservas está vacía.');
      return;
    }

    if (!nombre.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }

    if (!telefono.trim()) {
      setError('El teléfono o WhatsApp de contacto es obligatorio.');
      return;
    }

    if (adelantoNum < adelantoMinimoTotal) {
      setError(`El adelanto total ingresado (S/ ${adelantoNum.toFixed(2)}) es menor que la suma de adelantos mínimos requeridos (S/ ${adelantoMinimoTotal.toFixed(2)}).`);
      return;
    }

    if (adelantoNum > totalCompra) {
      setError(`El adelanto (S/ ${adelantoNum.toFixed(2)}) no puede exceder el total de la compra (S/ ${totalCompra.toFixed(2)}).`);
      return;
    }

    try {
      setLoading(true);

      // Distribuir el adelanto total entre los items proporcionalmente al mínimo requerido
      const excedente = Math.max(0, adelantoNum - adelantoMinimoTotal);
      const sumaPrecios = totalCompra;

      const itemsParaRegistrar = itemsConPolitica.map(item => {
        let asignado = item.minAdelanto;
        if (excedente > 0 && sumaPrecios > 0) {
          const proporcion = (item.precio - item.minAdelanto) / Math.max(1, (sumaPrecios - adelantoMinimoTotal));
          asignado += Number((excedente * proporcion).toFixed(2));
        }
        asignado = Math.min(item.precio, asignado);
        return {
          id: item.id,
          precio: item.precio,
          adelantoAsignado: Number(asignado.toFixed(2))
        };
      });

      const creadas = await reservaService.crearReservasEnMasa(itemsParaRegistrar, {
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: email ? email.trim() : null,
        notas: notas.trim(),
        idUsuario: usuarioActual ? usuarioActual.id : null
      });

      // Guardar confirmación en estado local; la bolsa se limpiará al cerrar el modal
      setReservasConfirmadas(creadas);
      if (onReservaExitosa) onReservaExitosa();
    } catch (err) {
      setError(err.message || 'Error al procesar la reserva en masa.');
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppMultiLink = () => {
    if (!reservasConfirmadas || reservasConfirmadas.length === 0) return '#';
    const codigos = reservasConfirmadas.map(r => r.codigoSeguimiento).join(', ');
    const listaProds = reservasConfirmadas.map(r => `• ${r.producto?.nombre || 'Kit'} (${r.codigoSeguimiento})`).join('\n');
    const text = encodeURIComponent(
      `¡Hola Leveling Jump! Acabo de registrar una *Reserva Múltiple* para los siguientes kits:\n\n${listaProds}\n\n*Códigos de Seguimiento:* ${codigos}\n*Adelanto Total:* S/ ${adelantoNum.toFixed(2)}\n*Saldo Pendiente:* S/ ${saldoPendiente.toFixed(2)}.`
    );
    return `https://wa.me/51999999999?text=${text}`;
  };

  const handleCopiarCodigos = () => {
    if (!reservasConfirmadas) return;
    const codigos = reservasConfirmadas.map(r => `${r.producto?.nombre || 'Kit'}: ${r.codigoSeguimiento}`).join('\n');
    navigator.clipboard.writeText(codigos);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3>
            {reservasConfirmadas ? 'RESERVA MÚLTIPLE CONFIRMADA' : `BOLSA DE RESERVA (${items.length} PRODUCTOS)`}
          </h3>
          <button className="modal-close-btn" onClick={handleClose}>&times;</button>
        </div>

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>{error}</div>}

        {!reservasConfirmadas ? (
          <div>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8B949E' }}>
                <span style={{ fontSize: '38px', display: 'block', marginBottom: '8px' }}>🛒</span>
                <strong>Tu bolsa de reserva está vacía.</strong>
                <p style={{ fontSize: '13px', margin: '6px 0 16px' }}>Explora el catálogo y añade los kits que desees apartar en un solo pedido.</p>
                <button type="button" className="secondary" onClick={handleClose}>Volver al Catálogo</button>
              </div>
            ) : (
              <div>
                {/* Listado de kits en la bolsa */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #30363D', borderRadius: '8px', background: '#0D1117', padding: '8px' }}>
                  {itemsConPolitica.map(prod => (
                    <div
                      key={prod.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '8px 10px',
                        borderBottom: '1px solid #21262D'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        {prod.imagenUrl ? (
                          <img
                            src={prod.imagenUrl}
                            alt={prod.nombre}
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #30363D' }}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : null}
                        <div style={{ minWidth: 0 }}>
                          <h5 style={{ margin: 0, fontSize: '13px', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prod.nombre}
                          </h5>
                          <small style={{ color: '#8B949E', fontSize: '11px' }}>
                            {prod.marca} · S/ {prod.precio.toFixed(2)}
                          </small>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: prod.badgeColor, fontWeight: 'bold', display: 'block' }}>
                            {prod.badgeLabel}
                          </span>
                          <small style={{ color: '#8B949E', fontSize: '11px' }}>
                            Mín: S/ {prod.minAdelanto.toFixed(2)}
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem && onRemoveItem(prod.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px 6px', fontSize: '15px' }}
                          title="Quitar de la bolsa"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modo Staff */}
                {esStaff && (
                  <div style={{ background: '#0D1117', border: '1px solid var(--color-cyan)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>
                        🛡️ Operación de Staff: {usuarioActual.nombre}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className={`auth-tab-btn ${reservarParaCliente ? 'active' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '4px' }}
                          onClick={() => {
                            setReservarParaCliente(true);
                            setNombre('');
                            setTelefono('');
                            setEmail('');
                          }}
                        >
                          A nombre de un Cliente
                        </button>
                        <button
                          type="button"
                          className={`auth-tab-btn ${!reservarParaCliente ? 'active' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '4px' }}
                          onClick={() => {
                            setReservarParaCliente(false);
                            setNombre(usuarioActual.nombre || '');
                            setTelefono(usuarioActual.telefono || '');
                            setEmail(usuarioActual.email || '');
                          }}
                        >
                          Auto-reserva (Para mí)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Datos de cliente si no es auto-reserva */}
                  {(!esStaff || reservarParaCliente) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <label>
                        Nombre del Titular *
                        <input
                          required
                          value={nombre}
                          onChange={e => setNombre(e.target.value)}
                          placeholder="Ej: César Sánchez"
                        />
                      </label>
                      <label>
                        Teléfono / WhatsApp *
                        <input
                          required
                          value={telefono}
                          onChange={e => setTelefono(e.target.value)}
                          placeholder="Ej: 999 888 777"
                        />
                      </label>
                    </div>
                  )}

                  {(!esStaff || reservarParaCliente) && (
                    <label style={{ marginBottom: '12px' }}>
                      Correo Electrónico (Opcional)
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                      />
                    </label>
                  )}

                  {/* Adelanto */}
                  <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#8B949E' }}>Adelanto Total para los {items.length} Kits:</span>
                      <strong style={{ color: 'var(--color-cyan)', fontSize: '13px' }}>
                        Mínimo acumulado: S/ {adelantoMinimoTotal.toFixed(2)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8B949E', fontSize: '13px' }}>S/</span>
                        <input
                          type="number"
                          step="0.01"
                          min={adelantoMinimoTotal}
                          max={totalCompra}
                          required
                          value={adelantoManual}
                          onChange={e => setAdelantoManual(e.target.value)}
                          style={{ paddingLeft: '28px', width: '100%', fontSize: '14px', fontWeight: 'bold' }}
                        />
                      </div>
                      <button
                        type="button"
                        className="secondary"
                        style={{ fontSize: '11px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                        onClick={() => setAdelantoManual(adelantoMinimoTotal.toFixed(2))}
                      >
                        Pagar Solo Mínimo
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ fontSize: '11px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                        onClick={() => setAdelantoManual(totalCompra.toFixed(2))}
                      >
                        Pagar Total (100%)
                      </button>
                    </div>
                  </div>

                  <div className="reserva-breakdown">
                    <div className="reserva-breakdown-row">
                      <span>Total de la Compra ({items.length} productos):</span>
                      <strong>S/ {totalCompra.toFixed(2)}</strong>
                    </div>
                    <div className="reserva-breakdown-row" style={{ color: '#10B981' }}>
                      <span>Adelanto Mínimo Total Requerido:</span>
                      <strong>S/ {adelantoMinimoTotal.toFixed(2)}</strong>
                    </div>
                    <div className="reserva-breakdown-row" style={{ color: 'var(--color-cyan)' }}>
                      <span>Adelanto que se Abonará:</span>
                      <strong>S/ {adelantoNum.toFixed(2)}</strong>
                    </div>
                    <div className="reserva-breakdown-row" style={{ color: 'var(--color-gold)', fontSize: '15px' }}>
                      <span>Saldo Pendiente contra Entrega:</span>
                      <strong>S/ {saldoPendiente.toFixed(2)}</strong>
                    </div>
                  </div>

                  <label>
                    Modalidad de Retiro / Notas Generales
                    <input
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      placeholder="Ej: Retiro en feria de Lima / En vivo TikTok"
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="submit"
                      className="primary"
                      style={{ flex: 1 }}
                      disabled={loading}
                    >
                      {loading ? 'Generando reservas...' : `Confirmar Reserva de ${items.length} Kits (S/ ${adelantoNum.toFixed(2)})`}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      Seguir Comprando
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
            <h4 style={{ color: '#10B981', margin: '0 0 10px', fontSize: '18px' }}>
              ¡Reserva múltiple generada con éxito!
            </h4>
            <p style={{ color: '#C9D1D9', fontSize: '13.5px', margin: '0 0 16px' }}>
              Se apartaron <strong>{reservasConfirmadas.length} unidades</strong>. Guarda tus códigos correlativos:
            </p>

            <div style={{ background: '#0D1117', border: '2px dashed var(--color-cyan)', borderRadius: '8px', padding: '14px', margin: '14px 0', textAlign: 'left' }}>
              <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Códigos de Seguimiento Individuales:
              </span>
              {reservasConfirmadas.map(res => (
                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #21262D', fontSize: '13px' }}>
                  <span style={{ color: '#FFFFFF' }}>{res.producto?.nombre || 'Producto'}</span>
                  <strong style={{ color: 'var(--color-cyan)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{res.codigoSeguimiento}</strong>
                </div>
              ))}
            </div>

            <div className="reserva-breakdown" style={{ textAlign: 'left', marginBottom: '14px' }}>
              <div className="reserva-breakdown-row">
                <span>Cliente:</span>
                <span>{reservasConfirmadas[0]?.nombreCliente} ({reservasConfirmadas[0]?.telefonoCliente})</span>
              </div>
              <div className="reserva-breakdown-row">
                <span>Adelanto Total Registrado:</span>
                <strong style={{ color: '#10B981' }}>S/ {adelantoNum.toFixed(2)}</strong>
              </div>
              <div className="reserva-breakdown-row">
                <span>Saldo Pendiente Total:</span>
                <strong style={{ color: 'var(--color-gold)' }}>S/ {saldoPendiente.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={getWhatsAppMultiLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="primary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: '#25D366',
                    color: '#000000',
                    textDecoration: 'none',
                    fontWeight: 'bold'
                  }}
                >
                  💬 Coordinar Reserva por WhatsApp
                </a>

                <button
                  type="button"
                  className="secondary"
                  onClick={handleCopiarCodigos}
                  style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
                >
                  {copiado ? '✅ ¡Copiado!' : '📋 Copiar Códigos'}
                </button>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={handleClose}
                style={{ width: '100%', padding: '10px' }}
              >
                Cerrar y Regresar al Catálogo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
