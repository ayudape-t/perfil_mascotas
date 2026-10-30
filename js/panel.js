/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Comportamiento de el panel del dueño (registro.html). Va después de js/comun.js */

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const db = client;
const val = id => ($(id) || {}).value || '';
const soloFecha = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
let tagId = '';
let existingPhotoUrl = "";
let savedPin = null;
let isLostState = false;
let pinSesion = '';
let esPlacaNueva = false;   // se está activando la placa (aún no tiene mascota)
const nombreMascota = () => val('input-pet').trim() || 'tu mascota';
const normalizarTel = t => { const d = String(t || '').replace(/\D/g, ''); return (d.length === 9 && d[0] === '9') ? '51' + d : d; };
const msgEstado = e =>
  e === 'bloqueado' ? 'Demasiados intentos: espera 15 minutos.' :
  e === 'incorrecto' ? 'Tu sesión venció: vuelve a entrar con tu PIN desde el perfil.' :
  e === 'pin_debil' ? MSG_PIN_FACIL :
  e === 'no_existe' ? 'Primero guarda los datos de la placa.' :
  e === 'pin_invalido' ? 'El PIN debe ser de 4 números.' :
  e === 'codigo_incorrecto' ? 'El código de activación es incorrecto.' :
  e === 'placa_invalida' ? 'Esta placa no es válida o ya fue activada.' :
  e === 'telefono_invalido' ? 'Revisa los teléfonos: usa solo números, con código de país (ej. 51987654321).' :
  e === 'sin_fecha' ? 'Primero guarda una fecha en el carnet.' :
  e === 'ya_registrado' ? 'Ya lo anotaste hoy en el historial.' :
  e === 'no_encontrado' ? 'Ese registro ya no existe.' :
  'Revisa los datos (' + e + ').';
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });   // AAAA-MM-DD

[...document.querySelectorAll('#pet-form > *')].forEach((el, i) => el.style.setProperty('--i', i));

// ---- Animaciones al tocar (todas se apagan con «reducir movimiento») ----
const espera = ms => new Promise(r => setTimeout(r, sinMovimiento ? 0 : ms));
// Onda que nace donde se tocó el botón; su ícono salta
ondaAlTocar('.btn, #btn-save, .btn-mini, .btn-hecho, #btn-toggle-lost, .btn-maps');

// «+ Registrar» del perfil llega con #registrar-medico (#seccion-medica en enlaces anteriores):
// se abre el formulario «Agregar atención o vacuna» y se baja hasta él.
let tocoPantalla = false;
function mostrarFormularioMedico(suave) {
  const seccion = $('seccion-medica'), form = $('form-medical-record');
  if (!seccion || !form || seccion.classList.contains('hidden')) return;
  seccion.open = true;
  const sub = form.closest('details');
  if (sub) sub.open = true;
  seccion.scrollIntoView({ behavior: suave && !sinMovimiento ? 'smooth' : 'auto', block: 'start' });
}
function vigilarToque() {   // si ya tocó la pantalla, no se le vuelve a mover la vista
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => { tocoPantalla = true; }, { once: true, passive: true }));
}

// ---- Carnet: frecuencia y «Ya lo hice» ----
const CARNET = {
  vacuna:          { fecha: 'input-next-vaccine',   cada: 'input-vaccine-every',   btn: 'btn-hecho-vacuna',          nombre: 'la vacuna',          guardada: { fecha: '', cada: '' } },
  desparasitacion: { fecha: 'input-next-deworming', cada: 'input-deworming-every', btn: 'btn-hecho-desparasitacion', nombre: 'la desparasitación', guardada: { fecha: '', cada: '' } }
};
function ponerFrecuencia(id, n) {   // si la base trae una frecuencia que la lista no tiene (2 meses, 2 años...), se agrega como opción
  const sel = $(id), v = n ? String(n) : '';
  if (v && ![...sel.options].some(o => o.value === v)) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = n % 12 === 0 ? `Cada ${n / 12} años` : `Cada ${n} meses`;
    sel.appendChild(o);
  }
  sel.value = v;
}
function recordarCarnet(tipo) {      // lo que ya está guardado en el servidor
  const c = CARNET[tipo];
  c.guardada = { fecha: val(c.fecha), cada: val(c.cada) };
}
function actualizarBotonesCarnet() { // «Ya lo hice» solo con la fecha ya guardada: el servidor usa lo guardado, no lo que está a medio cambiar
  Object.values(CARNET).forEach(c => {
    const igual = val(c.fecha) === c.guardada.fecha && val(c.cada) === c.guardada.cada;
    $(c.btn).classList.toggle('hidden', !(c.guardada.fecha && igual));
  });
}
Object.values(CARNET).forEach(c => [c.fecha, c.cada].forEach(id =>
  ['input', 'change'].forEach(ev => $(id).addEventListener(ev, actualizarBotonesCarnet))));

