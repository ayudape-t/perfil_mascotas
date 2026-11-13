/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Portal de veterinarias (veterinaria.html). Va después de js/comun.js.
   La clínica crea su cuenta (Supabase Auth, correo confirmado) y llena sus datos; el equipo de Kutimuy la aprueba desde
   soporte.html. Una mascota es su paciente cuando el dueño acepta su pedido (Telegram o panel). Todo lo decide el servidor
   (funciones vet_*): esta página solo muestra lo que él devuelve. */

// Sesión propia (no se mezcla con el panel de soporte) y el enlace de los correos vuelve aquí
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'kutimuy-vet', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const AQUI = location.origin + location.pathname;
const WA_KUTIMUY = '51921512933';

let recuperando = /type=recovery/.test(location.hash);   // llegó desde el correo de «contraseña nueva»
let cuenta = null;
let pacientes = [];
let fichaActual = null;
const pedirAlEntrar = new URLSearchParams(location.search).get('pedir') || '';   // vet.html?id=… → «tenerlo como paciente»

const soloDigitos = v => String(v || '').replace(/\D/g, '');
const fmtTel = p => {
  const t = soloDigitos(p);
  if (!t) return '';
  return (t.length === 11 && t.startsWith('51')) ? `+51 ${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : '+' + t;
};
const telCorto = p => { const t = soloDigitos(p); return t.length === 11 && t.startsWith('51') ? `${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : fmtTel(p); };   // en el botón: cabe en celulares chicos
const fmtDia = iso => iso ? new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '';
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });   // AAAA-MM-DD
const waA = (tel, texto) => `https://wa.me/${soloDigitos(tel)}?text=${encodeURIComponent(texto)}`;
const cadaMeses = n => !n ? '' : n % 12 === 0 ? (n === 12 ? 'cada año' : `cada ${n / 12} años`) : (n === 1 ? 'cada mes' : `cada ${n} meses`);
// El código de la placa, escrito o dentro del enlace del QR (…index.html?id=XXXX)
const extraerPlaca = v => {
  const t = String(v || '').trim(), m = t.match(/[?&]id=([A-Za-z0-9_-]{1,40})/);
  return (m ? m[1] : t).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);
};

