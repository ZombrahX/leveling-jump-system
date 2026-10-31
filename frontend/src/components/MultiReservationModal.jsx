import { useState, useEffect, useMemo } from 'react';
import { reservaService } from '../services/reservaService';
import { reservaPoliticaService, MODOS_POLITICA } from '../services/reservaPoliticaService';

export default function MultiReservationModal({
  isOpen,
  items = [],
  onClose,
  onRemoveItem,
  onClearBag,
  usuarioActual,
  onReservaExitosa
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('Retiro conjunto en feria del sábado / TikTok Live');
  const [adelantoManual, setAdelantoManual] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reservasConfirmadas, setReservasConfirmadas] = useState(null);

  // Detección de staff y modo de reserva
  const esStaff = usuarioActual && (usuarioActual.rol === 'SUPERADMIN' || usuarioActual.rol === 'ADMIN');
  const [reservarParaCliente, setReservarParaCliente] = useState(false);

  // Cálculo individual y global de políticas de reserva para cada kit
  const itemsConPolitica = useMemo(() => {
    return items.map(prod => {
      const pol = reservaPoliticaService.obtenerPoliticaProducto(prod.id);
      const precio = Number(prod.precio || 0);
      let minAdelanto = 0;
      let badgeLabel = '';
      let badgeColor = '';

      if (pol.modo === MODOS_POLITICA.PAGO_TOTAL) {
        minAdelanto = precio;
        badgeLabel = '⭐ Pago 100%';
        badgeColor = '#F59E0B';
      } else if (pol.modo === MODOS_POLITICA.CINCUENTA_TOTAL) {
        minAdelanto = Number(((precio * 50) / 100).toFixed(2));
        badgeLabel = '💡 Mínimo 50%';
        badgeColor = '#0284C7';
      } else {
        const pct = pol.p1 || 20;
        minAdelanto = Number(((precio * pct) / 100).toFixed(2));
        badgeLabel = `🔖 Mínimo ${pct}%`;
        badgeColor = '#10B981';
      }

      return {
        ...prod,
        precio,
        politica: pol,
        minAdelanto,
        badgeLabel,
        badgeColor
      };
    });
  }, [items]);

  const totalCompra = useMemo(() => {
    return itemsConPolitica.reduce((acc, curr) => acc + curr.precio, 0);
  }, [itemsConPolitica]);

  const adelantoMinimoTotal = useMemo(() => {
    return itemsConPolitica.reduce((acc, curr) => acc + curr.minAdelanto, 0);
  }, [itemsConPolitica]);

  // Al abrir el modal o cambiar la bolsa, sincronizar datos iniciales
  useEffect(() => {
    if (isOpen) {
      setError('');
      setReservasConfirmadas(null);
      if (usuarioActual) {
        setNombre(usuarioActual.nombre || '');
        setEmail(usuarioActual.email || '');
        setTelefono(usuarioActual.telefono || '');
        setReservarParaCliente(false);
      } else {
        setNombre('');
        setTelefono('');
        setEmail('');
        setReservarParaCliente(false);
      }
      setAdelantoManual(adelantoMinimoTotal.toFixed(2));
    }
  }, [isOpen, usuarioActual, adelantoMinimoTotal]);

  if (!isOpen) return null;

  const adelantoNum = Number(adelantoManual) || 0;
  const saldoPendiente = Math.max(0, totalCompra - adelantoNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (items.length === 0) {
      setError('La bolsa de reserva no tiene productos.');
      return;
    }

    // P08: Validar que ningún producto en la bolsa esté agotado
    const itemsAgotados = items.filter(it => it.stockDisponible !== undefined && it.stockDisponible <= 0);
    if (itemsAgotados.length > 0) {
      setError(`No se puede procesar la reserva múltiple: los siguientes kits están agotados: ${itemsAgotados.map(it => it.nombre).join(', ')}. Retíralos de la bolsa para continuar.`);
      return;
    }

    if (!nombre.trim()) {
      setError('Por favor ingresa el nombre del comprador.');
      return;
    }
    if (!telefono.trim()) {
      setError('Por favor ingresa un número de WhatsApp para coordinar la entrega.');
      return;
    }

    if (adelantoNum < adelantoMinimoTotal) {
      setError(`El adelanto total debe ser al menos de S/ ${adelantoMinimoTotal.toFixed(2)} según las políticas mínimas de los kits seleccionados.`);
      return;
    }

    if (adelantoNum > totalCompra) {
      setError(`El adelanto no puede exceder el monto total de la compra (S/ ${totalCompra.toFixed(2)}).`);
      return;
    }

    setLoading(true);
    try {
      // Distribuir el adelanto total entre los items proporcionalmente al mínimo requerido
      const excedente = Math.max(0, adelantoNum - adelantoMinimoTotal);
      const sumaPrecios = totalCompra;

      const itemsParaRegistrar = itemsConPolitica.map(item => {
        // Base mínima
        let asignado = item.minAdelanto;
        if (excedente > 0 && sumaPrecios > 0) {
          // Reparto proporcional del excedente
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

      setReservasConfirmadas(creadas);
      if (onClearBag) onClearBag();
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3>
            {reservasConfirmadas ? 'RESERVA MÚLTIPLE CONFIRMADA' : `BOLSA DE RESERVA (${items.length} PRODUCTOS)`}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>{error}</div>}

        {!reservasConfirmadas ? (
          <div>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8B949E' }}>
                <span style={{ fontSize: '38px', display: 'block', marginBottom: '8px' }}>🛒</span>
                <strong>Tu bolsa de reserva está vacía.</strong>
                <p style={{ fontSize: '13px', margin: '6px 0 16px' }}>Explora el catálogo y añade los kits que desees apartar en un solo pedido.</p>
                <button type="button" className="secondary" onClick={onClose}>Volver al Catálogo</button>
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
                  <div className="two">
                    <label>
                      {reservarParaCliente ? 'Nombre del Cliente (Comprador) *' : 'Nombre Completo *'}
                      <input
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Ej: Carlos Gómez"
                        required
                      />
                    </label>

                    <label>
                      {reservarParaCliente ? 'WhatsApp del Cliente *' : 'WhatsApp / Celular *'}
                      <input
                        value={telefono}
                        onChange={e => setTelefono(e.target.value)}
                        placeholder="Ej: 987 654 321"
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Correo Electrónico (para comprobantes de la orden)
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                    />
                  </label>

                  {/* Configuración de Adelanto Total Combinado */}
                  <div className="two" style={{ marginTop: '6px' }}>
                    <label>
                      Adelanto Total a Abonar (S/) *
                      <input
                        type="number"
                        min={adelantoMinimoTotal}
                        max={totalCompra}
                        step="0.01"
                        value={adelantoManual}
                        onChange={e => setAdelantoManual(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </label>

                    <div>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        Atajos de Adelanto
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="secondary"
                          style={{ flex: 1, padding: '9px 8px', fontSize: '11.5px' }}
                          onClick={() => setAdelantoManual(adelantoMinimoTotal.toFixed(2))}
                        >
                          Mínimo (S/ {adelantoMinimoTotal.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          style={{ flex: 1, padding: '9px 8px', fontSize: '11.5px' }}
                          onClick={() => setAdelantoManual(totalCompra.toFixed(2))}
                        >
                          Total (S/ {totalCompra.toFixed(2)})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Resumen económico consolidado */}
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
                      onClick={onClose}
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
                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #21262D', fontSize: '13px' }}>
                  <span style={{ color: '#FFFFFF' }}>{res.producto?.nombre || 'Producto'}</span>
                  <strong style={{ color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{res.codigoSeguimiento}</strong>
                </div>
              ))}
            </div>

            <div className="reserva-breakdown" style={{ textAlign: 'left' }}>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
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
                💬 Coordinar Reserva Múltiple por WhatsApp
              </a>

              <button
                type="button"
                className="secondary"
                onClick={onClose}
                style={{ padding: '0 20px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