async function marcarCarnetHecho(tipo) {
  const c = CARNET[tipo], btn = $(c.btn);
  if (!pinSesion) { aviso('Vuelve a entrar con tu PIN desde el perfil.', 'error'); return; }
  const sigue = !!c.guardada.cada;
  if (!confirm(`¿Ya aplicaste ${c.nombre}? Se anotará en el historial con la fecha de hoy` +
      (sigue ? ' y la fecha del carnet pasará a la siguiente.' : '. Como no se repite, la fecha del carnet se quitará.'))) return;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Anotando...`;
  try {
    const { data, error } = await db.rpc('marcar_carnet_hecho', { p_id: tagId, p_pin: pinSesion, p_tipo: tipo });
    if (error || !data) throw new Error('No se pudo anotar. Revisa tu conexión e intenta de nuevo.');
    if (data.estado !== 'ok') throw new Error(msgEstado(data.estado));
    $(c.fecha).value = soloFecha(data.proxima);
    recordarCarnet(tipo);
    aviso(data.proxima
      ? `Anotado en el historial. Próxima fecha: ${fmtFecha(data.proxima)}.`
      : 'Anotado en el historial. Como no se repite, la fecha del carnet se quitó: pon la próxima cuando la tengas.', 'ok');
    await cargarHistorialPrivado();
  } catch (err) {
    aviso(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
    actualizarBotonesCarnet();
  }
}

async function inicializar() {
  tagId = new URLSearchParams(window.location.search).get('id') || '';
  $('input-id').value = tagId;
  if (!tagId) { aviso('Enlace de placa no válido.', 'error'); return; }
  revisarCanal();
  const irAMedico = ['#registrar-medico', '#seccion-medica'].includes(window.location.hash);

  const { data: existe } = await client.rpc('obtener_mascota', { p_id: tagId });
  if (existe) {
    pinSesion = sessionStorage.getItem(`pin_${tagId}`) || '';
    const { data: priv } = pinSesion
      ? await client.rpc('obtener_mascota_privada', { p_id: tagId, p_pin: pinSesion })
      : { data: null };
    if (!priv || priv.estado !== 'ok') {   // sin sesión (o venció): el perfil abre directo la ventana del PIN
      sessionStorage.removeItem(`pin_${tagId}`);
      window.location.href = `index.html?id=${encodeURIComponent(tagId)}&entrar=1`;
      return;
    }
    const data = priv.mascota;

    $('form-title').innerText = "Editar Placa";
    $('pin-creation-box').classList.add('hidden');
    $('lost-toggle-box').classList.remove('hidden');
    $('seguridad-card').classList.add('hidden');
    $('seccion-medica').classList.remove('hidden');

    const campos = {
      'input-pet': 'pet', 'input-breed': 'breed', 'input-color': 'color', 'input-weight': 'weight',
      'input-age': 'age', 'input-description': 'description', 'input-owner': 'owner',
      'input-phone': 'phone', 'input-phone-secondary': 'phone_secondary',
      'input-lost-location': 'lost_location', 'input-lost-date': 'lost_date', 'input-lost-time': 'lost_time',
      'input-allergies': 'allergies', 'input-medical': 'medical_notes', 'input-diet': 'diet',
      'input-vet-name': 'vet_name', 'input-vet-phone': 'vet_phone'
    };
    for (const [idEl, col] of Object.entries(campos)) { if ($(idEl)) $(idEl).value = data[col] || ''; }
    // Las fechas antiguas escritas como texto ("15 de Octubre") no se pueden convertir: quedan vacías
    $('input-next-vaccine').value = soloFecha(data.next_vaccine);
    $('input-next-deworming').value = soloFecha(data.next_deworming);
    ponerFrecuencia('input-vaccine-every', data.vaccine_every);
    ponerFrecuencia('input-deworming-every', data.deworming_every);
    recordarCarnet('vacuna'); recordarCarnet('desparasitacion'); actualizarBotonesCarnet();
    $('input-reward').checked = data.reward || false;

    savedPin = pinSesion;
    isLostState = data.is_lost || false;
    lostPunto = data.lost_lat != null && data.lost_lon != null ? [data.lost_lat, data.lost_lon] : null;
    actualizarBotonAlarmaUI();

    if (data.photo) {
      existingPhotoUrl = data.photo;
      const p = $('preview-photo');
      p.src = data.photo;
      p.classList.remove('hidden');
      $('placeholder-icon').classList.add('hidden');
    }
    cargarMisMascotas({ id: tagId, n: data.pet || '', f: data.photo || '', p: !!data.is_lost });
    if (irAMedico) { mostrarFormularioMedico(true); vigilarToque(); }
  } else {
    const { data: est } = await client.rpc('estado_placa', { p_id: tagId });
    if (est !== 'sin_activar') { window.location.href = `index.html?id=${encodeURIComponent(tagId)}`; return; }
    // Placa nueva: solo lo necesario para activarla, en 3 pasos (lo del canal y los escaneos aparece después)
    esPlacaNueva = true;
    $('activation-box').classList.remove('hidden');
    $('form-title').innerText = 'Activar placa';
    $('form-subtitle').innerText = 'Ten a mano la tarjeta del empaque';
    $('escaneos-card').classList.add('hidden');
    document.querySelectorAll('#pet-form .pill.req').forEach((p, i) => { p.textContent = `Paso ${i + 1} de 3`; });
    $('btn-save').innerHTML = textoBotonGuardar();
    actualizarBannerCanal();
  }
  let telegram = null;
  if (existe) { localStorage.setItem(`dueno_${tagId}`, '1'); telegram = refrescarTelegram().catch(() => {}).then(cargarDispositivos); }   // aparecen juntos: un solo empujón que se corrige abajo
  await cargarHistorialPrivado();
  await cargarHistorialEscaneos();
  // El aviso de Telegram y el último escaneo pueden mover lo de arriba: si no tocó nada, el formulario vuelve a quedar a la vista
  if (irAMedico && existe) {
    try { await telegram; } catch (e) {}
    if (!tocoPantalla) mostrarFormularioMedico(false);
  }
}

// Celulares que pueden entrar con el PIN (el que activó la placa y los verificados con Telegram o la tarjeta)
async function cargarDispositivos() {
  if (!pinSesion) return;
  let r = null;
  try { const { data } = await client.rpc('mis_dispositivos', { p_id: tagId, p_sesion: pinSesion }); r = data; } catch (e) {}
  if (!r || r.estado !== 'ok') return;
  const lista = r.dispositivos || [];
  const otros = lista.filter(d => !d.este);
  $('disp-estado').textContent = otros.length === 0
    ? 'Solo este celular puede entrar con tu PIN. En otro te pediremos un código.'
    : `Este y ${otros.length === 1 ? '1 más' : otros.length + ' más'}: ${otros.slice(0, 3).map(d => d.etiqueta).join(', ')}${otros.length > 3 ? '…' : ''}.`;
  $('btn-disp').classList.toggle('hidden', otros.length === 0);
  $('disp-box').classList.remove('hidden');
}
async function quitarOtrosDispositivos() {
  if (!confirm('¿Quitar el acceso a los demás celulares? Para volver a entrar desde ellos tendrán que confirmar con un código.')) return;
  const btn = $('btn-disp');
  btn.disabled = true;
  let r = null;
  try { const { data } = await client.rpc('cerrar_otros_dispositivos', { p_id: tagId, p_sesion: pinSesion }); r = data; } catch (e) {}
  btn.disabled = false;
  if (!r || r.estado !== 'ok') { aviso('No se pudo quitar el acceso. ' + msgEstado(r ? r.estado : 'sin_conexion'), 'error'); return; }
  await cargarDispositivos();
}

// La alarma se guarda en el momento (sin esperar a «Guardar Cambios»): así nunca queda a medias si se cierra la página.
// Al activarla, el pututu llama a la comunidad; al volver a casa, cae mixtura.
let guardandoAlarma = false;
async function toggleMascotaPerdida() {
  if (guardandoAlarma) return;
  const activar = !isLostState, nombre = nombreMascota();
  if (activar && !confirm(`¿Activar la alarma? Quien escanee la placa de ${nombre} verá que se perdió y podrá avisarte dónde está.`)) return;
  guardandoAlarma = true;
  const btn = $('btn-toggle-lost');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${activar ? 'Activando la alarma...' : 'Guardando...'}</span>`;
  isLostState = activar;
  try {
    await enviarDatos();
  } catch (err) {
    isLostState = !activar;
    aviso((activar ? 'No se pudo activar la alarma: ' : 'No se pudo guardar: ') + err.message, 'error');
    return;
  } finally {
    guardandoAlarma = false;
    btn.disabled = false;
    actualizarBotonAlarmaUI();
  }
  const caja = $('lost-toggle-box');
  repetir(btn, 'rebote', 520);
  if (activar) {
    repetir(caja, 'llamado', 2100);
    vibrar([60, 50, 60, 50, 140]);
    aviso('Alarma activada. Completa dónde se perdió y toca «Guardar Cambios» para el afiche y el canal.', 'ok');
  } else {
    repetir(caja, 'en-casa', 950);
    lanzarFiguras($('estado-ico'), 12);
    vibrar(25);
    aviso(`¡Qué alegría! ${nombre} ya está en casa.`, 'ok');
  }
}

