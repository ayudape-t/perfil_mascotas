/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Panel de soporte (soporte.html). Va después de js/comun.js y js/excel.js.
   Acceso: cuenta de Supabase Auth (correo + contraseña) + app autenticadora (segundo factor, aal2) + cuenta vinculada como
   administrador con un código de activación. El servidor revisa todo eso en cada función (soporte_*): esta página
   solo decide qué pantalla mostrar. Cada acción queda en el registro. */

// Sesión propia (no se mezcla con las demás páginas) y el enlace de los correos vuelve aquí
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'helpet-soporte', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const AQUI = location.origin + location.pathname;
const SITIO = new URL('.', location.href).href;
const INACTIVIDAD_MIN = 30;

let factorId = null;
let recuperando = /type=recovery/.test(location.hash);   // llegó desde el correo de «contraseña nueva»
let enPanel = false;
let placas = [];            // inventario cargado
let filtroEstado = 'todas';
let lote = null;           // placas recién creadas
let fichaActual = null;

const soloDigitos = v => String(v || '').replace(/\D/g, '');
const fmtTel = p => {
  const t = soloDigitos(p);
  if (!t) return '';
  return (t.length === 11 && t.startsWith('51')) ? `+51 ${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : '+' + t;
};
const fmtFechaHora = iso => iso ? new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }) : '';
const fmtDia = iso => iso ? new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '';
const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }) : '';
const hoyArchivo = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const enlacePerfil = id => `${SITIO}index.html?id=${encodeURIComponent(id)}`;
const waA = (tel, texto) => `https://wa.me/${soloDigitos(tel)}?text=${encodeURIComponent(texto)}`;

// ==================== ACCESO ====================
const PASOS = ['entrar', 'crear', 'olvide', 'correo', 'mfa-alta', 'mfa', 'vincular', 'nueva-clave', 'sin-permiso'];
function mostrarPaso(paso, msg, tipo = 'error') {
  enPanel = false;
  $('cargando').classList.add('hidden');
  $('app').classList.add('hidden');
  $('acceso').classList.remove('hidden');
  PASOS.forEach(p => $(`paso-${p}`).classList.toggle('hidden', p !== paso));
  mensajeAcceso(msg, tipo);
  const primero = $(`paso-${paso}`).querySelector('input:not(.hidden)');
  if (primero) setTimeout(() => primero.focus({ preventScroll: true }), 60);
}
function mensajeAcceso(texto, tipo = 'error') {
  const m = $('acceso-msg');
  m.textContent = texto || '';
  m.className = `msg ${tipo}` + (texto ? '' : ' hidden');
}

function errorAuth(e) {
  const m = String((e && (e.code || '')) + ' ' + (e && e.message || ''));
  if (/invalid_credentials|Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email_not_confirmed|not confirmed/i.test(m)) return 'Primero confirma tu correo: abre el enlace que te enviamos (mira también en «Spam»).';
  if (/user_already_exists|already registered/i.test(m)) return 'Esa cuenta ya existe: entra con tu contraseña.';
  if (/signup_disabled|Signups not allowed/i.test(m)) return 'La creación de cuentas está apagada en Supabase. Actívala un momento en Authentication → Sign In / Providers, o crea el usuario en Authentication → Users.';
  if (/weak_password|Password should|password.*(short|weak)/i.test(m)) return 'La contraseña es muy débil: usa al menos 10 caracteres, con letras y números.';
  if (/rate.?limit|over_email_send/i.test(m)) return 'Se enviaron muchos correos seguidos. Espera unos minutos e inténtalo de nuevo.';
  if (/mfa_verification_failed|invalid.*(totp|code)|code.*invalid/i.test(m)) return 'Código incorrecto. Usa el que aparece ahora en tu app (cambia cada 30 segundos).';
  if (/fetch|network/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return 'No se pudo completar: ' + ((e && e.message) || 'error desconocido') + '.';
}

async function ocupado(btn, texto, accion) {
  const antes = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${esc(texto)}</span>`;
  try { return await accion(); } finally { btn.disabled = false; btn.innerHTML = antes; }
}

// Decide qué pantalla toca según la sesión, el segundo factor y si la cuenta es administradora
async function revisarAcceso() {
  try { return await decidirPantalla(); }
  catch (e) { return mostrarPaso('entrar', errorAuth(e)); }   // sesión dañada o sin conexión: nunca se queda colgada
}
async function decidirPantalla() {
  const { data: { session } } = await sb.auth.getSession();
  $('btn-salir').classList.toggle('hidden', !session);
  if (!session) return mostrarPaso('entrar');
  $('nc-correo').value = session.user.email || '';
  const { data: nivel, error: e1 } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (e1) return mostrarPaso('entrar', errorAuth(e1));
  if (nivel.currentLevel !== 'aal2') {
    const { data: f, error } = await sb.auth.mfa.listFactors();
    if (error) return mostrarPaso('entrar', errorAuth(error));
    const totp = (f.all || []).filter(x => x.factor_type === 'totp');
    const listo = totp.find(x => x.status === 'verified');
    if (listo) { factorId = listo.id; return mostrarPaso('mfa'); }
    return iniciarAltaMfa(totp);
  }
  if (recuperando) return mostrarPaso('nueva-clave');
  const { data: est, error } = await sb.rpc('soporte_estado');
  if (error || !est) return mostrarPaso('entrar', 'No se pudo revisar tu acceso. Revisa tu conexión e inténtalo de nuevo.');
  if (est.admin) return abrirPanel(session.user.email);
  if (est.puede_vincular) return mostrarPaso('vincular');
  return mostrarPaso('sin-permiso');
}

async function iniciarAltaMfa(pendientes) {
  for (const f of pendientes) { try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch (e) {} }   // intentos anteriores sin terminar
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Kutimuy soporte', issuer: 'Kutimuy' });
  if (error) return mostrarPaso('entrar', errorAuth(error));
  factorId = data.id;
  const caja = $('mfa-qr');
  caja.innerHTML = '';
  new QRCode(caja, { text: data.totp.uri, width: 184, height: 184, colorDark: '#2b1d1a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  $('mfa-secreto').textContent = String(data.totp.secret || '').replace(/(.{4})/g, '$1 ').trim();
  $('mfa-alta-codigo').value = '';
  mostrarPaso('mfa-alta');
}

async function verificarMfa(input, btn) {
  const code = soloDigitos($(input).value);
  if (code.length !== 6) return mensajeAcceso('Escribe los 6 números de tu app.');
  await ocupado($(btn), 'Verificando...', async () => {
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { $(input).value = ''; $(input).focus(); return mensajeAcceso(errorAuth(error)); }
    mensajeAcceso('');
    await revisarAcceso();
  });
}

async function entrar() {
  const email = $('in-correo').value.trim(), password = $('in-clave').value;
  if (!email || !password) return mensajeAcceso('Escribe tu correo y tu contraseña.');
  await ocupado($('btn-entrar'), 'Entrando...', async () => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return mensajeAcceso(errorAuth(error));
    $('in-clave').value = '';
    await revisarAcceso();
  });
}

async function crearCuenta() {
  const email = $('cr-correo').value.trim(), p1 = $('cr-clave1').value, p2 = $('cr-clave2').value;
  if (!email) return mensajeAcceso('Escribe tu correo.');
  if (p1.length < 10) return mensajeAcceso('La contraseña debe tener al menos 10 caracteres.');
  if (p1 !== p2) return mensajeAcceso('Las contraseñas no coinciden.');
  await ocupado($('btn-crear'), 'Creando...', async () => {
    const { data, error } = await sb.auth.signUp({ email, password: p1, options: { emailRedirectTo: AQUI } });
    if (error) return mensajeAcceso(errorAuth(error));
    $('cr-clave1').value = ''; $('cr-clave2').value = '';
    if (data.session) return revisarAcceso();
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return mostrarPaso('entrar', 'Esa cuenta ya existe: entra con tu contraseña.');
    }
    $('correo-titulo').textContent = 'Confirma tu correo';
    $('correo-texto').textContent = `Te enviamos un enlace a ${email}. Ábrelo (mira también en «Spam») y luego entra aquí con tu contraseña.`;
    mostrarPaso('correo');
  });
}

async function olvideClave() {
  const email = $('ol-correo').value.trim();
  if (!email) return mensajeAcceso('Escribe tu correo.');
  await ocupado($('btn-olvide'), 'Enviando...', async () => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: AQUI });
    if (error) return mensajeAcceso(errorAuth(error));
    $('correo-titulo').textContent = 'Revisa tu correo';
    $('correo-texto').textContent = 'Si ese correo tiene una cuenta, te llegará un enlace para poner una contraseña nueva. Ábrelo en este mismo navegador.';
    mostrarPaso('correo');
  });
}

async function guardarClaveNueva() {
  const p1 = $('nc-clave1').value, p2 = $('nc-clave2').value;
  if (p1.length < 10) return mensajeAcceso('La contraseña debe tener al menos 10 caracteres.');
  if (p1 !== p2) return mensajeAcceso('Las contraseñas no coinciden.');
  await ocupado($('btn-nueva-clave'), 'Guardando...', async () => {
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return mensajeAcceso(errorAuth(error));
    recuperando = false;
    $('nc-clave1').value = ''; $('nc-clave2').value = '';
    history.replaceState(null, '', location.pathname);
    aviso('Contraseña cambiada.', 'ok');
    await revisarAcceso();
  });
}

async function vincular() {
  const c = $('vincular-codigo').value.trim();
  if (!c) return mensajeAcceso('Escribe el código de activación del panel.');
  await ocupado($('btn-vincular'), 'Activando...', async () => {
    const { data, error } = await sb.rpc('soporte_vincular', { p_codigo: c });
    if (error || !data) return mensajeAcceso('No se pudo activar. Revisa tu conexión.');
    const e = data.estado;
    if (e === 'ok') { aviso('¡Panel activado!', 'ok'); return revisarAcceso(); }
    mensajeAcceso(e === 'incorrecto' ? `Código incorrecto. Te quedan ${data.quedan} intento(s).`
      : e === 'codigo_vencido' ? 'Ese código venció o se usó demasiadas veces. Pide uno nuevo.'
      : e === 'correo_sin_confirmar' ? 'Primero confirma tu correo con el enlace que te enviamos.'
      : e === 'falta_segundo_factor' ? 'Primero activa la verificación en dos pasos.'
      : 'Esta cuenta no puede activar el panel.');
  });
}

async function salir(msg) {
  lote = null; placas = []; listaVisible = []; fichaActual = null;
  try { await sb.auth.signOut(); } catch (e) {}
  $('btn-salir').classList.add('hidden');
  $('top-sub').textContent = 'Solo para el equipo de Kutimuy';
  mostrarPaso('entrar', msg || '', msg ? 'info' : 'error');
}

// Sin usar el panel un rato: se cierra la sesión (por si el celular queda abierto)
let ultimaActividad = Date.now();
['pointerdown', 'keydown', 'scroll'].forEach(ev => window.addEventListener(ev, () => { ultimaActividad = Date.now(); }, { passive: true }));
setInterval(() => {
  if (enPanel && Date.now() - ultimaActividad > INACTIVIDAD_MIN * 60000) salir(`Cerramos la sesión después de ${INACTIVIDAD_MIN} minutos sin uso.`);
}, 60000);

// ==================== PANEL ====================
async function llamar(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw new Error(/jwt|401|auth/i.test(error.message) ? 'Tu sesión venció: vuelve a entrar.'
    : /could not find the function|PGRST202/i.test(error.message + ' ' + (error.code || '')) ? 'Esta función todavía no está activada en Supabase.'
    : 'Sin conexión o error del servidor.');
  if (data && data.estado === 'sin_permiso') { revisarAcceso(); throw new Error('Tu sesión ya no tiene permiso: vuelve a entrar.'); }
  return data;
}

function abrirPanel(email) {
  enPanel = true;
  ultimaActividad = Date.now();
  $('top-sub').textContent = email || 'Soporte';
  $('acceso').classList.add('hidden');
  $('app').classList.remove('hidden');
  irATab('buscar');
}

const TABS = ['buscar', 'ficha', 'placas', 'nuevas', 'registro'];
let tabAnterior = 'buscar';
function irATab(t) {
  if (t !== 'ficha') tabAnterior = t;
  TABS.forEach(x => $(`tab-${x}`).classList.toggle('hidden', x !== t));
  document.querySelectorAll('.pestana').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === (t === 'ficha' ? tabAnterior : t))));
  window.scrollTo({ top: 0 });
  if (t === 'buscar') setTimeout(() => $('q').focus({ preventScroll: true }), 50);
  if (t === 'placas') cargarPlacas();
  if (t === 'registro') cargarRegistro();
}

const chip = (texto, clase = '') => `<span class="chip ${clase}">${texto}</span>`;
function chipsEstado(m) {
  return (m.estado === 'sin_activar' ? chip('Sin activar', 'gris') : m.estado === 'antigua' ? chip('Antigua', 'ocre') : chip('Activa', 'verde'))
    + (m.perdida ? chip('<i class="fa-solid fa-bullhorn"></i> Perdida', 'rojo') : '');
}
function itemMascota(m) {
  const sub = [m.owner, fmtTel(m.phone)].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="item" data-ficha="${esc(m.id)}">
      <span class="item-txt"><b>${esc(m.pet || 'Placa sin activar')}</b>${sub ? `<small>${sub}</small>` : ''}${m.nota ? `<small class="nota-mini"><i class="fa-regular fa-note-sticky"></i> ${esc(m.nota)}</small>` : ''}</span>
      <span class="item-der"><code>${esc(m.id)}</code>${m.codigo ? `<span class="codigo-item" title="Código de activación">${esc(m.codigo)}</span>` : ''}<span class="chips">${chipsEstado(m)}</span></span>
    </button>`;
}

// ---- Buscar ----
let temporizador = null, ultimaBusqueda = '';
function alEscribirBusqueda() {
  clearTimeout(temporizador);
  temporizador = setTimeout(buscar, 300);
}
async function buscar() {
  const q = $('q').value.trim();
  if (q === ultimaBusqueda) return;
  ultimaBusqueda = q;
  const caja = $('resultados');
  if (q.length < 2) { caja.innerHTML = ''; $('buscar-ayuda').classList.remove('hidden'); return; }
  $('buscar-ayuda').classList.add('hidden');
  caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</p>';
  try {
    const r = await llamar('soporte_buscar', { p_q: q });
    if (q !== ultimaBusqueda) return;
    const lista = r.resultados || [];
    caja.innerHTML = lista.length ? lista.map(itemMascota).join('') : `<p class="vacio"><i class="fa-regular fa-face-meh"></i> Nada con «${esc(q)}».</p>`;
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}

// ---- Ficha ----
async function abrirFicha(id) {
  irATab('ficha');
  const caja = $('ficha');
  caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Cargando la ficha...</p>';
  try {
    const f = await llamar('soporte_ficha', { p_id: id });
    if (f.estado === 'no_existe') { caja.innerHTML = '<p class="msg error">Esa placa no existe.</p>'; return; }
    fichaActual = f;
    pintarFicha(f);
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}

const ORIGEN = { activacion: 'Activó la placa', telegram: 'Código por Telegram', tarjeta: 'Código de la tarjeta', soporte: 'Código de soporte', recuperacion: 'Recuperó el PIN' };
function pintarFicha(f) {
  const m = f.mascota, pl = f.placa, id = f.id;
  const estado = m ? (pl.en_inventario ? 'activa' : 'antigua') : 'sin_activar';
  const foto = m && m.photo ? `<img src="${esc(m.photo)}" alt="" class="ficha-foto">` : '<span class="ficha-foto vacia"><i class="fa-solid fa-paw"></i></span>';
  const fila = (ico, t, v) => v ? `<div class="dato"><i class="${ico.includes(' ') ? ico : 'fa-solid ' + ico}"></i><span>${t}</span><b>${v}</b></div>` : '';
  const disp = f.dispositivos || [];
  let html = `
    <div class="ficha-cab">
      ${foto}
      <div>
        <h2>${esc(m ? m.pet : 'Placa sin activar')}</h2>
        <div class="chips">${chipsEstado({ estado, perdida: m && m.perdida })}${m ? (f.telegram ? chip('<i class="fa-brands fa-telegram"></i> Telegram', 'azul') : chip('Sin Telegram', 'gris')) : ''}</div>
        <div class="id-fila"><code>${esc(id)}</code>
          <button type="button" class="btn-mini" data-copiar="${esc(id)}" aria-label="Copiar el código de placa"><i class="fa-regular fa-copy"></i></button>
          <a class="btn-mini" href="${esc(enlacePerfil(id))}&src=soporte" target="_blank" rel="noopener" aria-label="Ver su perfil"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        </div>
      </div>
    </div>`;
  if (m) {
    const tel2 = m.phone_secondary ? `<a class="tel" href="tel:+${esc(soloDigitos(m.phone_secondary))}">${esc(fmtTel(m.phone_secondary))}</a>` : '';
    html += `
    <section class="tarjeta">
      <h3><i class="fa-solid fa-user"></i> Dueño</h3>
      <p class="dueno"><b>${esc(m.owner || '—')}</b></p>
      <div class="fila">
        <a class="btn btn-verde" href="${esc(waA(m.phone, `Hola ${m.owner || ''}, te escribe el soporte de Kutimuy 🐾`))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> <span>${esc(fmtTel(m.phone))}</span></a>
        <a class="btn btn-line" href="tel:+${esc(soloDigitos(m.phone))}"><i class="fa-solid fa-phone"></i> <span>Llamar</span></a>
      </div>
      ${tel2 ? `<p class="intro">Teléfono 2: ${tel2}</p>` : ''}
      <p class="consejo"><i class="fa-solid fa-user-shield"></i><span>Antes de dar un código o un enlace, confirma que te escribe desde <b>${esc(fmtTel(m.phone))}</b>${m.phone_secondary ? ` o <b>${esc(fmtTel(m.phone_secondary))}</b>` : ''}.</span></p>
    </section>`;
  }
  html += `
    <section class="tarjeta">
      <h3><i class="fa-solid fa-circle-info"></i> Estado</h3>
      ${fila('fa-calendar-plus', 'Placa creada', pl.creada_en ? esc(fmtDia(pl.creada_en)) : (m ? 'Antes de las tarjetas' : ''))}
      ${fila('fa-calendar-check', 'Activada', pl.activada_en ? esc(fmtFechaHora(pl.activada_en)) : '')}
      ${m ? fila('fa-ticket', 'Código de su tarjeta', pl.tiene_codigo ? 'Lo tiene el dueño' : 'No tiene') : ''}
      ${m ? fila('fa-brands fa-telegram', 'Telegram', f.telegram ? `Conectado desde ${esc(fmtDia(f.telegram.vinculado_en))}` : 'No conectado') : ''}
      ${m && m.perdida ? fila('fa-location-dot', 'Se perdió en', esc(m.lost_location || 'Sin zona')) : ''}
      ${m ? fila('fa-qrcode', 'Último escaneo', f.ultimo_escaneo ? `${esc(fmtFechaHora(f.ultimo_escaneo.fecha))}${f.ultimo_escaneo.con_ubicacion ? ' · con ubicación' : ''}` : 'Ninguno') : ''}
      ${m ? fila('fa-chart-simple', 'Escaneos (30 días)', String(f.escaneos_30d || 0)) : ''}
      ${f.canal_mensajes ? fila('fa-bullhorn', 'Avisos en el canal', String(f.canal_mensajes)) : ''}
      ${f.pin_bloqueado_hasta ? fila('fa-lock', 'PIN bloqueado hasta', esc(hora(f.pin_bloqueado_hasta))) : ''}
    </section>`;
  if (!m) {   // placa sin activar: su código (para la tarjeta del empaque)
    html += pl.codigo ? `
    <section class="tarjeta">
      <h3><i class="fa-solid fa-ticket"></i> Código de activación</h3>
      <p class="codigo-grande">${esc(pl.codigo)}</p>
      <div class="fila">
        <button type="button" class="btn btn-line" data-copiar="${esc(pl.codigo)}"><i class="fa-regular fa-copy"></i> <span>Copiar</span></button>
        <button type="button" class="btn btn-oscuro" data-imprimir="${esc(id)}" data-codigo="${esc(pl.codigo)}"><i class="fa-solid fa-print"></i> <span>Imprimir su tarjeta</span></button>
      </div>
    </section>` : `
    <section class="tarjeta">
      <h3><i class="fa-solid fa-ticket"></i> Código de activación</h3>
      <p class="intro">No hay una copia visible de su código. Si no tienes su tarjeta, genera uno nuevo aquí abajo.</p>
    </section>`;
  }
  if (m) {
    html += `
    <section class="tarjeta">
      <h3><i class="fa-solid fa-mobile-screen-button"></i> Celulares con acceso (${disp.length})</h3>
      ${disp.length ? `<ul class="celulares">${disp.map(d => `<li><b>${esc(d.etiqueta || 'Celular')}</b><small>${esc(ORIGEN[d.origen] || d.origen || '')} · último uso ${esc(fmtFechaHora(d.ultimo_uso || d.creado_en))}${d.bloqueado ? ' · bloqueado por intentos' : ''}</small></li>`).join('')}</ul>`
        : '<p class="intro">Ninguno. Para entrar desde un celular necesitará su PIN y un código (de Telegram, de su tarjeta o de soporte).</p>'}
    </section>

    <section class="tarjeta accion">
      <h3><i class="fa-solid fa-key"></i> No puede entrar desde un celular nuevo</h3>
      <p class="intro">Genera un código de soporte (30 minutos). Lo escribe después de su PIN; sin el PIN no sirve.</p>
      <button type="button" class="btn btn-ambar" data-accion="codigo"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generar código de soporte</span></button>
      <div id="res-codigo" class="resultado hidden"></div>
    </section>

    <section class="tarjeta accion">
      <h3><i class="fa-solid fa-unlock-keyhole"></i> Olvidó su PIN</h3>
      <p class="intro">Crea un enlace de un solo uso (30 minutos) para que ponga un PIN nuevo. El celular donde lo abra quedará como el suyo y los demás perderán el acceso.</p>
      <button type="button" class="btn btn-ambar" data-accion="enlace"><i class="fa-solid fa-link"></i> <span>Crear enlace para cambiar el PIN</span></button>
      <div id="res-enlace" class="resultado hidden"></div>
    </section>

    <section class="tarjeta accion peligro">
      <h3><i class="fa-solid fa-mobile-retro"></i> Le robaron o perdió el celular</h3>
      <p class="intro">Quita el acceso a todos sus celulares${disp.length ? ` (${disp.length})` : ''}. Las sesiones abiertas dejan de servir; para volver a entrar necesitará su PIN y un código.</p>
      <button type="button" class="btn btn-rojo" data-accion="quitar" ${disp.length ? '' : 'disabled'}><i class="fa-solid fa-ban"></i> <span>Quitar el acceso a sus celulares</span></button>
      <div id="res-quitar" class="resultado hidden"></div>
    </section>`;
  }
  html += `
    <section class="tarjeta">
      <h3><i class="fa-regular fa-note-sticky"></i> Nota interna</h3>
      <textarea id="nota" class="fld" rows="2" maxlength="300" placeholder="Ej. Vendida a María Quispe el 23/10, pack de 2">${esc(f.nota || '')}</textarea>
      <button type="button" class="btn btn-line" data-accion="nota"><i class="fa-solid fa-floppy-disk"></i> <span>Guardar nota</span></button>
    </section>`;
  html += m ? `
    <section class="tarjeta accion peligro">
      <h3><i class="fa-solid fa-rotate-left"></i> Dejar la placa como nueva</h3>
      <p class="intro">Borra todo lo de ${esc(m.pet || 'esta mascota')}: su perfil, sus fotos, los datos de ${esc(m.owner || 'su dueño')}, su historial médico, los escaneos, los celulares con acceso, su Telegram y la nota. La placa queda sin activar, con un <b>código de activación nuevo</b>. No se puede deshacer.</p>
      ${f.canal_mensajes ? `<p class="consejo"><i class="fa-brands fa-telegram"></i><span>Tiene ${f.canal_mensajes} aviso(s) publicados en el canal @HelpetAvisos: bórralos a mano en Telegram.</span></p>` : ''}
      <label class="lbl" for="confirmar-reinicio">Escribe ${esc(id)} para confirmar</label>
      <input id="confirmar-reinicio" class="fld" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(id)}" data-placa="${esc(id)}">
      <button type="button" class="btn btn-rojo" data-accion="reiniciar" disabled><i class="fa-solid fa-rotate-left"></i> <span>Dejar como nueva</span></button>
    </section>` : `
    <section class="tarjeta accion">
      <h3><i class="fa-solid fa-rotate"></i> ¿Se perdió su tarjeta?</h3>
      <p class="intro">Genera un código de activación nuevo. El anterior deja de servir.</p>
      <button type="button" class="btn btn-ambar" data-accion="codigo-nuevo"><i class="fa-solid fa-rotate"></i> <span>Generar un código nuevo</span></button>
    </section>`;
  $('ficha').innerHTML = html;
  $('ficha').querySelectorAll('img.ficha-foto').forEach(img => img.addEventListener('error', () => {
    img.replaceWith(Object.assign(document.createElement('span'), { className: 'ficha-foto vacia', innerHTML: '<i class="fa-solid fa-paw"></i>' }));
  }, { once: true }));
}

function mostrarResultado(id, html) {
  const r = $(id);
  r.innerHTML = html;
  r.classList.remove('hidden');
  repetir(r, 'aparece', 500);
}

async function accionFicha(accion, btn) {
  const f = fichaActual;
  if (!f) return;
  const m = f.mascota || {}, id = f.id, dueno = m.owner || '', pet = m.pet || 'tu mascota';
  try {
    if (accion === 'codigo') {
      const r = await ocupado(btn, 'Generando...', () => llamar('soporte_codigo', { p_id: id }));
      if (r.estado !== 'ok') return aviso('No se pudo generar el código.', 'error');
      const texto = `Hola ${dueno}, te escribe el soporte de Kutimuy 🐾. Tu código para entrar al panel de ${pet} es: ${r.codigo}. Escríbelo después de tu PIN; vence en 30 minutos. Nunca te pediremos tu PIN.`;
      mostrarResultado('res-codigo', `
        <p class="codigo-grande">${esc(r.codigo)}</p>
        <p class="intro centro-txt">Vence a las ${esc(hora(r.expira_en))}</p>
        <div class="fila">
          <a class="btn btn-verde" href="${esc(waA(m.phone, texto))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> <span>Enviar por WhatsApp</span></a>
          <button type="button" class="btn btn-line" data-copiar="${esc(r.codigo)}"><i class="fa-regular fa-copy"></i> <span>Copiar</span></button>
        </div>`);
    } else if (accion === 'enlace') {
      const r = await ocupado(btn, 'Creando...', () => llamar('soporte_enlace_pin', { p_id: id }));
      if (r.estado !== 'ok') return aviso('No se pudo crear el enlace.', 'error');
      const enlace = `${SITIO}recuperar.html?t=${encodeURIComponent(r.token)}`;
      const texto = `Hola ${dueno}, te escribe el soporte de Kutimuy 🐾. Con este enlace puedes poner un PIN nuevo para ${pet}: ${enlace} . Funciona una sola vez y vence en 30 minutos. Ábrelo en tu celular: los demás celulares perderán el acceso al panel.`;
      mostrarResultado('res-enlace', `
        <p class="enlace-largo">${esc(enlace)}</p>
        <p class="intro centro-txt">Vence a las ${esc(hora(r.expira_en))} · funciona una vez</p>
        <div class="fila">
          <a class="btn btn-verde" href="${esc(waA(m.phone, texto))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> <span>Enviar por WhatsApp</span></a>
          <button type="button" class="btn btn-line" data-copiar="${esc(enlace)}"><i class="fa-regular fa-copy"></i> <span>Copiar</span></button>
        </div>`);
    } else if (accion === 'quitar') {
      if (!confirm(`¿Quitar el acceso a todos los celulares de ${pet}? Para volver a entrar, su dueño necesitará su PIN y un código.`)) return;
      const r = await ocupado(btn, 'Quitando...', () => llamar('soporte_quitar_accesos', { p_id: id }));
      if (r.estado !== 'ok') return aviso('No se pudo quitar el acceso.', 'error');
      aviso(`Listo: se quitó el acceso a ${r.quitados} celular(es).`, 'ok');
      await abrirFicha(id);
    } else if (accion === 'reiniciar' || accion === 'codigo-nuevo') {
      if (accion === 'reiniciar') {
        if ($('confirmar-reinicio').value.trim().toUpperCase() !== id.toUpperCase()) return aviso(`Escribe ${id} para confirmar.`, 'error');
        if (!confirm(`Última confirmación: ¿borrar todos los datos de ${pet} y dejar la placa ${id} como nueva?`)) return;
      } else if (!confirm(`¿Generar un código de activación nuevo para la placa ${id}? El anterior dejará de servir.`)) return;
      const r = await ocupado(btn, accion === 'reiniciar' ? 'Borrando...' : 'Generando...', () => llamar('soporte_reiniciar_placa', { p_id: id, p_confirmar: id }));
      if (r.estado === 'confirmacion_invalida') return aviso(`Escribe ${id} para confirmar.`, 'error');
      if (r.estado !== 'ok') return aviso('No se pudo completar. Revisa tu conexión.', 'error');
      placas = [];   // el inventario se vuelve a cargar
      await abrirFicha(id);
      aviso(r.mascota_borrada ? `Listo: la placa quedó como nueva. Código nuevo: ${r.codigo}` : `Código nuevo: ${r.codigo}`, 'ok');
      if (r.avisos_canal) setTimeout(() => aviso(`Recuerda borrar en Telegram sus ${r.avisos_canal} aviso(s) del canal.`, 'info'), 3500);
    } else if (accion === 'nota') {
      const r = await ocupado(btn, 'Guardando...', () => llamar('soporte_nota', { p_id: id, p_nota: $('nota').value }));
      if (r.estado !== 'ok') return aviso('No se pudo guardar la nota.', 'error');
      const p = placas.find(x => x.id === id);
      if (p) p.nota = $('nota').value.trim();
      aviso('Nota guardada.', 'ok');
    }
  } catch (e) { aviso(e.message, 'error'); }
}

// ---- Inventario ----
async function cargarPlacas() {
  const caja = $('lista-placas');
  if (!placas.length) caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Cargando las placas...</p>';
  try {
    const r = await llamar('soporte_placas');
    placas = r.placas || [];
    pintarPlacas();
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}
let listaVisible = [];
const FILTROS = [
  ['todas', 'Todas', () => true],
  ['sin_activar', 'Sin activar', p => p.estado === 'sin_activar'],
  ['activa', 'Activas', p => p.estado !== 'sin_activar'],
  ['perdida', 'Perdidas', p => p.perdida],
  ['nota', 'Con nota', p => !!p.nota],
];
function pintarPlacas() {
  $('contadores').innerHTML = FILTROS.map(([k, t, f]) =>
    `<button type="button" class="contador${filtroEstado === k ? ' activo' : ''}${k === 'perdida' ? ' rojo' : ''}" data-filtro="${k}" aria-pressed="${filtroEstado === k}"><b>${placas.filter(f).length}</b><span>${t}</span></button>`).join('');
  const q = $('filtro').value.trim().toLowerCase();
  const pasa = FILTROS.find(x => x[0] === filtroEstado)[2];
  const lista = placas.filter(pasa).filter(p => !q || [p.id, p.pet, p.owner, p.nota, p.codigo].some(v => String(v || '').toLowerCase().includes(q)));
  listaVisible = lista;
  const conCodigo = lista.filter(p => p.codigo).length;
  $('btn-imprimir-placas').disabled = !conCodigo;
  $('btn-imprimir-placas').querySelector('span').textContent = conCodigo ? `Imprimir ${conCodigo} tarjeta(s)` : 'Imprimir tarjetas';
  $('lista-placas').innerHTML = lista.length ? lista.map(itemMascota).join('') : '<p class="vacio">No hay placas con ese filtro.</p>';
}
function excelInventario() {
  if (!placas.length) return aviso('Primero carga las placas.', 'error');
  const est = { sin_activar: 'Sin activar', activa: 'Activa', antigua: 'Antigua (sin tarjeta)' };
  descargarExcel(`kutimuy-placas-${hoyArchivo()}.xlsx`, [{
    nombre: 'Placas',
    columnas: [['Código de placa', 16], ['Código de activación', 20], ['Enlace del QR', 58], ['Estado', 20], ['Mascota', 16], ['Dueño', 20], ['Alarma', 10], ['Telegram', 10], ['Creada', 12], ['Activada', 12], ['Nota', 44]],
    filas: placas.map(p => [p.id, p.codigo || (p.estado === 'sin_activar' ? '' : 'Lo tiene el dueño'), enlacePerfil(p.id), est[p.estado] || p.estado, p.pet || '', p.owner || '', p.perdida ? 'Perdida' : '', p.estado === 'sin_activar' ? '' : (p.telegram ? 'Sí' : 'No'),
      fmtDia(p.creada_en), fmtDia(p.activada_en), p.nota || '']),
  }]);
}

// ---- Placas nuevas ----
async function crearPlacas() {
  const n = Math.round(Number($('cantidad').value));
  if (!(n >= 1 && n <= 50)) return aviso('Elige entre 1 y 50 placas.', 'error');
  if (!confirm(`¿Crear ${n} placa(s) nueva(s)?`)) return;
  try {
    const r = await ocupado($('btn-crear-placas'), 'Creando...', () => llamar('soporte_crear_placas', { p_cantidad: n }));
    if (r.estado !== 'ok') return aviso('No se pudo crear: revisa la cantidad.', 'error');
    lote = r.placas || [];
    pintarLote();
    lanzarFiguras($('btn-crear-placas'), 10);
    aviso(`Listo: ${lote.length} placa(s) nuevas.`, 'ok');
    placas = [];   // el inventario se vuelve a cargar con las nuevas
  } catch (e) { aviso(e.message, 'error'); }
}
function pintarLote() {
  $('lote').classList.remove('hidden');
  $('lote-lista').innerHTML = lote.map((p, i) => `
    <div class="item lote-item">
      <span class="qr-mini" data-qr="${esc(p.enlace)}"></span>
      <span class="item-txt"><small>Placa ${i + 1}</small><code>${esc(p.id)}</code></span>
      <span class="item-der"><span class="codigo-lote">${esc(p.codigo)}</span>
        <button type="button" class="btn-mini" data-copiar="${esc(p.codigo)}" aria-label="Copiar el código ${esc(p.codigo)}"><i class="fa-regular fa-copy"></i></button></span>
    </div>`).join('');
  $('lote-lista').querySelectorAll('[data-qr]').forEach(el => new QRCode(el, { text: el.dataset.qr, width: 56, height: 56, colorDark: '#2b1d1a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }));
}
function excelLote() {
  if (!lote) return;
  descargarExcel(`kutimuy-lote-${hoyArchivo()}-${lote.length}.xlsx`, [{
    nombre: `Lote ${hoyArchivo()}`,
    columnas: [['N°', 5], ['Código de placa', 16], ['Código de activación', 20], ['Enlace del QR', 58]],
    filas: lote.map((p, i) => [i + 1, p.id, p.codigo, p.enlace]),
  }]);
}
// Tarjetas del empaque (2 por fila en A4): las del lote nuevo, las de la lista de placas o la de una ficha
function imprimirTarjetas(lista) {
  lista = (lista || []).filter(p => p.codigo).map(p => ({ ...p, enlace: p.enlace || enlacePerfil(p.id) }));
  if (!lista.length) return aviso('No hay tarjetas con código para imprimir.', 'error');
  const hoja = $('hoja-tarjetas');
  hoja.innerHTML = lista.map(p => `
    <div class="tarjeta-imp">
      <div class="ti-cab"><img src="logo.png" alt=""><b>Kutimuy</b><span>Placa inteligente</span></div>
      <div class="ti-cuerpo">
        <div class="ti-qr" data-qr="${esc(p.enlace)}"></div>
        <div>
          <p class="ti-titulo">Tu código de activación</p>
          <p class="ti-codigo">${esc(p.codigo)}</p>
          <ol class="ti-pasos"><li>Escanea la placa con la cámara de tu celular.</li><li>Toca «Activar» y llena los datos de tu mascota.</li><li>Escribe este código cuando te lo pida.</li></ol>
        </div>
      </div>
      <p class="ti-pie">Placa ${esc(p.id)} · Guarda esta tarjeta: te sirve para entrar desde otro celular.</p>
    </div>`).join('');
  hoja.querySelectorAll('[data-qr]').forEach(el => new QRCode(el, { text: el.dataset.qr, width: 84, height: 84, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }));
  setTimeout(() => window.print(), 300);   // los QR se dibujan antes de imprimir
}
window.addEventListener('afterprint', () => { $('hoja-tarjetas').innerHTML = ''; });   // los códigos no se quedan en la página

// ---- Registro ----
const ACCION = { vincular_cuenta: 'Activó el panel', ver_ficha: 'Vio la ficha', codigo_soporte: 'Generó un código de soporte', enlace_pin: 'Creó un enlace para cambiar el PIN',
  quitar_accesos: 'Quitó el acceso a los celulares', nota: 'Guardó una nota', ver_inventario: 'Vio el inventario', crear_placas: 'Creó placas',
  regenerar_codigos: 'Generó códigos nuevos', reiniciar_placa: 'Dejó una placa como nueva', codigo_nuevo: 'Generó un código de activación nuevo' };
async function cargarRegistro() {
  const caja = $('lista-registro');
  caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>';
  try {
    const r = await llamar('soporte_historial');
    const lista = r.acciones || [];
    caja.innerHTML = lista.length ? lista.map(a => `
      <div class="item registro">
        <span class="item-txt"><b>${esc(ACCION[a.accion] || a.accion)}</b><small>${esc(fmtFechaHora(a.fecha))}${a.detalle ? ' · ' + esc(a.detalle) : ''}</small></span>
        ${a.placa ? `<button type="button" class="btn-mini texto" data-ficha="${esc(a.placa)}"><code>${esc(a.placa)}</code></button>` : ''}
      </div>`).join('') : '<p class="vacio">Todavía no hay acciones.</p>';
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}

// ---- Copiar ----
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); }
  catch (e) {
    const t = Object.assign(document.createElement('textarea'), { value: texto });
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e2) {}
    t.remove();
  }
  aviso('Copiado.', 'ok');
  vibrar(15);
}

// ==================== EVENTOS ====================
ondaAlTocar('.btn');
const alEnviar = (id, accion) => $(id).addEventListener('submit', e => { e.preventDefault(); accion(); });
alEnviar('paso-entrar', entrar);
alEnviar('paso-crear', crearCuenta);
alEnviar('paso-olvide', olvideClave);
alEnviar('paso-mfa-alta', () => verificarMfa('mfa-alta-codigo', 'btn-mfa-alta'));
alEnviar('paso-mfa', () => verificarMfa('mfa-codigo', 'btn-mfa'));
alEnviar('paso-vincular', vincular);
alEnviar('paso-nueva-clave', guardarClaveNueva);
alClic('ir-crear', () => { $('cr-correo').value = $('in-correo').value; mostrarPaso('crear'); });
alClic('ir-olvide', () => { $('ol-correo').value = $('in-correo').value; mostrarPaso('olvide'); });
document.querySelectorAll('.volver-entrar').forEach(b => b.addEventListener('click', () => mostrarPaso('entrar')));
document.querySelectorAll('.accion-salir').forEach(b => b.addEventListener('click', () => salir()));
alClic('btn-salir', () => salir());
alClic('btn-copiar-secreto', () => copiar($('mfa-secreto').textContent.replace(/\s/g, '')));
// Los códigos de 6 números entran solos al completarse
[['mfa-alta-codigo', 'btn-mfa-alta'], ['mfa-codigo', 'btn-mfa']].forEach(([i, b]) => $(i).addEventListener('input', () => {
  $(i).value = soloDigitos($(i).value).slice(0, 6);
  if ($(i).value.length === 6) verificarMfa(i, b);
}));

document.querySelectorAll('.pestana').forEach(b => b.addEventListener('click', () => irATab(b.dataset.tab)));
$('q').addEventListener('input', alEscribirBusqueda);
$('filtro').addEventListener('input', pintarPlacas);
$('contadores').addEventListener('click', e => { const b = e.target.closest('[data-filtro]'); if (b) { filtroEstado = b.dataset.filtro; pintarPlacas(); } });
alClic('ficha-volver', () => irATab(tabAnterior));
alClic('btn-excel', excelInventario);
alClic('btn-crear-placas', crearPlacas);
alEnter('cantidad', crearPlacas);
alClic('btn-lote-excel', excelLote);
alClic('btn-lote-imprimir', () => imprimirTarjetas(lote));
alClic('btn-imprimir-placas', () => imprimirTarjetas(listaVisible));
// «Dejar como nueva» se enciende solo con el código de la placa escrito
document.addEventListener('input', e => {
  if (e.target.id !== 'confirmar-reinicio') return;
  const b = $('ficha').querySelector('[data-accion="reiniciar"]');
  if (b) b.disabled = e.target.value.trim().toUpperCase() !== String(e.target.dataset.placa).toUpperCase();
});
// Delegación: abrir una ficha, copiar y las acciones de la ficha (se dibujan una y otra vez)
document.addEventListener('click', e => {
  const f = e.target.closest('[data-ficha]');
  if (f) { abrirFicha(f.dataset.ficha); return; }
  const c = e.target.closest('[data-copiar]');
  if (c) { copiar(c.dataset.copiar); return; }
  const t = e.target.closest('[data-imprimir]');
  if (t) { imprimirTarjetas([{ id: t.dataset.imprimir, codigo: t.dataset.codigo }]); return; }
  const a = e.target.closest('#ficha [data-accion]');
  if (a && !a.disabled) accionFicha(a.dataset.accion, a);
});

sb.auth.onAuthStateChange(evento => {
  if (evento === 'PASSWORD_RECOVERY') { recuperando = true; setTimeout(revisarAcceso, 0); }
});
revisarAcceso().catch(() => mostrarPaso('entrar', 'No se pudo cargar. Revisa tu conexión y recarga la página.'));
