import React, { useState } from 'react';
import { interesService } from '../services/interesService';

export default function WaitlistModal({ isOpen, onClose, producto, usuarioActual }) {
  const [nombre, setNombre] = useState(usuarioActual?.nombre || '');
  const [telefono, setTelefono] = useState(usuarioActual?.telefono || '');
  const [email, setEmail] = useState(usuarioActual?.email || '');
  const [notas, setNotas] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  if (!isOpen || !producto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    if (!nombre.trim() || !telefono.trim()) {
      setError('Por favor indica tu nombre y teléfono/WhatsApp.');
      return;
    }

    try {
      setCargando(true);
      const resp = await interesService.registrarInteres({
        idProducto: producto.id,
        nombreCliente: nombre,
        telefonoCliente: telefono,
        emailCliente: email,
        notas
      });

      setExito(resp.mensaje);
      setTimeout(() => {
        onClose();
        setExito('');
      }, 2500);
    } catch (err) {
      setError(err.message || 'Error al registrar tu interés.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔔</span>
            <div>
              <h2 className="text-lg font-bold text-white">Lista de Espera / Restock</h2>
              <p className="text-xs text-slate-400">HU-08 — Alerta de reposición comercial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Ficha rápida del producto */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center gap-3 mb-4">
            {producto.imagenUrl ? (
              <img
                src={producto.imagenUrl}
                alt={producto.nombre}
                className="w-12 h-12 rounded-lg object-cover bg-slate-950"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-950 flex items-center justify-center text-xs text-slate-500 font-bold">
                LJ
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{producto.nombre}</h4>
              <p className="text-xs text-slate-400">{producto.marca || 'Marca'} · {producto.serie || 'Gunpla'}</p>
              <p className="text-xs font-bold text-indigo-400">
                {producto.precio ? `S/ ${parseFloat(producto.precio).toFixed(2)}` : 'Precio por confirmar'}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Este modelo se encuentra agotado o en proceso de importación. Déjanos tus datos para avisarte por WhatsApp apenas arribe un nuevo lote y tengas prioridad de reserva.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
              ⚠️ {error}
            </div>
          )}

          {exito && (
            <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs">
              ✅ {exito}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tu Nombre Completo *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: César Sánchez"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">WhatsApp de Contacto *</label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Ej: 999 888 777"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Correo Electrónico (Opcional)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu-correo@ejemplo.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Notas adicionales (Opcional)</label>
              <input
                type="text"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: ¿Llega la versión con base o solo el kit?"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                {cargando ? 'Anotando...' : '🔔 Avisarme cuando llegue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