// Invitación al canal para todos cuando hay mascotas perdidas publicadas (con la alarma activa ya va dentro del recuadro rojo;
// al activar una placa nueva no aparece: primero lo primero)
let hayAvisosCanal = false;
function revisarCanal() {
  Promise.resolve(client.rpc('canal_hay_avisos'))
    .then(({ data }) => { hayAvisosCanal = data === true; actualizarBannerCanal(); })
    .catch(() => {});
}
function actualizarBannerCanal() { $('canal-banner').classList.toggle('hidden', !hayAvisosCanal || isLostState || esPlacaNueva); }

function actualizarBotonAlarmaUI() {
  actualizarBannerCanal();
  const nombre = val('input-pet').trim();
  $('lost-toggle-box').classList.toggle('perdida', isLostState);
  $('estado-i').className = 'fa-solid ' + (isLostState ? 'fa-bullhorn' : 'fa-house-chimney');
  $('estado-titulo').textContent = isLostState ? `Alarma activa: buscando a ${nombre || 'tu mascota'}` : `${nombre || 'Tu mascota'} está en casa`;
  $('estado-texto').textContent = isLostState
    ? 'Quien escanee su placa verá que se perdió y podrá enviarte su ubicación.'
    : 'Si se pierde, activa la alarma: quien escanee su placa lo sabrá al instante.';
  $('btn-toggle-lost').innerHTML = isLostState
    ? '<i class="fa-solid fa-house-chimney"></i> <span>¡Ya volvió a casa!</span>'
    : '<i class="fa-solid fa-bullhorn"></i> <span>¿Se perdió? Activar alarma</span>';
  $('lost-details-box').classList.toggle('hidden', !isLostState);
  if (isLostState) abrirMapaPerdida();
}

// ---- Zona aproximada donde se perdió (mapa del recuadro rojo) ----
// El punto se redondea a una cuadrícula de ~300 m (igual que en el servidor): en el canal sale esa zona, nunca el punto exacto
const HUANUCO = [-9.9306, -76.2422];
const aZona = x => Math.round(x * 400) / 400;
let lostPunto = null;   // [lat, lon] o null
let mapaPerdida = null, zonaPerdida = null;
function mostrarZonaPerdida() {
  if (zonaPerdida) { zonaPerdida.remove(); zonaPerdida = null; }
  if (lostPunto && mapaPerdida) zonaPerdida = L.circle(lostPunto, { radius: 300, color: '#be123c', weight: 2, fillOpacity: .18 }).addTo(mapaPerdida);
  $('btn-quitar-punto').classList.toggle('hidden', !lostPunto);
}
function abrirMapaPerdida() {
  if (!window.L) return;   // la librería no cargó: queda solo el texto de la zona
  if (mapaPerdida) { mapaPerdida.invalidateSize(); return; }
  mapaPerdida = L.map('mapa-perdida').setView(lostPunto || HUANUCO, lostPunto ? 15 : 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapaPerdida);
  mapaPerdida.on('click', e => { lostPunto = [aZona(e.latlng.lat), aZona(e.latlng.lng)]; cambiosSinGuardar = true; mostrarZonaPerdida(); });
  mostrarZonaPerdida();
}
$('btn-quitar-punto').addEventListener('click', () => { lostPunto = null; cambiosSinGuardar = true; mostrarZonaPerdida(); });

