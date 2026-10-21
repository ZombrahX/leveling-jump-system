import { useState, useEffect } from 'react';
import { reservaService } from '../services/reservaService';
import { reservaPoliticaService, MODOS_POLITICA } from '../services/reservaPoliticaService';

export default function ReservationModal({ isOpen, producto, onClose, usuarioActual }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [adelanto, setAdelanto] = useState('');
  const [porcentajeInput, setPorcentajeInput] = useState('');
  const [notas, setNotas] = useState('Retiro en feria del sábado / TikTok Live');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reservaConfirmada, setReservaConfirmada] = useState(null);

  // Detección de staff y modo de reserva (cliente vs auto-reserva)
  const esStaff = usuarioActual && (usuarioActual.rol === 'SUPERADMIN' || usuarioActual.rol === 'ADMIN');
  const [reservarParaCliente, setReservarParaCliente] = useState(false);

  // Política comercial activa para este producto
  const [politica, setPolitica] = useState(() => reservaPoliticaService.obtenerPoliticaGlobal());

  // Panel de configuración (exclusivo para Staff)
  const [showConfigPcts, setShowConfigPcts] = useState(false);
  const [configModo, setConfigModo] = useState(MODOS_POLITICA.ESTANDAR);
  const [customP1, setCustomP1] = useState('20');
  const [customP2, setCustomP2] = useState('50');
  const [configFeedback, setConfigFeedback] = useState('');

  const total = Number(producto?.precio || 0);

  // Carga inicial al abrir el modal
  useEffect(() => {
    if (isOpen && producto) {
      setError('');
      setReservaConfirmada(null);
      setShowConfigPcts(false);
      setConfigFeedback('');

      // Cargar política comercial específica del producto o global
      const pol = reservaPoliticaService.obtenerPoliticaProducto(producto.id);
      setPolitica(pol);
      setConfigModo(pol.modo || MODOS_POLITICA.ESTANDAR);
      setCustomP1(String(pol.p1 || 20));
      setCustomP2(String(pol.p2 || 50));

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

      // Adelanto inicial sugerido según la política activa
      const precioTotal = Number(producto.precio || 0);
      if (pol.modo === MODOS_POLITICA.PAGO_TOTAL) {
        setAdelanto(precioTotal.toFixed(2));
        setPorcentajeInput('100');
      } else if (pol.modo === MODOS_POLITICA.CINCUENTA_TOTAL) {
        const sugerido50 = Number(((precioTotal * 50) / 100).toFixed(2));
        setAdelanto(String(sugerido50));
        setPorcentajeInput('50');
      } else {
        const pctInicial = pol.p1 || 20;
        const sugerido = Number(((precioTotal * pctInicial) / 100).toFixed(2));
        setAdelanto(String(sugerido));
        setPorcentajeInput(String(pctInicial));
      }
    }
  }, [isOpen, producto, usuarioActual]);

  if (!isOpen || !producto) return null;

  const adelantoNum = Number(adelanto) || 0;
  const saldoPendiente = Math.max(0, total - adelantoNum);

  // Sincronización bidireccional entre Soles (S/) y Porcentaje (%)
  const handleAdelantoSolesChange = val => {
    setAdelanto(val);
    const num = Number(val);
    if (!isNaN(num) && total > 0) {
      const pct = Math.min(100, Math.max(0, (num / total) * 100));
      setPorcentajeInput(pct.toFixed(2));
    } else {
      setPorcentajeInput('');
    }
  };

  const handlePorcentajeChange = val => {
    setPorcentajeInput(val);
    const pct = Number(val);
    if (!isNaN(pct) && total > 0) {
      const soles = Math.min(total, Math.max(0, (total * pct) / 100));
      setAdelanto(soles.toFixed(2));
    } else {
      setAdelanto('');
    }
  };

  const setPctAdelanto = pct => {
    const calc = Number(((total * pct) / 100).toFixed(2));
    setAdelanto(String(calc));
    setPorcentajeInput(String(pct));
  };

  // Acciones de configuración para Staff
  const handleGuardarProducto1x1 = () => {
    const p1 = Math.max(1, Math.min(99, Number(customP1) || 20));
    const p2 = Math.max(1, Math.min(99, Number(customP2) || 50));
    const nueva = reservaPoliticaService.guardarPoliticaProducto(producto.id, {
      modo: configModo,
      p1,
      p2
    });
    setPolitica({ ...nueva, esEspecifica: true });
    setConfigFeedback('✅ Política guardada para este producto.');
    
    // Actualizar selección activa de adelanto
    if (configModo === MODOS_POLITICA.PAGO_TOTAL) {
      setPctAdelanto(100);
    } else if (configModo === MODOS_POLITICA.CINCUENTA_TOTAL) {
      setPctAdelanto(50);
    } else {
      setPctAdelanto(p1);
    }
    setTimeout(() => setConfigFeedback(''), 3500);
  };

  const handleAplicarATodos = () => {
    if (!window.confirm('¿Confirmas aplicar esta política comercial a todos los productos del catálogo?')) {
      return;
    }
    const p1 = Math.max(1, Math.min(99, Number(customP1) || 20));
    const p2 = Math.max(1, Math.min(99, Number(customP2) || 50));
    const globalActualizada = reservaPoliticaService.aplicarATodosDeGolpe(configModo, p1, p2);
    setPolitica({ ...globalActualizada, esEspecifica: false });
    setConfigFeedback('✅ Política comercial aplicada a todos los productos.');

    if (configModo === MODOS_POLITICA.PAGO_TOTAL) {
      setPctAdelanto(100);
    } else if (configModo === MODOS_POLITICA.CINCUENTA_TOTAL) {
      setPctAdelanto(50);
    } else {
      setPctAdelanto(p1);
    }
    setTimeout(() => setConfigFeedback(''), 3500);
  };

  const handleRestablecerGlobal = () => {
    reservaPoliticaService.removerPoliticaProducto(producto.id);
    const global = reservaPoliticaService.obtenerPoliticaGlobal();
    setPolitica({ ...global, esEspecifica: false });
    setConfigModo(global.modo);
    setCustomP1(String(global.p1));
    setCustomP2(String(global.p2));
    setConfigFeedback('🔄 Restablecido a la política general de la tienda.');
    setPctAdelanto(global.p1);
    setTimeout(() => setConfigFeedback(''), 3000);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('Por favor ingresa el nombre completo del cliente.');
      return;
    }
    if (!telefono.trim()) {
      setError('Por favor ingresa un número de WhatsApp para coordinar la entrega.');
      return;
    }

    // Validación según la política activa
    if (politica.modo === MODOS_POLITICA.PAGO_TOTAL && adelantoNum < total) {
      setError(`Este producto exclusivo requiere el pago total del 100% (S/ ${total.toFixed(2)}) para formalizar la reserva.`);
      return;
    }

    if (politica.modo === MODOS_POLITICA.CINCUENTA_TOTAL) {
      const min50 = Number(((total * 50) / 100).toFixed(2));
      if (adelantoNum < min50) {
        setError(`Este producto requiere un adelanto mínimo del 50% (S/ ${min50.toFixed(2)}).`);
        return;
      }
    }

    if (politica.modo === MODOS_POLITICA.ESTANDAR) {
      const minP1 = Number(((total * (politica.p1 || 20)) / 100).toFixed(2));
      if (adelantoNum < minP1) {
        setError(`El adelanto mínimo configurado para este kit es de S/ ${minP1.toFixed(2)} (${politica.p1}%).`);
        return;
      }
    }

    if (adelantoNum < 0 || adelantoNum > total) {
      setError(`El adelanto debe ser entre S/ 0 y S/ ${total.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await reservaService.crearReserva({
        idProducto: producto.id,
        nombreCliente: nombre.trim(),
        telefonoCliente: telefono.trim(),
        emailCliente: email ? email.trim() : null,
        montoTotal: total,
        montoAdelanto: adelantoNum,
        notas: notas.trim(),
        idUsuario: usuarioActual ? usuarioActual.id : null
      });

      setReservaConfirmada(res.reserva);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la reserva.');
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (codigo) => {
    const text = encodeURIComponent(
      `¡Hola Leveling Jump! Acabo de registrar mi reserva con código *${codigo}* para el kit *${producto.nombre}*. Adelanto registrado: S/ ${adelantoNum.toFixed(2)}, saldo pendiente: S/ ${saldoPendiente.toFixed(2)}.`
    );
    return `https://wa.me/51999999999?text=${text}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>
            {reservaConfirmada ? 'RESERVA CONFIRMADA' : 'RESERVAR PRODUCTO'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>{error}</div>}

        {!reservaConfirmada ? (
          <div>
            {/* Header del producto a reservar */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#0D1117', padding: '12px 14px', borderRadius: '8px', border: '1px solid #30363D', marginBottom: '16px' }}>
              {producto.imagenUrl ? (
                <img
                  src={producto.imagenUrl}
                  alt={producto.nombre}
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #30363D' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {producto.marca} · {producto.categoria?.replaceAll('_', ' ')}
                </span>
                <h4 style={{ margin: '2px 0 4px', fontSize: '15px', color: '#FFFFFF' }}>{producto.nombre}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Precio de Venta:</span>
                  <strong style={{ fontSize: '16px', color: 'var(--color-cyan)' }}>S/ {total.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Aviso de Política Especial para el Cliente */}
            {politica.modo === MODOS_POLITICA.PAGO_TOTAL && (
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid #F59E0B', borderRadius: '6px', padding: '9px 12px', marginBottom: '14px', fontSize: '12.5px', color: '#FCD34D', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⭐</span>
                <span><strong>Kit Exclusivo / Pedido Especial:</strong> Este producto requiere reserva con el 100% de pago total.</span>
              </div>
            )}

            {politica.modo === MODOS_POLITICA.CINCUENTA_TOTAL && (
              <div style={{ background: 'rgba(0, 210, 238, 0.08)', border: '1px solid var(--color-cyan)', borderRadius: '6px', padding: '9px 12px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💡</span>
                <span><strong>Reserva Económica:</strong> Adelanto mínimo del 50% requerido (o pago total).</span>
              </div>
            )}

            {/* Modo de operación para Staff / Admin */}
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
                Correo Electrónico (para comprobante oficial)
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                />
              </label>

              {/* Doble entrada sincronizada: Monto en Soles (S/) y Porcentaje (%) */}
              <div className="two" style={{ marginTop: '4px' }}>
                <label>
                  Adelanto en Soles (S/) *
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={adelanto}
                    onChange={e => handleAdelantoSolesChange(e.target.value)}
                    placeholder="0.00"
                    disabled={politica.modo === MODOS_POLITICA.PAGO_TOTAL}
                    required
                  />
                </label>

                <label>
                  Equivalente en Porcentaje (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={porcentajeInput}
                    onChange={e => handlePorcentajeChange(e.target.value)}
                    placeholder="20"
                    disabled={politica.modo === MODOS_POLITICA.PAGO_TOTAL}
                  />
                </label>
              </div>

              {/* Encabezado de accesos rápidos y botón de configuración SOLO para Staff */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
                <span style={{ fontSize: '11.5px', color: '#8B949E' }}>
                  Opciones de adelanto:
                </span>
                {esStaff && (
                  <button
                    type="button"
                    onClick={() => setShowConfigPcts(prev => !prev)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-cyan)', fontSize: '11.5px', cursor: 'pointer', padding: 0 }}
                  >
                    ⚙️ {showConfigPcts ? 'Cerrar ajustes' : 'Personalizar %'}
                  </button>
                )}
              </div>

              {/* Panel de Configuración de Políticas de Reserva (EXCLUSIVO PARA STAFF) */}
              {esStaff && showConfigPcts && (
                <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '12.5px', color: 'var(--color-cyan)' }}>
                      Configuración de Política de Reserva
                    </strong>
                    <span style={{ fontSize: '11px', color: politica.esEspecifica ? '#F59E0B' : '#8B949E' }}>
                      {politica.esEspecifica ? '📌 Regla específica de este producto' : '🌐 Regla general de tienda'}
                    </span>
                  </div>

                  {configFeedback && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#6EE7B7', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', marginBottom: '10px' }}>
                      {configFeedback}
                    </div>
                  )}

                  {/* Selector de los 3 casos comerciales */}
                  <label style={{ fontSize: '12px', marginBottom: '8px' }}>
                    Seleccionar Caso de Reserva:
                    <select
                      value={configModo}
                      onChange={e => setConfigModo(e.target.value)}
                      style={{ fontSize: '12px', padding: '6px 8px', marginTop: '4px' }}
                    >
                      <option value={MODOS_POLITICA.ESTANDAR}>
                        Caso 1: Estándar / Flexible (3 tramos: Mínimo %, Intermedio % y 100%)
                      </option>
                      <option value={MODOS_POLITICA.CINCUENTA_TOTAL}>
                        Caso 2: Económico (2 tramos: Mínimo 50% y Total 100%)
                      </option>
                      <option value={MODOS_POLITICA.PAGO_TOTAL}>
                        Caso 3: Exclusivo / Especial (1 tramo: 100% Pago Total)
                      </option>
                    </select>
                  </label>

                  {/* Campos de porcentaje si está en modo Estándar */}
                  {configModo === MODOS_POLITICA.ESTANDAR && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '8px 0' }}>
                      <label style={{ margin: 0, fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Mínimo %:
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="99"
                          value={customP1}
                          onChange={e => setCustomP1(e.target.value)}
                          style={{ width: '70px', padding: '4px 6px', fontSize: '12px' }}
                        />
                      </label>
                      <label style={{ margin: 0, fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Intermedio %:
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="99"
                          value={customP2}
                          onChange={e => setCustomP2(e.target.value)}
                          style={{ width: '70px', padding: '4px 6px', fontSize: '12px' }}
                        />
                      </label>
                    </div>
                  )}

                  {/* Botones de acción para Staff */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="primary"
                      style={{ padding: '6px 12px', fontSize: '11.5px', flex: 1 }}
                      onClick={handleGuardarProducto1x1}
                    >
                      Guardar para este producto
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ padding: '6px 12px', fontSize: '11.5px', flex: 1, borderColor: 'var(--color-cyan)', color: 'var(--color-cyan)' }}
                      onClick={handleAplicarATodos}
                      title="Aplica esta política a todos los productos del catálogo"
                    >
                      Aplicar a todos
                    </button>
                    {politica.esEspecifica && (
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '6px 10px', fontSize: '11px' }}
                        onClick={handleRestablecerGlobal}
                        title="Revertir este producto para que siga la regla general"
                      >
                        Restablecer a general
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de selección rápida según la política activa */}
              <div className="reserva-quick-btns">
                {politica.modo === MODOS_POLITICA.PAGO_TOTAL && (
                  <button
                    type="button"
                    className="reserva-quick-btn active"
                    style={{ background: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B', color: '#FCD34D', fontWeight: 'bold' }}
                    onClick={() => setPctAdelanto(100)}
                  >
                    ⭐ Pago Total 100% (S/ {total.toFixed(2)})
                  </button>
                )}

                {politica.modo === MODOS_POLITICA.CINCUENTA_TOTAL && (
                  <>
                    <button
                      type="button"
                      className="reserva-quick-btn"
                      onClick={() => setPctAdelanto(50)}
                    >
                      Mínimo 50% (S/ {((total * 50) / 100).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      className="reserva-quick-btn"
                      onClick={() => setPctAdelanto(100)}
                    >
                      Total 100% (S/ {total.toFixed(2)})
                    </button>
                  </>
                )}

                {politica.modo === MODOS_POLITICA.ESTANDAR && (
                  <>
                    <button
                      type="button"
                      className="reserva-quick-btn"
                      onClick={() => setPctAdelanto(politica.p1 || 20)}
                    >
                      Mínimo {politica.p1 || 20}% (S/ {((total * (politica.p1 || 20)) / 100).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      className="reserva-quick-btn"
                      onClick={() => setPctAdelanto(politica.p2 || 50)}
                    >
                      {politica.p2 || 50}% (S/ {((total * (politica.p2 || 50)) / 100).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      className="reserva-quick-btn"
                      onClick={() => setPctAdelanto(100)}
                    >
                      Total 100% (S/ {total.toFixed(2)})
                    </button>
                  </>
                )}
              </div>

              {/* Desglose en tiempo real */}
              <div className="reserva-breakdown">
                <div className="reserva-breakdown-row">
                  <span>Precio Total:</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
                <div className="reserva-breakdown-row" style={{ color: '#10B981' }}>
                  <span>Adelanto a Abonar ({porcentajeInput ? `${porcentajeInput}%` : 'Personalizado'}):</span>
                  <span>S/ {adelantoNum.toFixed(2)}</span>
                </div>
                <div className="reserva-breakdown-row" style={{ color: 'var(--color-gold)', fontSize: '15px' }}>
                  <span>Saldo Restante contra Entrega:</span>
                  <span>S/ {saldoPendiente.toFixed(2)}</span>
                </div>
              </div>

              <label>
                Modalidad de Retiro / Notas
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Retiro en feria de Lima / En vivo TikTok"
                />
              </label>

              <button className="primary" style={{ width: '100%', marginTop: '14px' }} disabled={loading}>
                {loading ? 'Generando reserva...' : `Confirmar Reserva con S/ ${adelantoNum.toFixed(2)}`}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
            <h4 style={{ color: '#10B981', margin: '0 0 10px', fontSize: '18px' }}>
              ¡Unidad reservada con éxito!
            </h4>
            <p style={{ color: '#C9D1D9', fontSize: '13.5px', margin: '0 0 16px' }}>
              Guarda tu código correlativo oficial de seguimiento:
            </p>

            <div style={{ background: '#0D1117', border: '2px dashed var(--color-cyan)', borderRadius: '8px', padding: '16px', margin: '14px 0' }}>
              <span style={{ fontSize: '11px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '1px', display: 'block' }}>
                Código de Reserva Leveling Jump
              </span>
              <strong style={{ fontSize: '28px', color: 'var(--color-cyan)', fontFamily: 'monospace', letterSpacing: '3px' }}>
                {reservaConfirmada.codigoSeguimiento}
              </strong>
            </div>

            <div className="reserva-breakdown" style={{ textAlign: 'left' }}>
              <div className="reserva-breakdown-row">
                <span>Producto:</span>
                <strong style={{ color: '#FFFFFF' }}>{producto.nombre}</strong>
              </div>
              <div className="reserva-breakdown-row">
                <span>Cliente:</span>
                <span>{reservaConfirmada.nombreCliente} ({reservaConfirmada.telefonoCliente})</span>
              </div>
              <div className="reserva-breakdown-row">
                <span>Adelanto Registrado:</span>
                <strong style={{ color: '#10B981' }}>S/ {Number(reservaConfirmada.montoAdelanto).toFixed(2)}</strong>
              </div>
              <div className="reserva-breakdown-row">
                <span>Saldo Pendiente:</span>
                <strong style={{ color: 'var(--color-gold)' }}>S/ {Number(reservaConfirmada.saldoPendiente).toFixed(2)}</strong>
              </div>
            </div>

            {reservaConfirmada.emailCliente && (
              <small style={{ color: '#8B949E', display: 'block', margin: '12px 0 16px' }}>
                ✉️ Se ha enviado el comprobante oficial a <strong>{reservaConfirmada.emailCliente}</strong>.
              </small>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <a
                href={getWhatsAppLink(reservaConfirmada.codigoSeguimiento)}
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
                💬 Coordinar por WhatsApp
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
