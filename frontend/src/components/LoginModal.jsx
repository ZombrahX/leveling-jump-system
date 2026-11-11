import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'registro' | 'otp' | 'google_setup'
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estados de formularios
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ nombre: '', email: '', password: '', telefono: '' });
  const [otpForm, setOtpForm] = useState({ email: '', codigo: '' });
  const [timer, setTimer] = useState(900); // 15 minutos en segundos

  // Client ID oficial de Google Cloud OAuth
  const OFFICIAL_GOOGLE_CLIENT_ID = '784626326160-u2cbelakbsulgog482jcjlrpb13dc38l.apps.googleusercontent.com';
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || OFFICIAL_GOOGLE_CLIENT_ID;
  const [inputClientId, setInputClientId] = useState(() => {
    return localStorage.getItem('lj_custom_google_client_id') || envClientId;
  });

  const hasValidClientId = !!inputClientId && inputClientId.includes('.apps.googleusercontent.com');

  useEffect(() => {
    try {
      localStorage.removeItem('lj_custom_google_client_id');
    } catch (_) {}
  }, []);

  // Limpiar mensajes y restablecer tab cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setLoading(false);
      setResending(false);
      setTab('login');
      setLoginForm({ email: '', password: '' });
      setRegForm({ nombre: '', email: '', password: '', telefono: '' });
      setOtpForm({ email: '', codigo: '' });
    }
  }, [isOpen]);

  useEffect(() => {
    let interval = null;
    if (tab === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [tab, timer]);

  const formatTimer = sec => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  // 1. Iniciar sesión tradicional
  const handleLogin = async e => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const data = await authService.login(loginForm.email, loginForm.password);
      setSuccessMsg(`¡Bienvenido de vuelta, ${data.usuario.nombre}!`);
      setTimeout(() => {
        onLoginSuccess(data.usuario);
        onClose();
      }, 700);
    } catch (err) {
      if (err.data && err.data.requiereVerificacion) {
        setOtpForm({ email: err.data.email, codigo: '' });
        setTab('otp');
        setTimer(900);
        setError(err.message);
      } else {
        setError(err.message || 'Credenciales inválidas.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Registro con código de verificación al correo
  const handleRegistro = async e => {
    e.preventDefault();
    resetMessages();
    if (regForm.password.length < 6) {
      setError('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.registro(regForm.nombre, regForm.email, regForm.password, regForm.telefono);
      if (res.emailEnviado === false) {
        setError(res.mensaje || 'Tu cuenta se creó, pero hubo demora al enviar el correo. Pulsa "Reenviar código".');
      } else {
        setSuccessMsg(res.mensaje || '¡Código de verificación enviado a tu correo!');
      }
      setOtpForm({ email: regForm.email, codigo: '' });
      setTimer(900);
      setTab('otp');
    } catch (err) {
      if (err.data && err.data.requiereVerificacion) {
        setOtpForm({ email: regForm.email, codigo: '' });
        setTimer(900);
        setTab('otp');
        setSuccessMsg(err.message || 'Ingresa el código de verificación.');
      } else {
        setError(err.message || 'No se pudo completar el registro.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Verificación de código de 6 dígitos
  const handleVerificarOtp = async e => {
    e.preventDefault();
    resetMessages();
    if (!otpForm.codigo || otpForm.codigo.trim().length !== 6) {
      setError('Ingresa el código numérico de 6 dígitos completo.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.verificarCodigo(otpForm.email, otpForm.codigo.trim());
      setSuccessMsg('¡Correo verificado con éxito! Iniciando sesión...');
      setTimeout(() => {
        onLoginSuccess(res.usuario);
        onClose();
      }, 800);
    } catch (err) {
      setError(err.message || 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Reenviar código
  const handleReenviarOtp = async () => {
    resetMessages();
    setResending(true);
    try {
      const res = await authService.reenviarCodigo(otpForm.email);
      setTimer(900);
      setSuccessMsg(res.mensaje || 'Se ha enviado un nuevo código a tu correo.');
    } catch (err) {
      setError(err.message || 'No se pudo reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  // 5. Autenticación Real de Google (Google Identity Services OAuth 2.0 nativo)
  const handleGoogleBtnClick = () => {
    resetMessages();
    setLoading(true);

    const client_id = OFFICIAL_GOOGLE_CLIENT_ID;

    const abrirVentanaGoogle = () => {
      try {
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
          throw new Error('Cargando servicios de Google... Por favor haz clic de nuevo en 2 segundos.');
        }

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id,
          scope: 'openid profile email',
          prompt: 'select_account',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setLoading(false);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                const desc = tokenResponse.error_description || tokenResponse.error;
                setError(`Google OAuth: ${desc}. Verifica que tu correo esté añadido en Usuarios de prueba en Google Cloud.`);
              }
              return;
            }

            try {
              // Obtener perfil verificado directamente desde Google UserInfo API
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const googleUser = await res.json();

              if (!googleUser.email) {
                throw new Error('Google no devolvió un correo válido.');
              }

              // Iniciar sesión / registrar en Leveling Jump
              const data = await authService.loginGoogle(googleUser.email, googleUser.name);
              setSuccessMsg(`¡Autenticado con Google (${googleUser.email})!`);
              setTimeout(() => {
                onLoginSuccess(data.usuario);
                onClose();
              }, 600);
            } catch (err) {
              setError(err.message || 'Error al autenticar en el servidor.');
            } finally {
              setLoading(false);
            }
          },
          error_callback: (err) => {
            setLoading(false);
            console.warn('Google OAuth error_callback:', err);
            setError(err?.message || 'Error al conectar con los servidores de Google.');
          }
        });

        // Abre la ventana emergente oficial de Google con el selector de cuentas
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        setLoading(false);
        setError(err.message || 'Error al inicializar Google OAuth.');
      }
    };

    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      abrirVentanaGoogle();
    } else {
      // Si el script aún no terminó de cargar en window, inyectarlo dinámicamente y ejecutar
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => abrirVentanaGoogle();
      script.onerror = () => {
        setLoading(false);
        setError('No se pudo cargar la librería de Google. Revisa tu conexión o bloqueador.');
      };
      document.head.appendChild(script);
    }
  };

  const handleSaveClientId = (e) => {
    e.preventDefault();
    if (!inputClientId.trim() || !inputClientId.includes('.apps.googleusercontent.com')) {
      setError('El Client ID debe tener el formato: xxxxxxxx.apps.googleusercontent.com');
      return;
    }
    localStorage.setItem('lj_custom_google_client_id', inputClientId.trim());
    setSuccessMsg('Client ID guardado. Recargando para activar la ventana emergente de Google...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const GoogleLogoSvg = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {tab === 'login' && 'INICIAR SESIÓN'}
            {tab === 'registro' && 'CREAR CUENTA'}
            {tab === 'otp' && 'VERIFICAR CÓDIGO'}
            {tab === 'google_setup' && 'CONEXIÓN CON GOOGLE'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {tab !== 'otp' && tab !== 'google_setup' && (
          <div className="auth-tabs">
            <button
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); resetMessages(); }}
            >
              Iniciar Sesión
            </button>
            <button
              className={`auth-tab-btn ${tab === 'registro' ? 'active' : ''}`}
              onClick={() => { setTab('registro'); resetMessages(); }}
            >
              Crear Cuenta
            </button>
          </div>
        )}

        {error && <div className="alert err" style={{ marginBottom: '14px' }}>{error}</div>}
        {successMsg && <div className="alert ok" style={{ marginBottom: '14px' }}>{successMsg}</div>}

        {/* ================= VISTA: LOGIN ================= */}
        {tab === 'login' && (
          <div>
            <button
              type="button"
              className="google-auth-btn"
              onClick={handleGoogleBtnClick}
              disabled={loading}
            >
              <GoogleLogoSvg />
              Continuar con Google
            </button>

            <div className="auth-divider">o ingresa con tu correo</div>

            <form onSubmit={handleLogin}>
              <label>
                Correo electrónico *
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="tu.correo@ejemplo.com"
                  required
                />
              </label>

              <label>
                Contraseña *
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </label>

              <button className="primary" style={{ width: '100%', marginTop: '14px' }} disabled={loading}>
                {loading ? 'Verificando...' : 'Entrar a Leveling Jump'}
              </button>
            </form>
          </div>
        )}

        {/* ================= VISTA: REGISTRO ================= */}
        {tab === 'registro' && (
          <div>
            <button
              type="button"
              className="google-auth-btn"
              onClick={handleGoogleBtnClick}
              disabled={loading}
            >
              <GoogleLogoSvg />
              Registrarse con Google
            </button>

            <div className="auth-divider">o regístrate con tu correo</div>

            <form onSubmit={handleRegistro}>
              <label>
                Nombre completo *
                <input
                  value={regForm.nombre}
                  onChange={e => setRegForm({ ...regForm, nombre: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </label>

              <label>
                Correo electrónico *
                <input
                  type="email"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="tu.correo@ejemplo.com"
                  required
                />
                <small style={{ color: '#8B949E', fontSize: '11.5px', marginTop: '3px', display: 'block' }}>
                  📨 Te enviaremos un código de verificación a este correo.
                </small>
              </label>

              <div className="two">
                <label>
                  Contraseña *
                  <input
                    type="password"
                    value={regForm.password}
                    onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    minLength="6"
                    required
                  />
                </label>

                <label>
                  Teléfono / WhatsApp (opcional)
                  <input
                    value={regForm.telefono}
                    onChange={e => setRegForm({ ...regForm, telefono: e.target.value })}
                    placeholder="999 888 777"
                  />
                </label>
              </div>

              <button className="primary" style={{ width: '100%', marginTop: '14px' }} disabled={loading}>
                {loading ? 'Enviando código...' : 'Crear cuenta y recibir código'}
              </button>
            </form>
          </div>
        )}

        {/* ================= VISTA: GOOGLE SETUP (CLIENT ID GRATUITO) ================= */}
        {tab === 'google_setup' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'inline-flex', padding: '10px', background: '#FFFFFF', borderRadius: '50%', marginBottom: '6px' }}>
                <GoogleLogoSvg />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#FFFFFF' }}>
                Ventana Emergente Oficial de Google
              </h4>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#9CA3AF', lineHeight: '1.4' }}>
                Para que el navegador abra la ventana emergente real de Google (<code>accounts.google.com</code>) como en Epic Games y detecte tus cuentas guardadas, Google exige un <strong>Client ID gratuito</strong>.
              </p>
            </div>

            <div style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '12.5px', color: '#C9D1D9' }}>
              <strong style={{ color: 'var(--color-gold)', display: 'block', marginBottom: '6px' }}>
                ⚡ Es 100% GRATIS (0 soles / 0 dólares). Pasos rápidos:
              </strong>
              <ol style={{ margin: '0 0 0 16px', padding: 0, lineHeight: '1.6' }}>
                <li>Entra a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: 'var(--color-cyan)' }}>console.cloud.google.com/apis/credentials</a> con tu Gmail.</li>
                <li>Haz clic en <strong>+ Crear credenciales ➔ ID de cliente de OAuth</strong> (Tipo: <em>Aplicación web</em>).</li>
                <li>En <em>Orígenes autorizados de JavaScript</em> pon la URL de tu app (ej: <code>https://leveling-jump-system-vh7i.vercel.app</code>)</li>
                <li>Copia tu ID de cliente que termina en <code>.apps.googleusercontent.com</code> y pégalo abajo:</li>
              </ol>
            </div>

            <form onSubmit={handleSaveClientId}>
              <label>
                Google OAuth Client ID *
                <input
                  value={inputClientId}
                  onChange={e => setInputClientId(e.target.value)}
                  placeholder="Ej: 123456789-abcdef.apps.googleusercontent.com"
                  required
                />
              </label>

              <button className="primary" style={{ width: '100%', marginTop: '10px' }}>
                Guardar y Abrir Ventana Emergente de Google
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() => { setTab('login'); resetMessages(); }}
                style={{ width: '100%', marginTop: '8px' }}
              >
                ← Volver al login normal
              </button>
            </form>
          </div>
        )}

        {/* ================= VISTA: VERIFICAR OTP ================= */}
        {tab === 'otp' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>🔐</div>
              <p style={{ margin: 0, fontSize: '14px', color: '#C9D1D9' }}>
                Hemos enviado un código de 6 dígitos a:
              </p>
              <strong style={{ color: 'var(--color-cyan)', fontSize: '15px' }}>{otpForm.email}</strong>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#8B949E' }}>
                Si no lo ves en Recibidos, revisa tu carpeta de Spam o Correo no deseado.
              </p>
            </div>

            <form onSubmit={handleVerificarOtp}>
              <label style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#8B949E' }}>
                  Código de 6 dígitos
                </span>
                <input
                  type="text"
                  maxLength="6"
                  value={otpForm.codigo}
                  onChange={e => setOtpForm({ ...otpForm, codigo: e.target.value.replace(/\D/g, '') })}
                  placeholder="123456"
                  style={{
                    textAlign: 'center',
                    fontSize: '28px',
                    letterSpacing: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: 'var(--color-cyan)',
                    padding: '12px',
                    marginTop: '8px'
                  }}
                  autoFocus
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0', fontSize: '12.5px' }}>
                <span style={{ color: timer > 0 ? '#10B981' : '#EF4444' }}>
                  ⏱️ Tiempo restante: <strong>{formatTimer(timer)}</strong>
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleReenviarOtp}
                  disabled={loading || resending}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  {resending ? 'Reenviando...' : 'Reenviar código'}
                </button>
              </div>

              <button className="primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading || resending}>
                {loading ? 'Validando...' : 'Confirmar y Activar Cuenta'}
              </button>

              <button
                type="button"
                className="secondary"
                style={{ width: '100%', marginTop: '8px', background: 'transparent', border: 'none', color: '#8B949E' }}
                onClick={() => { setTab('registro'); resetMessages(); }}
              >
                Volver a corregir correo
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