$('input-photo').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const p = $('preview-photo');
    p.src = ev.target.result;
    p.classList.remove('hidden');
    $('placeholder-icon').classList.add('hidden');
    const avatar = p.closest('.avatar');
    repetir(avatar, 'pop', 500);   // la foto nueva entra con un saltito y mixtura
    lanzarFiguras(avatar, 7);
  };
  reader.readAsDataURL(file);
});

async function comprimirImagen(file, maxLado = 900, calidad = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad));
    return blob && blob.size < file.size ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const textoBotonGuardar = () => esPlacaNueva
  ? '<i class="fa-solid fa-shield-dog"></i> <span>Activar mi placa</span>'
  : '<i class="fa-solid fa-floppy-disk"></i> <span>Guardar Cambios</span>';

// Lo que falta o está mal en el formulario ('' si todo está bien)
function revisarDatos() {
  const phone = normalizarTel(val('input-phone'));
  const finalPin = savedPin ? savedPin : val('input-pin').trim();
  if (!val('input-pet').trim() || !val('input-owner').trim() || !phone || !finalPin) return 'Completa los campos obligatorios (*).';
  if (phone.length < 8 || phone.length > 15) return 'Revisa el teléfono principal: usa solo números, con código de país (ej. 51987654321).';
  if (!savedPin && !/^[0-9]{4}$/.test(finalPin)) return 'El PIN debe ser de 4 números.';
  if (!savedPin && pinFacil(finalPin, phone, normalizarTel(val('input-phone-secondary')))) return MSG_PIN_FACIL;
  if (esPlacaNueva && !$('input-consent').checked) return 'Para activar la placa debes aceptar el aviso de privacidad y los términos.';
  return '';
}