// ==================== ACCESO ====================
// shortcut: copia del acceso de js/soporte.js sin el segundo factor; si se toca a menudo, pasarlo a un archivo común
const PASOS = ['entrar', 'crear', 'olvide', 'correo', 'nueva-clave', 'datos', 'revision', 'cerrada'];
function mostrarPaso(paso, msg, tipo = 'error') {
  $('cargando').classList.add('hidden');
  $('app').classList.add('hidden');
  $('acceso').classList.remove('hidden');
  PASOS.forEach(p => $(`paso-${p}`).classList.toggle('hidden', p !== paso));
  mensajeAcceso(msg, tipo);
  const primero = $(`paso-${paso}`).querySelector('input:not(.hidden)');
  if (primero && !primero.value) setTimeout(() => primero.focus({ preventScroll: true }), 60);
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
  if (/signup_disabled|Signups not allowed/i.test(m)) return 'Por ahora no se pueden crear cuentas. Escríbenos por WhatsApp al 921 512 933 y te ayudamos.';
  if (/weak_password|Password should|password.*(short|weak)/i.test(m)) return 'La contraseña es muy débil: usa al menos 10 caracteres, con letras y números.';
  // El correo de prueba de Supabase solo escribe al equipo del proyecto y manda muy pocos por hora: sin un correo propio (SMTP) falla aquí
  if (/email_address_not_authorized|not authorized/i.test(m)) return 'No pudimos enviarte el correo de confirmación. Escríbenos por WhatsApp al 921 512 933 y activamos tu cuenta.';
  if (/rate.?limit|over_email_send/i.test(m)) return 'No pudimos enviar el correo ahora. Inténtalo en una hora o escríbenos por WhatsApp al 921 512 933.';
  if (/fetch|network/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return 'No se pudo completar: ' + ((e && e.message) || 'error desconocido') + '.';
}

async function ocupado(btn, texto, accion) {
  const antes = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${esc(texto)}</span>`;
  try { return await accion(); } finally { btn.disabled = false; btn.innerHTML = antes; }
}

// Decide qué pantalla toca según la sesión y el estado de la clínica
async function revisarAcceso() {
  try { return await decidirPantalla(); }
  catch (e) { return mostrarPaso('entrar', errorAuth(e)); }   // sesión dañada o sin conexión: nunca se queda colgada
}
async function decidirPantalla() {
  const { data: { session } } = await sb.auth.getSession();
  $('btn-salir').classList.toggle('hidden', !session);
  if (!session) return mostrarPaso('entrar');
  $('nc-correo').value = $('cc-correo').value = session.user.email || '';
  if (recuperando) return mostrarPaso('nueva-clave');
  const { data: c, error } = await sb.rpc('vet_mi_cuenta');
  if (error || !c) return mostrarPaso('entrar', 'No se pudo revisar tu cuenta. Revisa tu conexión e inténtalo de nuevo.');
  cuenta = c;
  if (c.estado === 'aprobada') return abrirPortal();
  if (c.estado === 'sin_registro') return mostrarPaso('datos');
  if (c.estado === 'pendiente') {
    $('revision-texto').textContent = `Te escribiremos por WhatsApp al ${fmtTel(c.telefono)} cuando ${c.nombre} esté activa. Suele tomar un día hábil.`;
    return mostrarPaso('revision');
  }
  const suspendida = c.estado === 'suspendida';
  $('cerrada-titulo').textContent = suspendida ? 'Tu cuenta está suspendida' : 'No pudimos aprobar tu cuenta';
  $('cerrada-texto').textContent = suspendida
    ? 'Por ahora no puedes ver a tus pacientes. Escríbenos y lo vemos juntos.'
    : 'Revisa que el nombre y el RUC o la colegiatura sean correctos, o escríbenos y lo vemos juntos.';
  $('cerrada-wa').href = waA(WA_KUTIMUY, `Hola Kutimuy, les escribe ${c.nombre} (cuenta de veterinaria).`);
  $('cerrada-corregir').classList.toggle('hidden', suspendida);
  return mostrarPaso('cerrada');
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
  if (!email) return mensajeAcceso('Escribe el correo de tu clínica.');
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
    $('correo-texto').textContent = `Te enviamos un enlace a ${email}. Ábrelo (mira también en «Spam») y luego entra aquí con tu contraseña para llenar los datos de tu clínica.`;
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
    history.replaceState(null, '', location.pathname + location.search);
    aviso('Contraseña cambiada.', 'ok');
    await revisarAcceso();
  });
}

// Ya dentro del portal: la clínica pone su propia contraseña (p. ej. después de una temporal que le dio soporte)
async function cambiarClave() {
  const p1 = $('cc-clave1').value, p2 = $('cc-clave2').value, res = $('res-clave');
  const mostrar = (texto, tipo) => { res.textContent = texto; res.className = `msg ${tipo}`; };
  if (p1.length < 10) return mostrar('La contraseña debe tener al menos 10 caracteres.', 'error');
  if (p1 !== p2) return mostrar('Las contraseñas no coinciden.', 'error');
  await ocupado($('btn-clave'), 'Guardando...', async () => {
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return mostrar(/same_password|different from the old/i.test((error.code || '') + ' ' + error.message) ? 'Esa ya es tu contraseña: escribe una distinta.' : errorAuth(error), 'error');
    $('cc-clave1').value = ''; $('cc-clave2').value = '';
    mostrar('Listo: desde ahora entras con tu contraseña nueva.', 'ok');
  });
}

function irADatos() {   // con lo que ya mandó, para corregir
  if (cuenta && cuenta.nombre) {
    $('d-nombre').value = cuenta.nombre || '';
    $('d-doc').value = cuenta.documento || '';
    $('d-tel').value = cuenta.telefono || '';
    $('d-dir').value = cuenta.direccion || '';
  }
  mostrarPaso('datos');
}

async function enviarDatos() {
  const nombre = $('d-nombre').value.trim(), doc = $('d-doc').value.trim(), tel = $('d-tel').value, dir = $('d-dir').value.trim();
  if (nombre.length < 2) return mensajeAcceso('Escribe el nombre de tu clínica.');
  if (doc.length < 4) return mensajeAcceso('Escribe tu RUC o tu número de colegiatura.');
  if (soloDigitos(tel).length < 8) return mensajeAcceso('Escribe un teléfono válido (de preferencia con WhatsApp).');
  await ocupado($('btn-datos'), 'Enviando...', async () => {
    const { data, error } = await sb.rpc('vet_registrarse', { p_nombre: nombre, p_documento: doc, p_telefono: tel, p_direccion: dir });
    if (error || !data) return mensajeAcceso('No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.');
    if (data.estado === 'ok') return revisarAcceso();
    mensajeAcceso({
      correo_sin_confirmar: 'Primero confirma tu correo con el enlace que te enviamos.',
      datos_invalidos: 'Revisa los datos: el nombre, el RUC o la colegiatura y un teléfono de 9 números.',
      ya_registrada: 'Tu clínica ya está registrada.',
      sin_sesion: 'Tu sesión venció: vuelve a entrar.',
    }[data.estado] || 'No se pudo enviar.');
  });
}

async function salir() {
  pacientes = []; fichaActual = null; cuenta = null;
  $('ficha').innerHTML = ''; $('lista-pacientes').innerHTML = '';
  $('cc-clave1').value = ''; $('cc-clave2').value = ''; $('res-clave').className = 'msg hidden';
  try { await sb.auth.signOut(); } catch (e) {}
  $('btn-salir').classList.add('hidden');
  $('top-sub').textContent = 'Portal de clínicas';
  mostrarPaso('entrar');
}

// ==================== PORTAL ====================
async function llamar(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw new Error(/jwt|401|auth/i.test(error.message) ? 'Tu sesión venció: vuelve a entrar.' : 'Sin conexión o error del servidor.');
  if (data && data.estado === 'sin_permiso') { revisarAcceso(); throw new Error('Tu cuenta ya no tiene acceso.'); }
  return data;
}

function abrirPortal() {
  $('top-sub').textContent = cuenta.nombre || 'Portal de clínicas';
  $('acceso').classList.add('hidden');
  $('app').classList.remove('hidden');
  verLista();
  cargarPacientes();
  if (pedirAlEntrar && !$('placa').value) $('placa').value = extraerPlaca(pedirAlEntrar);
}

function verLista() {
  $('vista-ficha').classList.add('hidden');
  $('vista-lista').classList.remove('hidden');
  fichaActual = null;
}

const fotoMini = (src, clase) => src
  ? `<img src="${esc(src)}" alt="" class="${clase}" loading="lazy">`
  : `<span class="${clase} vacia"><i class="fa-solid fa-paw"></i></span>`;
// Si una foto no carga, queda la huellita
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !/pac-foto|ficha-foto/.test(img.className)) return;
  img.replaceWith(Object.assign(document.createElement('span'), { className: img.className + ' vacia', innerHTML: '<i class="fa-solid fa-paw"></i>' }));
}, true);

async function cargarPacientes() {
  const caja = $('lista-pacientes');
  if (!pacientes.length) caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Cargando tus pacientes...</p>';
  try {
    const r = await llamar('vet_mis_pacientes');
    pacientes = (r && r.pacientes) || [];
    pintarPacientes();
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}

function pintarPacientes() {
  const q = $('filtro').value.trim().toLowerCase();
  const lista = pacientes.filter(p => !q || [p.pet, p.owner, p.id, p.breed].some(v => String(v || '').toLowerCase().includes(q)));
  $('lista-pacientes').innerHTML = lista.length ? lista.map(p => p.estado === 'activa' ? `
    <button type="button" class="item" data-paciente="${esc(p.id)}">
      ${fotoMini(p.photo, 'pac-foto')}
      <span class="item-txt"><b>${esc(p.pet || 'Mascota')}</b>
        <small>${esc([p.owner, p.breed].filter(Boolean).join(' · '))}</small>
        <small class="ultima">${p.ultima_visita ? `Última consulta: ${esc(fmtFecha(p.ultima_visita))}` : 'Sin consultas registradas'}</small></span>
      <span class="item-der">${p.perdida ? '<span class="chip rojo"><i class="fa-solid fa-bullhorn"></i> Perdida</span>' : ''}<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
    </button>` : `
    <div class="item pendiente">
      ${fotoMini('', 'pac-foto')}
      <span class="item-txt"><b>${esc(p.pet || 'Mascota')}</b><small>Esperando que su dueño acepte · pedido el ${esc(fmtDia(p.pedida_en))}</small></span>
      <span class="item-der"><span class="chip ocre">Pendiente</span></span>
    </div>`).join('')
    : q ? `<p class="vacio">Nadie con «${esc(q)}».</p>`
    : '<p class="vacio"><i class="fa-solid fa-paw"></i> Todavía no tienes pacientes. Pide el primero arriba con el código de su placa.</p>';
}

async function pedirPaciente() {
  const id = extraerPlaca($('placa').value), res = $('res-pedir');
  const mostrar = (texto, tipo) => { res.textContent = texto; res.className = `msg ${tipo}`; };
  if (!id) return mostrar('Escribe el código de la placa o pega el enlace de su QR.', 'error');
  try {
    const r = await ocupado($('btn-pedir'), 'Enviando...', () => llamar('vet_pedir_paciente', { p_placa: id }));
    const pet = r.pet || 'la mascota';
    if (r.estado === 'ok') {
      mostrar(r.telegram
        ? `Listo: le avisamos al dueño de ${pet} por Telegram. Cuando acepte, aparecerá en tu lista.`
        : `Listo. El dueño de ${pet} verá tu pedido en su panel (Historial médico → Veterinarias). Avísale para que lo acepte.`, 'ok');
      $('placa').value = '';
      lanzarFiguras($('btn-pedir'), 8);
      return cargarPacientes();
    }
    if (r.estado === 'ya_activa') { $('placa').value = ''; res.classList.add('hidden'); return abrirFicha(r.id); }
    mostrar({
      ya_pendiente: `Ya le pediste al dueño de ${pet}. Espera su respuesta; si no la ves, podrás pedírselo de nuevo mañana.`,
      rechazada_reciente: `El dueño de ${pet} no aceptó hace poco. Podrás volver a pedírselo en 24 horas.`,
      no_existe: 'No encontramos esa placa. Revisa el código (está en el enlace de su QR, después de «id=»).',
      sin_activar: 'Esa placa todavía no se activó: su dueño debe activarla primero.',
      limite: 'Hiciste muchos pedidos hoy. Inténtalo de nuevo mañana.',
    }[r.estado] || 'No se pudo enviar el pedido.', r.estado === 'ya_pendiente' ? 'info' : 'error');
  } catch (e) { mostrar(e.message, 'error'); }
}

// ---- Ficha de un paciente ----
async function abrirFicha(id) {
  $('vista-lista').classList.add('hidden');
  $('vista-ficha').classList.remove('hidden');
  window.scrollTo({ top: 0 });
  const caja = $('ficha');
  caja.innerHTML = '<p class="intro"><i class="fa-solid fa-spinner fa-spin"></i> Cargando la ficha...</p>';
  try {
    const r = await llamar('vet_ficha', { p_placa: id });
    if (r.estado !== 'ok') {
      caja.innerHTML = '<p class="msg error">Ya no tienes acceso a esta mascota: su dueño lo quitó.</p>';
      return cargarPacientes();
    }
    fichaActual = r;
    pintarFicha(r);
  } catch (e) { caja.innerHTML = `<p class="msg error">${esc(e.message)}</p>`; }
}

function pintarFicha(r) {
  const m = r.mascota, hist = r.historial || [];
  const fila = (ico, t, v, clase = '') => v ? `<div class="dato ${clase}"><i class="fa-solid ${ico}"></i><span>${t}</span><b>${esc(v)}</b></div>` : '';
  const carnet = (fecha, cada) => fecha ? `${/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fmtFecha(fecha) : fecha}${cada ? ` (${cadaMeses(cada)})` : ''}` : '';
  const saludo = `Hola ${m.owner || ''}, le escribimos de ${cuenta.nombre} sobre ${m.pet} 🐾`;
  const hoy = hoyLima();
  $('ficha').innerHTML = `
    <div class="ficha-cab">
      ${fotoMini(m.photo, 'ficha-foto')}
      <div>
        <h2>${esc(m.pet || 'Mascota')}</h2>
        <div class="chips">${m.breed ? `<span class="chip gris">${esc(m.breed)}</span>` : ''}${m.perdida ? '<span class="chip rojo"><i class="fa-solid fa-bullhorn"></i> Perdida</span>' : ''}</div>
        <div class="id-fila"><code>${esc(m.id)}</code></div>
      </div>
    </div>
    ${m.perdida ? `<p class="alerta"><i class="fa-solid fa-triangle-exclamation"></i><span>Su dueño la reportó como perdida. Si está en tu clínica, avísale ahora.</span></p>` : ''}

    <section class="tarjeta">
      <h3><i class="fa-solid fa-user"></i> Dueño</h3>
      <p class="dueno"><b>${esc(m.owner || '—')}</b></p>
      ${m.phone ? `<div class="fila">
        <a class="btn btn-verde" href="${esc(waA(m.phone, saludo))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> <span>${esc(telCorto(m.phone))}</span></a>
        <a class="btn btn-line" href="tel:+${esc(soloDigitos(m.phone))}"><i class="fa-solid fa-phone"></i> <span>Llamar</span></a>
      </div>` : ''}
      ${m.phone_secondary ? `<p class="intro">Teléfono 2: <a class="tel" href="tel:+${esc(soloDigitos(m.phone_secondary))}">${esc(fmtTel(m.phone_secondary))}</a></p>` : ''}
    </section>

    <section class="tarjeta">
      <h3><i class="fa-solid fa-notes-medical"></i> Ficha médica</h3>
      <div>
        ${fila('fa-triangle-exclamation', 'Alergias', m.allergies, 'importante')}
        ${fila('fa-pills', 'Medicación y notas', m.medical_notes)}
        ${fila('fa-bowl-food', 'Alimentación', m.diet)}
        ${fila('fa-syringe', 'Próxima vacuna', carnet(m.next_vaccine, m.vaccine_every))}
        ${fila('fa-shield-virus', 'Próxima desparasitación', carnet(m.next_deworming, m.deworming_every))}
        ${fila('fa-cake-candles', 'Edad', m.age)}
        ${fila('fa-weight-scale', 'Peso', m.weight)}
        ${fila('fa-palette', 'Color', m.color)}
      </div>
      ${[m.allergies, m.medical_notes, m.diet, m.next_vaccine, m.next_deworming, m.age, m.weight, m.color].some(Boolean) ? '' : '<p class="intro">Su dueño todavía no llenó la ficha médica.</p>'}
    </section>

    <form id="form-consulta" class="tarjeta" novalidate>
      <h3><i class="fa-solid fa-file-medical"></i> Registrar una consulta</h3>
      <div class="g2">
        <div><label class="lbl" for="c-fecha">Fecha</label><input type="date" id="c-fecha" class="fld" value="${hoy}" max="${hoy}"></div>
        <div><label class="lbl" for="c-proxima">Próxima cita</label><input type="date" id="c-proxima" class="fld" min="${hoy}"></div>
      </div>
      <label class="lbl" for="c-motivo">Motivo o vacuna</label>
      <input id="c-motivo" class="fld" maxlength="200" placeholder="Ej. Vacuna quíntuple">
      <label class="lbl" for="c-diag">Diagnóstico (opcional)</label>
      <input id="c-diag" class="fld" maxlength="500">
      <label class="lbl" for="c-receta">Receta o tratamiento (opcional)</label>
      <textarea id="c-receta" class="fld" rows="2" maxlength="1000"></textarea>
      <button id="btn-consulta" type="submit" class="btn btn-verde"><i class="fa-solid fa-floppy-disk"></i> <span>Guardar en su historial</span></button>
      <p class="intro">Queda a nombre de ${esc(cuenta.nombre)} y su dueño la ve en su panel (y en Telegram, si lo tiene).</p>
    </form>

    <section class="tarjeta">
      <h3><i class="fa-solid fa-clock-rotate-left"></i> Historial (${hist.length})</h3>
      <div class="historial">${hist.length ? hist.map(h => `
        <div class="consulta">
          <div class="consulta-cab"><b>${esc(h.motivo || 'Consulta')}</b><span>${esc(fmtFecha(h.fecha))}</span></div>
          <small>${esc(h.vet || '')}${h.por === 'dueno' ? ' · anotado por su dueño' : ''}</small>
          ${h.diagnostico ? `<p><b>Diagnóstico:</b> ${esc(h.diagnostico)}</p>` : ''}
          ${h.receta ? `<p class="receta"><b>Receta:</b> ${esc(h.receta)}</p>` : ''}
          ${h.proxima ? `<small><i class="fa-regular fa-calendar"></i> Próxima: ${esc(fmtFecha(h.proxima))}</small>` : ''}
        </div>`).join('') : '<p class="intro">Sin consultas todavía.</p>'}
      </div>
    </section>`;
  $('form-consulta').addEventListener('submit', e => { e.preventDefault(); guardarConsulta(); });
}

async function guardarConsulta() {
  const f = fichaActual;
  if (!f) return;
  const fecha = $('c-fecha').value, motivo = $('c-motivo').value.trim(), prox = $('c-proxima').value;
  if (!fecha || fecha > hoyLima()) return aviso('Elige la fecha de la consulta (no puede ser futura).', 'error');
  if (!motivo) { $('c-motivo').focus(); return aviso('Escribe el motivo de la consulta.', 'error'); }
  if (prox && prox < fecha) return aviso('La próxima cita no puede ser antes de la consulta.', 'error');
  const btn = $('btn-consulta');
  try {
    const r = await ocupado(btn, 'Guardando...', () => llamar('vet_registrar_consulta', {
      p_placa: f.mascota.id, p_fecha: fecha, p_motivo: motivo, p_diagnostico: $('c-diag').value,
      p_receta: $('c-receta').value, p_proxima: prox || null,
    }));
    if (r.estado === 'ok') {
      lanzarFiguras(btn, 10);
      aviso(`Consulta guardada en el historial de ${f.mascota.pet}.`, 'ok');
      return abrirFicha(f.mascota.id);
    }
    aviso({
      datos_invalidos: 'Revisa la fecha (no futura ni de hace más de un año), el motivo y la próxima cita.',
      sin_acceso: 'Ya no tienes acceso a esta mascota: su dueño lo quitó.',
      limite: 'Llegaste al límite de consultas de hoy. Inténtalo mañana.',
    }[r.estado] || 'No se pudo guardar.', 'error');
    if (r.estado === 'sin_acceso') { verLista(); cargarPacientes(); }
  } catch (e) { aviso(e.message, 'error'); }
}

// ==================== EVENTOS ====================
ondaAlTocar('.btn');
const alEnviar = (id, accion) => $(id).addEventListener('submit', e => { e.preventDefault(); accion(); });
alEnviar('paso-entrar', entrar);
alEnviar('paso-crear', crearCuenta);
alEnviar('paso-olvide', olvideClave);
alEnviar('paso-nueva-clave', guardarClaveNueva);
alEnviar('paso-datos', enviarDatos);
alEnviar('form-pedir', pedirPaciente);
alEnviar('form-clave', cambiarClave);
alClic('ir-crear', () => { $('cr-correo').value = $('in-correo').value; mostrarPaso('crear'); });
alClic('ir-olvide', () => { $('ol-correo').value = $('in-correo').value; mostrarPaso('olvide'); });
document.querySelectorAll('.volver-entrar').forEach(b => b.addEventListener('click', () => mostrarPaso('entrar')));
document.querySelectorAll('.ir-datos').forEach(b => b.addEventListener('click', irADatos));
alClic('btn-revisar', () => ocupado($('btn-revisar'), 'Revisando...', revisarAcceso));
alClic('btn-salir', salir);
alClic('ficha-volver', () => { verLista(); pintarPacientes(); });
$('filtro').addEventListener('input', pintarPacientes);
$('lista-pacientes').addEventListener('click', e => {
  const b = e.target.closest('[data-paciente]');
  if (b) abrirFicha(b.dataset.paciente);
});

sb.auth.onAuthStateChange(evento => {
  if (evento === 'PASSWORD_RECOVERY') { recuperando = true; setTimeout(revisarAcceso, 0); }
});
revisarAcceso().catch(() => mostrarPaso('entrar', 'No se pudo cargar. Revisa tu conexión y recarga la página.'));
