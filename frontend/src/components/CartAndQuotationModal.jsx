import React, { useState } from 'react';
import { cotizacionService } from '../services/cotizacionService';

export default function CartAndQuotationModal({ isOpen, onClose, cart, setCart, onClearCart }) {
  const [activeTab, setActiveTab] = useState('cart'); // 'cart', 'consultar', 'resultado'
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [cotizacionGenerada, setCotizacionGenerada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  if (!isOpen) return null;

  const totalCarrito = cart.reduce((acc, item) => acc + (parseFloat(item.precio) * item.cantidad), 0);

  const handleUpdateCantidad = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const nuevaCant = item.cantidad + delta;
          return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleGenerarCotizacion = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    if (cart.length === 0) {
      setError('El carrito está vacío. Agrega productos desde el catálogo.');
      return;
    }

    if (!nombre.trim() || !telefono.trim()) {
      setError('Por favor ingresa tu nombre y número de WhatsApp.');
      return;
    }

    try {
      setCargando(true);
      const payload = {
        nombreCliente: nombre,
        telefonoCliente: telefono,
        emailCliente: email,
        observaciones,
        items: cart.map(i => ({ idProducto: i.id, cantidad: i.cantidad }))
      };

      const resp = await cotizacionService.crearCotizacion(payload);
      setCotizacionGenerada(resp.cotizacion);
      setExito(resp.mensaje);
      setActiveTab('resultado');
      if (onClearCart) onClearCart();
    } catch (err) {
      setError(err.message || 'Error al generar la cotización.');
    } finally {
      setCargando(false);
    }
  };

  const handleBuscarCotizacion = async (e) => {
    e.preventDefault();
    setError('');
    if (!codigoBusqueda.trim()) return;

    try {
      setCargando(true);
      const resp = await cotizacionService.obtenerPorCodigo(codigoBusqueda.trim());
      setCotizacionGenerada(resp.cotizacion);
      setActiveTab('resultado');
    } catch (err) {
      setError(err.message || 'Cotización no encontrada.');
    } finally {
      setCargando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleCompartirWhatsApp = () => {
    if (!cotizacionGenerada) return;
    const msg = encodeURIComponent(
      `¡Hola Leveling Jump! Solicito confirmar mi cotización oficial *${cotizacionGenerada.codigoCotizacion}* por un total de *S/ ${parseFloat(cotizacionGenerada.total).toFixed(2)}* emitida a nombre de ${cotizacionGenerada.nombreCliente}.`
    );
    window.open(`https://wa.me/51988888777?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛒</span>
            <div>
              <h2 className="text-xl font-bold text-white">Carrito de Compras y Cotizaciones</h2>
              <p className="text-xs text-slate-400">HU-02 / HU-07 — Gestión comercial formal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('cart')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
              activeTab === 'cart'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🛍️ Mi Carrito ({cart.reduce((a, b) => a + b.cantidad, 0)})
          </button>
          <button
            onClick={() => setActiveTab('consultar')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
              activeTab === 'consultar'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 Consultar Cotización
          </button>
          {cotizacionGenerada && (
            <button
              onClick={() => setActiveTab('resultado')}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                activeTab === 'resultado'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📄 Hoja de Cotización
            </button>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm">
              ⚠️ {error}
            </div>
          )}
          {exito && (
            <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-200 text-sm">
              ✅ {exito}
            </div>
          )}

          {/* TAB 1: CARRITO Y GENERADOR DE COTIZACIÓN */}
          {activeTab === 'cart' && (
            <div>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🛍️</div>
                  <h3 className="text-lg font-medium text-slate-200">Tu carrito comercial está vacío</h3>
                  <p className="text-slate-400 text-sm mt-1">Explora el catálogo y agrega maquetas o suministros.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Lista de productos */}
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50"
                      >
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-semibold text-white">{item.nombre}</h4>
                          <span className="text-xs text-indigo-400 font-mono">
                            S/ {parseFloat(item.precio).toFixed(2)} c/u
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg">
                            <button
                              onClick={() => handleUpdateCantidad(item.id, -1)}
                              className="px-2.5 py-1 text-slate-400 hover:text-white"
                            >
                              -
                            </button>
                            <span className="px-2 text-sm font-bold text-white">{item.cantidad}</span>
                            <button
                              onClick={() => handleUpdateCantidad(item.id, 1)}
                              className="px-2.5 py-1 text-slate-400 hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 w-20 text-right">
                            S/ {(parseFloat(item.precio) * item.cantidad).toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                            title="Quitar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de totales */}
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between text-slate-400 text-sm">
                      <span>Moneda comercial:</span>
                      <span className="font-semibold text-slate-300">PEN (Soles peruanos S/)</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-slate-800">
                      <span>Importe Total:</span>
                      <span className="text-emerald-400 font-mono">S/ {totalCarrito.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-amber-400/90 pt-1">
                      ℹ️ El carrito es una selección temporal y no bloquea inventario. La cotización formal verifica stock activo antes de emitirse y congela precios por 7 días.
                    </p>
                  </div>

                  {/* Formulario de Cotización Formal (HU-07) */}
                  <form onSubmit={handleGenerarCotizacion} className="space-y-4 pt-2 border-t border-slate-800">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>📋</span> Solicitar Cotización Formal Oficial (HU-07)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Tu Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          value={nombre}
                          onChange={e => setNombre(e.target.value)}
                          placeholder="Ej: César Sánchez"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Teléfono / WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          value={telefono}
                          onChange={e => setTelefono(e.target.value)}
                          placeholder="Ej: 999 888 777"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Correo Electrónico (Opcional)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Notas o Consultas Adicionales</label>
                      <input
                        type="text"
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Ej: Deseo retirar en feria de Arenales o envío a Trujillo"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={cargando}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {cargando ? 'Generando Cotización...' : '📄 Generar Cotización Oficial'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONSULTAR COTIZACIÓN POR CÓDIGO */}
          {activeTab === 'consultar' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Ingresa el código correlativo de tu cotización (ej. <code>COT-2026-1234</code>) para revisar su vigencia y detalle de productos.
              </p>
              <form onSubmit={handleBuscarCotizacion} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={codigoBusqueda}
                  onChange={e => setCodigoBusqueda(e.target.value.toUpperCase())}
                  placeholder="COT-2026-XXXX"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={cargando}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition disabled:opacity-50"
                >
                  {cargando ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: VISTA DE LA COTIZACIÓN FORMAL (IMPRIMIBLE) */}
          {activeTab === 'resultado' && cotizacionGenerada && (
            <div className="space-y-6">
              {/* Documento oficial */}
              <div id="hoja-cotizacion" className="bg-white text-slate-900 p-6 rounded-2xl shadow-xl space-y-5 border border-slate-200">
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900">LEVELING JUMP</h3>
                    <p className="text-xs text-slate-500">Model Kits, Gunpla & Coleccionables de Importación</p>
                    <p className="text-xs text-slate-500">Lima, Perú | WhatsApp: +51 999 888 777</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1 rounded-md font-bold uppercase">
                      Cotización Formal
                    </span>
                    <h4 className="text-lg font-black text-indigo-600 font-mono mt-1">
                      {cotizacionGenerada.codigoCotizacion}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Emisión: {new Date(cotizacionGenerada.fechaEmision).toLocaleDateString('es-PE')}
                    </p>
                    <p className="text-xs text-amber-600 font-semibold">
                      Válida hasta: {new Date(cotizacionGenerada.fechaVencimiento).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                </div>

                {/* Cliente */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700">CLIENTE:</p>
                    <p className="text-slate-900 font-bold">{cotizacionGenerada.nombreCliente}</p>
                    <p className="text-slate-600">WhatsApp: {cotizacionGenerada.telefonoCliente}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">CORREO / NOTAS:</p>
                    <p className="text-slate-600">{cotizacionGenerada.emailCliente || 'No especificado'}</p>
                    <p className="text-slate-600 italic">{cotizacionGenerada.observaciones || 'Sin notas adicionales'}</p>
                  </div>
                </div>

                {/* Tabla de ítems */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 text-left">
                      <th className="py-2">Ítem / Producto</th>
                      <th className="py-2 text-center">Cant.</th>
                      <th className="py-2 text-right">P. Unitario</th>
                      <th className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cotizacionGenerada.items?.map(it => (
                      <tr key={it.id || it.idProducto}>
                        <td className="py-2.5 font-medium text-slate-800">{it.nombreProducto}</td>
                        <td className="py-2.5 text-center text-slate-600">{it.cantidad}</td>
                        <td className="py-2.5 text-right font-mono text-slate-600">
                          S/ {parseFloat(it.precioUnitario).toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                          S/ {parseFloat(it.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-800">
                      <td colSpan="3" className="py-2.5 text-right font-bold text-slate-700">TOTAL ESTIMADO:</td>
                      <td className="py-2.5 text-right font-mono font-black text-indigo-700 text-sm">
                        S/ {parseFloat(cotizacionGenerada.total).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Aviso legal obligatorio */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-2xs leading-relaxed">
                  ⚠️ <strong>Condiciones comerciales:</strong> Los precios cotizados se mantienen vigentes durante 7 días calendario a partir de su emisión. Esta cotización comercial <strong>no reserva stock físico en almacén</strong>. La separación de mercadería se efectiviza únicamente con el registro de reserva formal o pago de adelanto.
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleImprimir}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  🖨️ Imprimir / Guardar PDF
                </button>
                <button
                  onClick={handleCompartirWhatsApp}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  💬 Enviar por WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