// Sube la foto (si hay una nueva) y guarda todo el formulario. La usan «Guardar Cambios» y la alarma.
// Devuelve la respuesta del servidor o lanza un error con el motivo.
async function enviarDatos() {
  const falta = revisarDatos();
  if (falta) throw new Error(falta);
  const pet = val('input-pet').trim();
  const owner = val('input-owner').trim();
  const phone = normalizarTel(val('input-phone'));
  const finalPin = savedPin ? savedPin : val('input-pin').trim();
  const photoInput = $('input-photo');
  const esNueva = esPlacaNueva;
  let photoPublicUrl = existingPhotoUrl;

  if (photoInput.files && photoInput.files[0]) {
    const file = await comprimirImagen(photoInput.files[0]);
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
    if (!ext) throw new Error('Formato de imagen no compatible. Usa una foto JPG o PNG.');
    if (file.size > 1048576) throw new Error('La foto pesa más de 1 MB. Elige otra o recórtala.');
    const fileName = `${tagId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await client.storage.from('pet-photos').upload(fileName, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error('No se pudo subir la foto: ' + uploadError.message);
    photoPublicUrl = client.storage.from('pet-photos').getPublicUrl(fileName).data.publicUrl;
  }
  const v = id => val(id).trim();
  const { data: res, error: dbError } = await client.rpc('guardar_mascota', {
    p_id: tagId, p_pin: finalPin, p_codigo: val('input-codigo').trim() || null,
    p_datos: {
      pet, owner, phone,
      breed: v('input-breed'), color: v('input-color'),
      weight: v('input-weight').replace(/\s*kg$/i, ''), age: v('input-age'),
      description: v('input-description'), phone_secondary: normalizarTel(v('input-phone-secondary')),
      is_lost: isLostState, lost_location: v('input-lost-location'),
      lost_date: v('input-lost-date'), lost_time: v('input-lost-time'),
      lost_lat: lostPunto && lostPunto[0], lost_lon: lostPunto && lostPunto[1],
      reward: $('input-reward').checked, photo: photoPublicUrl,
      next_vaccine: v('input-next-vaccine'), next_deworming: v('input-next-deworming'),
      vaccine_every: Number(v('input-vaccine-every')) || null, deworming_every: Number(v('input-deworming-every')) || null,
      allergies: v('input-allergies'), medical_notes: v('input-medical'), diet: v('input-diet'),
      vet_name: v('input-vet-name'), vet_phone: v('input-vet-phone'),
      ...(esNueva ? { _etiqueta: etiquetaDispositivo() } : {}),
    }
  });
  if (dbError) throw dbError;
  if (res.estado !== 'ok') throw new Error(msgEstado(res.estado));

  // Placa nueva: el servidor devuelve la sesión y deja este celular como dispositivo del dueño
  sessionStorage.setItem(`pin_${tagId}`, res.sesion || finalPin);
  try {
    if (res.dispositivo) localStorage.setItem(`disp_${tagId}`, res.dispositivo);
    localStorage.setItem(`dueno_${tagId}`, '1');
  } catch (e) {}   // este dispositivo es del dueño (también al activar la placa)
  if (esNueva) { pinSesion = res.sesion || finalPin; savedPin = pinSesion; }
  if (photoInput.files && photoInput.files[0]) { existingPhotoUrl = photoPublicUrl; photoInput.value = ''; }   // no se vuelve a subir
  cambiosSinGuardar = false;
  recordarMascota({ id: tagId, n: pet, f: photoPublicUrl, p: isLostState });   // su foto, nombre y alarma en «Mis mascotas»
  return res;
}

async function guardarDatos() {
  const btn = $('btn-save');
  const falta = revisarDatos();
  if (falta) { aviso(falta, 'error'); return; }
  const esNueva = esPlacaNueva;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${esNueva ? 'Activando...' : 'Guardando...'}</span>`;
  try {
    await enviarDatos();
  } catch (err) {
    aviso((esNueva ? 'No se pudo activar: ' : 'No se pudo guardar: ') + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = textoBotonGuardar();
    return;
  }
  // Guardado: el botón se pone verde con un check y sale mixtura; luego la bienvenida (placa nueva) o el perfil
  btn.classList.add('ok');
  btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${esNueva ? '¡Activada!' : '¡Guardado!'}</span>`;
  lanzarFiguras(btn, 9);
  vibrar(25);
  if (esNueva) { await espera(650); mostrarBienvenida(); return; }
  await espera(750);
  irAlPerfil();
}

// Cambios sin guardar: el navegador pregunta antes de salir (el historial médico y el código del veterinario se guardan aparte)
let cambiosSinGuardar = false, saliendo = false;
['input', 'change'].forEach(ev => $('pet-form').addEventListener(ev, e => {
  if (!e.target.closest('#form-medical-record')) cambiosSinGuardar = true;
}));
window.addEventListener('beforeunload', e => {
  if (cambiosSinGuardar && !saliendo) { e.preventDefault(); e.returnValue = ''; }
});
function irAlPerfil() {
  saliendo = true;
  window.location.href = `index.html?id=${encodeURIComponent(tagId)}`;
}

// ---- Bienvenida al activar: la placa ya funciona; estos pasos le sacan provecho desde el primer día ----
function mostrarBienvenida() {
  const nombre = val('input-pet').trim(), foto = $('preview-photo');
  $('bv-titulo').textContent = `¡${nombre} ya tiene su placa activa!`;
  $('bv-prueba').textContent = `Pide a alguien que escanee la placa: verás lo mismo que verá quien encuentre a ${nombre}.`;
  $('bv-perfil').querySelector('span').textContent = `Ver el perfil de ${nombre}`;
  if (!foto.classList.contains('hidden') && foto.src) {
    $('bv-img').src = foto.src;
    $('bv-img').classList.remove('hidden');
    $('bv-huella').classList.add('hidden');
  }
  marcarPasoTelegram(telegramVinculado);
  $('bienvenida').classList.remove('hidden');
  document.documentElement.classList.add('bloqueo');
  setTimeout(() => { lanzarFiguras($('bv-foto'), 14); vibrar([20, 40, 30]); }, sinMovimiento ? 0 : 650);
  setTimeout(() => { if (!$('bv-telegram').disabled) $('bv-telegram').focus({ preventScroll: true }); }, sinMovimiento ? 0 : 1700);
}
function marcarPasoTelegram(hecho) {
  const paso = $('bv-paso-tg'), b = $('bv-telegram');
  const antes = paso.classList.contains('hecho');
  paso.classList.toggle('hecho', hecho);
  b.disabled = hecho;
  b.className = 'btn ' + (hecho ? 'btn-green listo' : 'btn-tg');
  b.innerHTML = hecho ? '<i class="fa-solid fa-circle-check"></i> <span>Telegram conectado</span>' : '<i class="fa-brands fa-telegram"></i> <span>Vincular Telegram</span>';
  $('bv-perfil').className = 'btn ' + (hecho ? 'btn-dark' : 'btn-line');
  if (hecho && !antes && !$('bienvenida').classList.contains('hidden')) { lanzarFiguras(paso.querySelector('.bv-num'), 9); vibrar(25); }
}

// ---- Mis mascotas: las que este celular abrió con su PIN, para pasar de una a otra con un toque ----
// Se guardan solo en este navegador (id, nombre, foto y si tiene la alarma activa). Cada una sigue con su PIN:
// si en esta pestaña ya se entró, se pasa directo a su panel; si no, su perfil abre la ventana del PIN.
const CLAVE_MIS = 'mis_mascotas';
function leerMisMascotas() {
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(CLAVE_MIS) || '[]'); } catch (e) {}
  if (!Array.isArray(lista)) lista = [];
  lista = lista.filter(m => m && typeof m.id === 'string' && m.id && m.id.length <= 40);
  try {   // las que se abrieron antes de que existiera la lista quedaron marcadas como del dueño
    for (let k = 0; k < localStorage.length; k++) {
      const c = localStorage.key(k) || '';
      if (c.startsWith('dueno_') && c.length > 6 && !lista.some(m => m.id === c.slice(6))) lista.push({ id: c.slice(6) });
    }
  } catch (e) {}
  return lista;
}
function guardarMisMascotas(lista) {
  try { localStorage.setItem(CLAVE_MIS, JSON.stringify(lista.map(({ id, n, f, p }) => ({ id, n: n || '', f: f || '', p: !!p })))); } catch (e) {}
}
function recordarMascota(m) {
  const lista = leerMisMascotas();
  const i = lista.findIndex(x => x.id === m.id);
  if (i >= 0) lista[i] = m; else lista.push(m);
  guardarMisMascotas(lista);
  if (!$('mis-mascotas').classList.contains('hidden')) pintarMisMascotas(lista);
  return lista;
}
function olvidarMascota(id) {   // ya no existe (se borraron sus datos): sale de la lista y este celular la olvida
  guardarMisMascotas(leerMisMascotas().filter(m => m.id !== id));
  try { localStorage.removeItem(`dueno_${id}`); localStorage.removeItem(`disp_${id}`); sessionStorage.removeItem(`pin_${id}`); } catch (e) {}
}

function pintarMisMascotas(lista) {
  const fila = $('mis-fila');
  fila.classList.toggle('quieta', !!fila.dataset.pintada);   // entran subiendo solo la primera vez
  fila.dataset.pintada = '1';
  fila.innerHTML = lista.map((m, k) => {
    const aqui = m.id === tagId, nombre = m.n || 'Mascota';
    const etiqueta = aqui ? `${nombre}: estás en su panel` : `Ir al panel de ${nombre}${m.p ? ' (alarma activa)' : ''}`;
    return `<button type="button" class="mis-chip${aqui ? ' aqui' : ''}${m.p ? ' perdida' : ''}" style="--k:${k}" data-mascota="${esc(m.id)}"
              aria-label="${esc(etiqueta)}"${aqui ? ' aria-current="page"' : ''}>
        <span class="mis-foto">${m.f ? `<img src="${esc(m.f)}" alt="">` : '<i class="fa-solid fa-paw"></i>'}${m.p ? '<b class="mis-alarma"><i class="fa-solid fa-bullhorn"></i></b>' : ''}</span>
        <span class="mis-nombre">${esc(nombre)}</span>
      </button>`;
  }).join('') + `<button type="button" id="mis-otra" class="mis-chip otra" style="--k:${lista.length}" aria-label="Sumar otra mascota" aria-expanded="${!$('mis-ayuda').classList.contains('hidden')}" aria-controls="mis-ayuda">
      <span class="mis-foto"><i class="fa-solid fa-plus"></i></span><span class="mis-nombre">Otra</span>
    </button>`;
  // Una foto que no carga deja la huellita
  $('mis-fila').querySelectorAll('.mis-foto img').forEach(img => img.addEventListener('error', () => { img.replaceWith(Object.assign(document.createElement('i'), { className: 'fa-solid fa-paw' })); }, { once: true }));
}

async function cargarMisMascotas(actual) {
  const lista = recordarMascota(actual);
  $('mis-mascotas').classList.remove('hidden');
  pintarMisMascotas(lista);
  // Las demás se actualizan (nombre, foto, alarma); las que ya no existen (se borraron) salen de la lista
  const otras = lista.filter(m => m.id !== actual.id);
  if (!otras.length) return;
  const respuestas = await Promise.all(otras.map(m => Promise.resolve(client.rpc('obtener_mascota', { p_id: m.id })).catch(() => null)));
  let cambio = false;
  otras.forEach((m, k) => {
    const r = respuestas[k];
    if (!r || r.error) return;   // sin conexión: se queda como estaba
    if (!r.data) { olvidarMascota(m.id); cambio = true; return; }
    const nuevo = { id: m.id, n: r.data.pet || '', f: r.data.photo || '', p: !!r.data.is_lost };
    if (nuevo.n !== m.n || nuevo.f !== m.f || nuevo.p !== m.p) { recordarMascota(nuevo); cambio = true; }
  });
  if (cambio) pintarMisMascotas(leerMisMascotas());
}

function alTocarMisMascotas(e) {
  const b = e.target.closest('.mis-chip');
  if (!b) return;
  if (b.id === 'mis-otra') {   // cómo se suma otra mascota
    const ayuda = $('mis-ayuda'), abrir = ayuda.classList.contains('hidden');
    ayuda.classList.toggle('hidden', !abrir);
    b.setAttribute('aria-expanded', String(abrir));
    if (abrir) repetir(ayuda, 'asoma', 500);
    return;
  }
  const id = b.dataset.mascota;
  if (!id || id === tagId) { repetir(b, 'pop', 450); return; }
  b.classList.add('yendo');   // su anillo gira como pushka mientras se abre su panel
  vibrar(15);
  setTimeout(() => {
    window.location.href = enlaceMascota(id);
    setTimeout(() => b.classList.remove('yendo'), 1500);   // si se quedó (cambios sin guardar), el anillo se detiene
  }, sinMovimiento ? 0 : 380);
}
// Con sesión en esta pestaña: directo a su panel. Si no: su perfil, que abre la ventana del PIN
function enlaceMascota(id) {
  let conSesion = false;
  try { conSesion = !!sessionStorage.getItem(`pin_${id}`); } catch (e) {}
  return conSesion ? `registro.html?id=${encodeURIComponent(id)}` : `index.html?id=${encodeURIComponent(id)}&entrar=1`;
}

window.guardarRegistroMedico = async function () {
  const btn = $('btn-save-med');
  const textOriginal = btn ? btn.innerHTML : '';
  const visitDate = val('med-date'), vetName = val('med-vet'), reason = val('med-reason');

  if (!visitDate || !vetName || !reason) {
    aviso('Completa la fecha, la veterinaria y el motivo.', 'error');
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`; btn.disabled = true; }

  try {
    const { data, error } = await db.rpc('agregar_registro_medico', {
      p_id: tagId, p_pin: pinSesion, p_fecha: visitDate, p_vet: vetName, p_motivo: reason,
      p_diagnostico: val('med-diagnosis') || null,
      p_receta: val('med-prescription') || null,
      p_proxima: val('med-next') || null
    });
    if (error) throw error;
    if (data.estado !== 'ok') throw new Error(msgEstado(data.estado));
    aviso('¡Registro médico guardado!', 'ok');
    ['med-date', 'med-vet', 'med-reason', 'med-diagnosis', 'med-prescription', 'med-next'].forEach(id => { if ($(id)) $(id).value = ''; });
    await cargarHistorialPrivado();
  } catch (err) {
    aviso('No se pudo guardar: ' + err.message, 'error');
  } finally {
    if (btn) { btn.innerHTML = textOriginal; btn.disabled = false; }
  }
};

// Historial completo (con diagnóstico y receta): solo el dueño, con su PIN
async function cargarHistorialPrivado() {
  const box = $('historial-privado');
  if (!box) return;
  if (!pinSesion) {
    box.innerHTML = `<p class="text-xs text-slate-500 italic">Guarda los datos de la placa para empezar tu historial.</p>`;
    return;
  }
  const { data: res, error } = await db.rpc('obtener_historial_medico_privado', { p_id: tagId, p_pin: pinSesion });
  if (error || !res || res.estado !== 'ok') {
    box.innerHTML = `<p class="text-xs text-slate-500">No se pudo cargar el historial.</p>`;
    return;
  }
  const regs = res.registros || [];
  const hoy = hoyLima(), scroll = box.scrollTop;
  box.innerHTML = regs.length ? regs.map(r => {
    const hecha = !!r.proxima_hecha_en;
    const vencido = !!r.next_due_date && !hecha && r.next_due_date < hoy;
    const id = esc(r.id);
    return `
    <div class="bg-amber-50/60 p-3 rounded-2xl border border-amber-100 text-left">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-bold text-amber-950 uppercase min-w-0 flex-1 truncate">${esc(r.vet_name)}</span>
        <span class="text-[10px] text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-full">${esc(fmtFecha(r.visit_date))}</span>
        <button type="button" class="btn-borrar" title="Eliminar este registro" aria-label="Eliminar este registro" data-borrar="${id}"><i class="fa-regular fa-trash-can"></i></button>
      </div>
      <p class="text-xs text-slate-700 font-medium"><strong>Motivo:</strong> ${esc(r.reason || 'Consulta general')}</p>
      ${r.diagnosis ? `<p class="text-xs text-slate-600 mt-1"><strong>Diagnóstico:</strong> ${esc(r.diagnosis)}</p>` : ''}
      ${r.prescription ? `<p class="text-xs text-emerald-800 bg-emerald-50/90 p-2 rounded-xl border border-emerald-100 mt-1.5"><strong>Receta/Tratamiento:</strong> ${esc(r.prescription)}</p>` : ''}
      ${r.next_due_date ? `
      <label class="flex items-center gap-2 text-xs text-emerald-800 mt-1.5 cursor-pointer">
        <input type="checkbox" class="chk-refuerzo" ${hecha ? 'checked' : ''} data-refuerzo="${id}" style="width:17px;height:17px;accent-color:#059669;flex:none">
        <span><strong>Próximo refuerzo:</strong> <span class="${hecha ? 'line-through opacity-60' : ''}">${esc(fmtFecha(r.next_due_date))}</span>${hecha ? ` · ✓ hecho el ${esc(fmtFecha(r.proxima_hecha_en))}` : vencido ? ' · <b class="text-rose-600">vencido: ¿ya lo hiciste?</b>' : ''}</span>
      </label>` : ''}
    </div>`;
  }).join('') : `<p class="text-xs text-slate-500 italic">Sin registros aún.</p>`;
  box.scrollTop = scroll;   // al marcar o eliminar, la lista no salta al inicio
}

// Solo el dueño (PIN en el servidor): el registro se oculta del historial y del perfil público
async function eliminarRegistro(id) {
  if (!pinSesion) { aviso('Vuelve a entrar con tu PIN desde el perfil.', 'error'); return; }
  if (!confirm('¿Eliminar este registro del historial? Dejará de verse aquí y en el perfil de tu mascota.')) return;
  try {
    const { data, error } = await db.rpc('eliminar_registro_medico', { p_id: tagId, p_pin: pinSesion, p_registro: id });
    if (error || !data) throw new Error('No se pudo eliminar. Revisa tu conexión e intenta de nuevo.');
    if (data.estado !== 'ok' && data.estado !== 'no_encontrado') throw new Error(msgEstado(data.estado));
  } catch (err) {
    aviso(err.message, 'error');
  }
  await cargarHistorialPrivado();
}

// Check del «Próximo refuerzo»: marcado = ya se hizo (deja de avisar y de contar como pendiente)
async function marcarRefuerzo(id, chk) {
  const hecho = chk.checked;
  chk.disabled = true;
  try {
    const { data, error } = await db.rpc('marcar_proxima_hecha', { p_id: tagId, p_pin: pinSesion, p_registro: id, p_hecho: hecho });
    if (error || !data) throw new Error('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    if (data.estado !== 'ok' && data.estado !== 'no_encontrado') throw new Error(msgEstado(data.estado));
  } catch (err) {
    aviso(err.message, 'error');
  }
  await cargarHistorialPrivado();   // se muestra lo que quedó guardado de verdad
}

function toggleHistorialEscaneos() {
  const c = $('desplegable-escaneos'), f = $('flecha-escaneos');
  if (!c) return;
  const abierto = !c.classList.contains('hidden');
  c.classList.toggle('hidden', abierto);
  if (f) f.classList.toggle('rotate-180', !abierto);
  $('btn-escaneos').setAttribute('aria-expanded', String(!abierto));
}

async function cargarHistorialEscaneos() {
  const previewTxt = $('preview-ultimo-escaneo'), btnMaps = $('btn-ultimo-maps'), lista = $('escaneos-lista-anteriores');
  const fmt = f => f ? new Date(f).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
  const url = s => `https://maps.google.com/?q=${Number(s.latitude)},${Number(s.longitude)}`;

  let escaneos = [];
  if (pinSesion) {
const { data: res } = await db.rpc('obtener_escaneos', { p_id: tagId, p_pin: pinSesion });
if (res && res.estado === 'ok') escaneos = res.escaneos || [];
  }

  if (escaneos.length === 0) {
previewTxt.textContent = 'Sin registros de ubicación aún.';
btnMaps.classList.add('hidden');
lista.innerHTML = `<p class="text-slate-500 italic text-xs py-1">Sin historial disponible.</p>`;
return;
  }

  const [ultimo, ...anteriores] = escaneos;
  previewTxt.innerHTML = `<i class="fa-regular fa-clock mr-1"></i>${fmt(ultimo.created_at)}${ultimo.con_ubicacion ? '' : ' · sin ubicación'}`;
  if (ultimo.con_ubicacion) { btnMaps.href = url(ultimo); btnMaps.classList.remove('hidden'); }
  else btnMaps.classList.add('hidden');

  lista.innerHTML = anteriores.length
? anteriores.map((s, i) => `
  <div class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
    <div>
      <p class="font-bold text-slate-800 text-xs">Escaneo #${i + 2}</p>
      <p class="text-[10px] text-slate-500"><i class="fa-regular fa-clock mr-1"></i>${fmt(s.created_at)}</p>
    </div>
    ${s.con_ubicacion
      ? `<a href="${url(s)}" target="_blank" rel="noopener" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"><i class="fa-solid fa-map-location-dot"></i> Maps</a>`
      : `<span class="text-[10px] font-bold text-slate-500">Sin ubicación</span>`}
  </div>`).join('')
: `<p class="text-slate-500 italic text-xs py-1">No hay escaneos anteriores.</p>`;
}
const BOT_TELEGRAM = 'Ayudapetbot';
let telegramVinculado = false;

async function refrescarTelegram() {
  if (!pinSesion) return;
  const { data } = await db.rpc('obtener_mascota_privada', { p_id: tagId, p_pin: pinSesion });
  if (!data || data.estado !== 'ok') return;
  telegramVinculado = !!data.telegram_vinculado;
  $('telegram-box').classList.remove('hidden');
  $('telegram-estado').textContent = telegramVinculado
    ? '✅ Conectado: recibirás avisos de escaneos y recordatorios.'
    : 'Avisos de escaneos y de vacunas.';
  $('btn-telegram').textContent = telegramVinculado ? 'Desvincular' : 'Vincular';
  $('tg-reco').classList.toggle('hidden', telegramVinculado);
  if (!$('bienvenida').classList.contains('hidden')) marcarPasoTelegram(telegramVinculado);   // volvió de Telegram con la bienvenida abierta
}

async function accionTelegram() {
  if (telegramVinculado) {
    if (!confirm('¿Dejar de recibir avisos en Telegram?')) return;
    await db.rpc('desvincular_telegram', { p_id: tagId, p_pin: pinSesion });
    return refrescarTelegram();
  }
  const w = window.open('', '_blank');
  const { data, error } = await db.rpc('crear_vinculo_telegram', { p_id: tagId, p_pin: pinSesion });
  if (error || !data || data.estado !== 'ok') {
    if (w) w.close();
    aviso('No se pudo crear el enlace. Vuelve a entrar con tu PIN.', 'error');
    return;
  }
  const url = `https://t.me/${BOT_TELEGRAM}?start=${data.token}`;
  if (w) w.location.href = url; else window.location.href = url;
}

// ---- Código para el veterinario (24 h, 5 registros) ----
// Usan la sesión del dueño (un token, no el PIN de 4 dígitos), igual que el resto del panel
const MSG_VET = { incorrecto: 'Tu sesión venció: vuelve a entrar con tu PIN desde el perfil.', bloqueado: 'Demasiados intentos. Espera 15 minutos.', pin_debil: MSG_PIN_FACIL };
function errorVet(texto) { const e = $('vet-err'); e.textContent = texto; e.classList.remove('hidden'); }

async function revocarCodigoVet() {
  $('vet-result').classList.add('hidden');
  $('vet-err').classList.add('hidden');
  if (!pinSesion) { errorVet('Vuelve a entrar con tu PIN desde el perfil.'); return; }
  if (!confirm('¿Revocar la autorización del veterinario?')) return;
  let data = null;
  try { ({ data } = await db.rpc('revocar_codigo_vet', { p_id: tagId, p_pin: pinSesion })); } catch (e) {}
  if (data && data.estado === 'ok') aviso(data.revocado ? 'Autorización revocada.' : 'No había una autorización vigente.', 'ok');
  else errorVet((data && MSG_VET[data.estado]) || 'No se pudo revocar. Revisa tu conexión.');
}

async function generarCodigoVet() {
  const err = $('vet-err'), res = $('vet-result'), btn = $('btn-gen-vet');
  err.classList.add('hidden'); res.classList.add('hidden');
  if (!pinSesion) { errorVet('Vuelve a entrar con tu PIN desde el perfil.'); return; }

  btn.disabled = true;
  let data = null;
  try { ({ data } = await db.rpc('crear_codigo_vet', { p_id: tagId, p_pin: pinSesion })); } catch (e) {}
  btn.disabled = false;

  if (!data || data.estado !== 'ok') { errorVet((data && MSG_VET[data.estado]) || 'No se pudo generar el código. Revisa tu conexión.'); return; }
  $('vet-code').textContent = data.codigo;
  $('vet-exp').textContent = 'Vence: ' + new Date(data.expira_en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  const link = new URL('vet.html?id=' + encodeURIComponent(tagId), location.href).href;
  const texto = `Código para registrar la consulta de mi mascota: ${data.codigo} (vence en 24 h). Ingresa aquí: ${link}`;
  $('vet-wa').href = 'https://wa.me/?text=' + encodeURIComponent(texto);
  res.classList.remove('hidden');
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescarTelegram(); });

// ---- Botones ----
$('pet-form').addEventListener('submit', e => e.preventDefault());
alClic('btn-toggle-lost', toggleMascotaPerdida);
alClic('btn-telegram', accionTelegram);
alClic('btn-disp', quitarOtrosDispositivos);
alClic('fila-escaneos', toggleHistorialEscaneos);
$('btn-ultimo-maps').addEventListener('click', e => e.stopPropagation());   // abre Maps sin plegar la lista
alClic('btn-hecho-vacuna', () => marcarCarnetHecho('vacuna'));
alClic('btn-hecho-desparasitacion', () => marcarCarnetHecho('desparasitacion'));
alClic('btn-save-med', guardarRegistroMedico);
alClic('btn-gen-vet', generarCodigoVet);
alClic('btn-revocar-vet', revocarCodigoVet);
alClic('btn-save', guardarDatos);
alClic('bv-telegram', accionTelegram);
alClic('bv-perfil', irAlPerfil);
$('mis-fila').addEventListener('click', alTocarMisMascotas);
// Historial completo: la lista se vuelve a dibujar, así que se escucha en la caja (eliminar y «ya se hizo» del refuerzo)
$('historial-privado').addEventListener('click', e => {
  const b = e.target.closest('[data-borrar]');
  if (b) eliminarRegistro(b.dataset.borrar);
});
$('historial-privado').addEventListener('change', e => {
  if (e.target.matches('[data-refuerzo]')) marcarRefuerzo(e.target.dataset.refuerzo, e.target);
});

inicializar();
