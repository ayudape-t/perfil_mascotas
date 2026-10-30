/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Comportamiento de el perfil público de la mascota (index.html). Va después de js/comun.js */

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let petData = null;
let tagId = '';
let historial = null;
let posterBlobPromise = null;
let destinoPIN = '';
let ubicacionObtenida = null;   // { lat, lon } cuando el visitante aceptó compartir su ubicación
let solicitudUbic = null;       // solicitud de ubicación en curso (compartida por la carga y el botón)
let estadoUbic = 'nueva';       // nueva | esperando | ok | denegada | no-disponible
let permisoGeo = null;          // PermissionStatus de la geolocalización (si el navegador lo ofrece)
let escaneoSinUbicGuardado = false;
let registroEscaneo = null;     // último guardado del escaneo (promesa); el botón de WhatsApp lo espera antes de salir de la página
let registrosEnCurso = 0;
let avisoEnviado = false;       // el aviso a Telegram sale UNA sola vez por visita
let avisoGarantizado = false;

// Foto de relleno (huella) para mascotas sin foto: la que trae el HTML
const FOTO_VACIA = $('pet-photo').getAttribute('src');
// Si la foto de la mascota no carga (enlace roto o sin conexión), se queda la huella de relleno
$('pet-photo').addEventListener('error', e => { if (e.target.getAttribute('src') !== FOTO_VACIA) e.target.src = FOTO_VACIA; });
// Dispositivo del dueño (entró con su PIN o guardó cambios): no recibe la pregunta de ubicación del navegador al
// cargar la ficha y no genera escaneos ni avisos a Telegram. Se recuerda en localStorage; una sesión con PIN
// también cuenta. Para probar TODO como visitante desde tu propio celular, abre la ficha con &visitante=1
const leerAlmacen = (nombre, clave) => { try { return window[nombre].getItem(clave); } catch (e) { return null; } };   // nunca falla (cookies bloqueadas)
const esDueno = () => !new URLSearchParams(window.location.search).has('visitante')
  && !!(leerAlmacen('localStorage', `dueno_${tagId}`) || leerAlmacen('sessionStorage', `pin_${tagId}`));
// Visita desde el canal de Telegram (src=canal) o desde el atajo del dueño (canal=1): no es un escaneo de la placa,
// así que al cargar no se avisa al dueño ni se pide la ubicación (el botón «¡La encontré!» funciona igual)
const parametros = new URLSearchParams(window.location.search);
const atajoCanal = parametros.get('canal') === '1';
const desdeCanal = atajoCanal || parametros.get('src') === 'canal';
const desdeSoporte = parametros.get('src') === 'soporte';   // el panel de soporte abre el perfil para mirarlo, no es un escaneo
// Atajo del dueño (entrar=1): «Mis mascotas» del panel, /mascotas del bot o una sesión que venció. Abre directo la ventana
// del PIN y tampoco cuenta como escaneo (no avisa a Telegram ni pide la ubicación)
const entrarDueno = parametros.get('entrar') === '1';
const noEsEscaneo = desdeCanal || entrarDueno || desdeSoporte;
const soloDigitos = v => String(v || '').replace(/\D/g, '');
const fmtPeso = w => w ? (/kg/i.test(w) ? String(w) : `${w} kg`) : '';
const fmtTel = p => {
  const t = soloDigitos(p);
  if (!t) return '---';
  return (t.length === 11 && t.startsWith('51')) ? `+51 ${t.slice(2, 5)} ${t.slice(5, 8)} ${t.slice(8)}` : '+' + t;
};
const diasHasta = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date();
  const hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - hoy) / 86400000);
};
// «En 11 días», «Hoy», «Vencida hace 3 días»... y el tono del semáforo para esa fecha
const cuandoFalta = iso => {
  const d = diasHasta(iso);
  if (d === null) return { texto: '', tono: '' };
  const meses = Math.round(d / 30);
  const texto = d < 0 ? `Vencida hace ${-d === 1 ? '1 día' : `${-d} días`}` : d === 0 ? 'Hoy' : d === 1 ? 'Mañana'
    : d <= 60 ? `En ${d} días` : `En ${meses} meses`;
  return { texto, tono: d < 0 ? 'bad' : d <= 15 ? 'warn' : '' };
};

// Abre o cierra una ventana; mientras haya una abierta, la página de atrás no se desplaza
function capa(id, abrir) {
  $(id).classList.toggle('hidden', !abrir);
  document.documentElement.classList.toggle('bloqueo', !!document.querySelector('.modal:not(.hidden)'));
}

// ==========================================
// ANIMACIONES QUE RESPONDEN AL VISITANTE (todas se apagan con «reducir movimiento»)
// ==========================================
// Web Animations (el CSS de «reducir movimiento» no las alcanza: por eso se revisa aquí)
const animar = (el, cuadros, opciones) => (sinMovimiento || !el.animate) ? null
  : el.animate(cuadros, { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both', ...opciones });

// El anillo tejido de la foto gira rápido y se frena, como una pushka (el huso con que se hila la lana)
const hilar = () => repetir(document.querySelector('.foto-box'), 'pushka', 1400);

// Sello bordado donde se tocó: huellita dentro de un rombo o una chakana con puntadas que corren
// (café sobre la tarjeta, claro sobre el fondo oscuro)
const BORDES = ['M23 3 43 23 23 43 3 23z',
  'M18.2 3.8H27.8V8.6H32.6V13.4H37.4V18.2H42.2V27.8H37.4V32.6H32.6V37.4H27.8V42.2H18.2V37.4H13.4V32.6H8.6V27.8H3.8V18.2H8.6V13.4H13.4V8.6H18.2Z'];
function estamparBordado(x, y, clara) {
  if (sinMovimiento) return;
  const b = document.createElement('span');
  b.className = 'sello-bordado' + (clara ? ' clara' : '');
  b.style.cssText = `left:${x}px;top:${y}px;--r:${Math.round(Math.random() * 30 - 15)}deg`;
  b.innerHTML = `<svg viewBox="0 0 46 46" aria-hidden="true"><path d="${BORDES[Math.random() < .5 ? 0 : 1]}"/></svg><i class="fa-solid fa-paw"></i>`;
  b.addEventListener('animationend', e => { if (e.target === b) b.remove(); });
  document.body.appendChild(b);
}

// El nombre va letra por letra (para la ola), agrupado por palabras: solo se parte entre palabras
function ponerNombre(texto) {
  const h = $('pet-name');
  h.textContent = '';
  h.setAttribute('aria-label', texto);
  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null;
  let n = 0;
  texto.split(/(\s+)/).forEach(parte => {
    if (!parte) return;
    if (/^\s+$/.test(parte)) { h.append(' '); return; }
    const palabra = document.createElement('span');
    palabra.className = 'palabra';
    palabra.setAttribute('aria-hidden', 'true');
    (seg ? [...seg.segment(parte)].map(s => s.segment) : [...parte]).forEach(c => {
      const l = document.createElement('span');
      l.className = 'letra';
      l.style.setProperty('--n', n++);
      l.textContent = c;
      palabra.append(l);
    });
    h.append(palabra);
  });
}

// Las letras del nombre dan un saltito una tras otra
function ola() {
  const h = $('pet-name');
  if (sinMovimiento) return;
  repetir(h, 'ola', 600 + h.querySelectorAll('.letra').length * 45);
}

// Las piezas de la ficha aparecen cuando entran en la pantalla al bajar; las que ya se ven, una tras otra
function revelarAlBajar() {
  const cuerpo = document.querySelector('.cuerpo');
  if (sinMovimiento || !('IntersectionObserver' in window) || cuerpo.classList.contains('revela')) return;
  cuerpo.classList.add('revela');
  let primera = true;
  const io = new IntersectionObserver(entradas => {
    let d = primera ? 3 : 0;   // la primera tanda espera a que entren la foto y el nombre
    primera = false;
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty('--d', d++);
      e.target.classList.add('visto');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -40px 0px' });
  cuerpo.querySelectorAll(':scope > :not(.carnet)').forEach(el => io.observe(el));
}

// El botón confirma lo que pasó («¡Copiado!») con un check y vuelve a la normalidad
function confirmarBoton(btn, texto) {
  const i = btn.querySelector('i'), s = btn.querySelector('span');
  if (!i || !s || btn._antes) return;
  btn._antes = [i.className, s.textContent];
  i.className = 'fa-solid fa-check';
  s.textContent = texto;
  btn.classList.add('hecho');
  setTimeout(() => { [i.className, s.textContent] = btn._antes; btn._antes = null; btn.classList.remove('hecho'); }, 1800);
}

// Librerías pesadas: se cargan solo cuando se usan
const LIB_QR = 'vendor/qrcodejs-1.0.0/qrcode.min.js';
const LIB_H2C = 'vendor/html2canvas-1.4.1/html2canvas.min.js';
const _libs = {};
function cargarLib(src) {
  if (!_libs[src]) {
    _libs[src] = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => { delete _libs[src]; fail(new Error('No se pudo cargar una librería. Revisa tu conexión.')); };
      document.head.appendChild(s);
    });
  }
  return _libs[src];
}

function mostrarTarjetaPlaca(titulo, texto) {
  const card = $('unregistered-card');
  card.querySelector('h2').textContent = titulo;
  card.querySelector('p').textContent = texto;
  $('link-register').classList.add('hidden');
  card.classList.remove('hidden');
  $('corona-helpet').classList.remove('hidden');
}

// Muestra la ficha (y el banner rojo si la mascota está perdida). Las piezas visibles entran una tras otra.
function mostrarPerfil() {
  [...document.querySelectorAll('.cuerpo > :not(.hidden):not(.carnet)')].forEach((el, i) => el.style.setProperty('--i', i));
  $('app-container').classList.remove('hidden');
  $('corona-helpet').classList.remove('hidden');
  if (petData && petData.is_lost) $('lost-alert-banner').classList.remove('hidden');
  activarDock();
  revelarAlBajar();
  setTimeout(hilar, 250);   // el anillo se suelta girando cuando aparece la foto
  setTimeout(ola, 950);     // el nombre saluda cuando termina de entrar
}

async function cargarPerfil() {
  if (window.__redirigiendo) return;
  tagId = new URLSearchParams(window.location.search).get('id') || '';
  // Con una sesión de PIN activa este dispositivo es del dueño: queda recordado también al recargar o cerrar la pestaña
  if (tagId && leerAlmacen('sessionStorage', `pin_${tagId}`)) { try { localStorage.setItem(`dueno_${tagId}`, '1'); } catch (e) {} }

  try {
    const { data, error } = await db.rpc('obtener_mascota', { p_id: tagId });

    if (error) {
      mostrarTarjetaPlaca('Sin conexión', 'No se pudo cargar el perfil. Revisa tu internet e intenta de nuevo.');
      return;
    }
    if (!data) {
      const { data: est } = tagId ? await db.rpc('estado_placa', { p_id: tagId }) : { data: 'invalida' };
      if (est === 'sin_activar') {
        $('link-register').href = `registro.html?id=${encodeURIComponent(tagId)}`;
        $('unregistered-card').classList.remove('hidden');
        $('corona-helpet').classList.remove('hidden');
      } else {
        mostrarTarjetaPlaca('Placa no válida', 'Este código no corresponde a una placa Helpet. Revisa el enlace o escribe a soporte.');
      }
      return;
    }

    petData = data;
    petData.phone = soloDigitos(data.phone);
    if (petData.phone.length === 9 && petData.phone[0] === '9') petData.phone = '51' + petData.phone;

    // Mascota segura: el aviso a Telegram sale al cargar. Perdida: sale al saber si el visitante permite la ubicación
    // (un solo mensaje) y la ficha se muestra DESPUÉS de que el navegador pregunte por ella
    if (!data.is_lost && !noEsEscaneo) avisarEscaneo();
    ponerNombre((data.pet || '').toUpperCase());
    $('owner-name').textContent = data.owner || '';
    if (esDueno()) {   // el dueño ve lo mismo que un visitante: se lo recordamos y su botón dice qué hace
      $('aviso-dueno').querySelector('span').textContent = `Así ven a ${data.pet || 'tu mascota'} quienes escanean su placa`;
      $('aviso-dueno').classList.remove('hidden');
      $('btn-dueno').querySelector('span').textContent = `Editar datos de ${data.pet || 'tu mascota'}`;
    }
    $('pet-photo').src = data.photo || FOTO_VACIA;
    $('pet-photo').alt = data.pet ? `Foto de ${data.pet}` : 'Foto de la mascota';

    const isLost = data.is_lost || false;

    // Ficha médica básica. Con la mascota perdida queda solo lo que la protege: sus alergias, para que quien la tenga
    // no le dé algo que le haga daño (el servidor tampoco manda lo demás). La veterinaria solo se muestra con la mascota en casa.
    let tieneMedicos = false;
    [['row-allergies', 'txt-allergies', data.allergies], ['row-medical', 'txt-medical', isLost ? '' : data.medical_notes], ['row-diet', 'txt-diet', isLost ? '' : data.diet]].forEach(([fila, txt, valor]) => {
      const texto = String(valor ?? '').trim();
      $(fila).classList.toggle('hidden', !texto);
      $(txt).textContent = texto;
      if (texto) tieneMedicos = true;
    });
    const telVet = isLost ? '' : soloDigitos(data.vet_phone);
    $('row-vet').classList.toggle('hidden', !telVet);
    if (telVet) {
      $('btn-vet-call').href = `tel:+${telVet}`;
      if (data.vet_name) $('txt-vet-name').textContent = `Llamar a ${data.vet_name}`;
      tieneMedicos = true;
    }
    $('medical-titulo').textContent = isLost ? 'Si está contigo' : 'Ficha médica';
    $('medical-pill').classList.toggle('hidden', isLost);
    $('cuidados-nota').classList.toggle('hidden', !isLost);
    $('medical-card').classList.toggle('hidden', !tieneMedicos);

    // Contacto (visible en ambos modos)
    $('btn-whatsapp').href = `https://wa.me/${petData.phone}?text=${encodeURIComponent(`¡Hola ${data.owner}! Encontré a tu mascota ${data.pet}.`)}`;
    $('btn-call').href = `tel:+${petData.phone}`;
    const tel2 = soloDigitos(data.phone_secondary);
    if (tel2) {
      $('btn-call-secondary').href = `tel:+${tel2}`;
      $('btn-call-secondary').classList.remove('hidden');
    }

    const badge = $('header-status-badge');
    const subStatus = $('sub-status');
    const indicator = $('status-indicator');

    if (isLost) {
      // 🔴 MODO PERDIDO: contacto + ubicación + compartir + cuidados (+ afiche, solo para el dueño)
      ['pet-tech-sheet', 'health-zone', 'btn-medical-history', 'health-card']
        .forEach(id => $(id).classList.add('hidden'));

      $('btn-gps').classList.remove('hidden');
      $('gps-note').classList.remove('hidden');
      $('btn-afiche').classList.toggle('hidden', !(esDueno() || atajoCanal));   // el afiche lo crea el dueño, no el visitante

      badge.className = 'sello perdida';
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Buscando su hogar`;
      // Con la mascota perdida solo se muestra lo necesario para contactar al dueño (la descripción no va)
      subStatus.className = 'perdida';
      subStatus.textContent = "🚨 Mascota perdida";
      indicator.className = 'punto perdida';
      $('app-container').classList.add('perdida');

      await pedirUbicacionSiPerdida(); // el navegador pregunta ANTES de mostrar la ficha

    } else {
      // 🟢 MODO SEGURO EN CASA: sin botón de ubicación ni afiche
      $('pet-tech-sheet').classList.remove('hidden');
      $('health-zone').classList.remove('hidden');
      $('btn-medical-history').classList.remove('hidden');
      $('btn-gps').classList.add('hidden');
      $('gps-note').classList.add('hidden');
      $('btn-afiche').classList.add('hidden');

      // Ficha técnica: solo se muestran los datos que el dueño completó
      let hayDatos = false;
      [['pet-breed', data.breed], ['pet-color', data.color], ['pet-weight', fmtPeso(data.weight)], ['pet-age', data.age]].forEach(([id, valor]) => {
        const texto = String(valor ?? '').trim();
        $(id).textContent = texto;
        $(id).closest('.dato').classList.toggle('hidden', !texto);
        if (texto) hayDatos = true;
      });
      $('pet-tech-sheet').classList.toggle('hidden', !hayDatos);
      const visibles = [...document.querySelectorAll('#pet-tech-sheet .dato')].filter(el => !el.classList.contains('hidden'));
      visibles.forEach((el, i) => el.classList.toggle('ancho', visibles.length % 2 === 1 && i === visibles.length - 1));

      // Próximas fechas (vacuna / desparasitación), con cuánto falta y su color
      let tieneControl = false;
      [['vaccine', data.next_vaccine], ['deworming', data.next_deworming]].forEach(([k, iso]) => {
        if (!iso) return;
        const falta = cuandoFalta(iso);
        $(`row-${k}`).className = `fecha ${falta.tono}`;
        $(`txt-${k}`).textContent = fmtFecha(iso);
        $(`rel-${k}`).textContent = falta.texto;
        tieneControl = true;
      });
      if (tieneControl) $('health-card').classList.remove('hidden');

      badge.className = 'sello';
      badge.innerHTML = `<i class="fa-solid fa-paw"></i> Perfil y ficha médica`;
      subStatus.className = '';
      subStatus.textContent = (data.description && data.description.trim() !== '') ? data.description : "Mascota feliz y amada 🐾";
      indicator.className = 'punto';

      cargarHistorialMedico();
    }
    mostrarPerfil();
    prepararCanal();
    if (entrarDueno) {   // el enlace no se queda con el atajo (por si lo copian o comparten)
      try { const u = new URL(location.href); u.searchParams.delete('entrar'); history.replaceState(null, '', u); } catch (e) {}
      // Atajo del dueño: primero su perfil; sin la sesión abierta en esta pestaña, pide el PIN y vuelve a su perfil
      if (!leerAlmacen('sessionStorage', `pin_${tagId}`)) abrirModalPIN('#perfil');
    }
  } catch (err) {
    console.error("Error al cargar:", err);
    if (petData) mostrarPerfil();
  } finally {
    $('cargando').classList.add('hidden');
  }
}

// ==========================================
// ESCANEO, UBICACIÓN Y AVISOS A TELEGRAM
// ==========================================
// UN solo aviso a Telegram por visita: con la ubicación si el visitante la permitió y, si no, solo el aviso (sin
// mencionar la ubicación). Mascota segura: sale al cargar. Mascota perdida: sale al saber si el visitante permite
// la ubicación (ver garantizarAviso). Si la ubicación llega después, ya no se manda otro mensaje.
async function avisarEscaneo(lat = null, lon = null, alSalir = false) {
  if (!tagId || esDueno() || avisoEnviado) return;
  avisoEnviado = true;
  if (leerAlmacen('sessionStorage', `avisado_${tagId}`)) return;   // recargó la misma pestaña: ya se avisó
  try { sessionStorage.setItem(`avisado_${tagId}`, '1'); } catch (e) {}
  if (alSalir) { enviarAlSalir('/functions/v1/avisar-escaneo', { id: tagId, lat, lon }); return; }
  try { await db.functions.invoke('avisar-escaneo', { body: { id: tagId, lat, lon } }); } catch (e) {}
}

// Petición que sobrevive al cierre de la página (keepalive): así no se pierde el aviso si el visitante sale antes
function enviarAlSalir(ruta, cuerpo) {
  try {
    fetch(`${SUPABASE_URL}${ruta}`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(cuerpo)
    }).catch(() => {});
  } catch (e) {}
}

// Registra el escaneo (con o sin ubicación) y avisa al Telegram del dueño; si una de las dos cosas falla, la otra sale igual.
// El celular del dueño no genera escaneos ni avisos (salvo con &visitante=1).
async function guardarEscaneoSilencioso(lat, lon) {
  if (!tagId || esDueno()) return;
  const registro = db.rpc('registrar_escaneo', { p_id: tagId, p_lat: lat, p_lon: lon })
    .then(({ error }) => { if (error) console.error("❌ ERROR AL GUARDAR EN SUPABASE:", error.message); });
  await Promise.all([registro.catch(() => {}), avisarEscaneo(lat, lon)]);
}

// Mascota perdida (solo visitantes): el aviso espera a saber si el visitante permite la ubicación, pero nunca se
// pierde: si no responde en 20 s, o sale de la página antes (llamar, WhatsApp, cerrar), el aviso sale igual, sin ubicación.
function garantizarAviso() {
  if (avisoGarantizado || esDueno()) return;
  avisoGarantizado = true;
  const sinUbicacion = alSalir => {
    if (avisoEnviado) return;
    if (!alSalir) { escaneoSinUbicGuardado = true; registrarEscaneoUbic(null, null); return; }
    avisarEscaneo(null, null, true);
    enviarAlSalir('/rest/v1/rpc/registrar_escaneo', { p_id: tagId, p_lat: null, p_lon: null });
  };
  setTimeout(() => sinUbicacion(false), 20000);
  const salir = () => sinUbicacion(true);
  window.addEventListener('pagehide', salir);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salir(); });
}

// ---- Ubicación del visitante (solo mascota perdida) ----
// Hay UNA sola solicitud de ubicación, compartida por la carga de la página y por el botón. Así la ubicación que
// el visitante acepta siempre llega al mensaje de WhatsApp: el botón espera esa misma solicitud en vez de
// abrir WhatsApp tras un plazo fijo (el visitante puede tardar en responder al cuadro del navegador).
// Nada de seguimiento: una sola lectura por solicitud, nunca watchPosition.

// Una lectura de posición. Nunca rechaza: { ok, lat, lon } o { ok:false, code } (1 = no autorizó).
// Algunos navegadores cuentan el rato que el visitante tarda en responder dentro del tiempo máximo (código 3):
// en ese caso se reintenta una vez.
function leerPosicion() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ ok: false, code: 0 });
    let intento = 0;
    const probar = () => {
      intento++;
      try {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ ok: true, lat: pos.coords.latitude, lon: pos.coords.longitude }),
          err => {
            const code = err && err.code;
            if (code === 3 && intento < 2) probar();
            else resolve({ ok: false, code });
          },
          { enableHighAccuracy: false, timeout: intento === 1 ? 15000 : 10000, maximumAge: 60000 }
        );
      } catch (e) { resolve({ ok: false, code: 0 }); }
    };
    probar();
  });
}

// Pide la ubicación (o reutiliza la que ya se pidió). Resuelve con { lat, lon } o null; nunca falla.
// Además registra el escaneo: con coordenadas si el visitante aceptó, sin ellas si no.
function solicitarUbicacion() {
  if (ubicacionObtenida) return Promise.resolve(ubicacionObtenida);
  if (solicitudUbic) return solicitudUbic;
  estadoUbic = 'esperando';
  actualizarBotonUbicacion();
  solicitudUbic = leerPosicion().then(r => {
    solicitudUbic = null;
    if (r.ok) {
      ubicacionObtenida = { lat: r.lat, lon: r.lon };
      estadoUbic = 'ok';
      $('btn-whatsapp').href = urlWhatsApp(ubicacionObtenida);   // el botón verde «WhatsApp» también lleva la ubicación
      registrarEscaneoUbic(r.lat, r.lon);
    } else {
      estadoUbic = r.code === 1 ? 'denegada' : 'no-disponible';
      if (!escaneoSinUbicGuardado) {   // el escaneo se registra igual, sin ubicación
        escaneoSinUbicGuardado = true;
        registrarEscaneoUbic(null, null);
      }
    }
    actualizarBotonUbicacion();
    return ubicacionObtenida;
  });
  return solicitudUbic;
}

// Guarda el escaneo sin frenar la ficha. El botón de WhatsApp espera a que termine (máx. 3 s) antes de cambiar de
// página, porque al salir de ella el navegador cancela las peticiones que sigan en curso.
function registrarEscaneoUbic(lat, lon) {
  registrosEnCurso++;
  registroEscaneo = guardarEscaneoSilencioso(lat, lon).catch(() => {}).then(() => { registrosEnCurso--; });
}

// Texto y estado del botón «¡La encontré!» según lo que pasó con la ubicación
function actualizarBotonUbicacion() {
  const btn = $('btn-gps');
  if (!btn || btn.disabled || !petData || !petData.is_lost) return;   // ocupado: lo restaura enviarUbicacionGPS
  const ico = btn.querySelector('i'), txt = btn.querySelector('span'), nota = $('gps-note-txt');
  if (estadoUbic === 'ok') {
    ico.className = 'fa-solid fa-location-dot';
    txt.textContent = 'Ubicación lista: enviar por WhatsApp';
    nota.textContent = 'Tu ubicación saldrá en el mensaje para el dueño.';
  } else if (estadoUbic === 'denegada' || estadoUbic === 'no-disponible') {
    ico.className = 'fa-solid fa-location-crosshairs';
    txt.textContent = '¡La encontré! Enviar mi ubicación';
    nota.textContent = (estadoUbic === 'denegada' ? 'No compartiste tu ubicación.' : 'No pudimos obtener tu ubicación.')
      + ' Para avisar al dueño sin ella, usa el botón WhatsApp.';
  } else {
    ico.className = 'fa-solid fa-location-crosshairs';
    txt.textContent = '¡La encontré! Enviar mi ubicación';
    nota.textContent = 'Compartirás tu ubicación con el dueño por WhatsApp.';
  }
}

// Mascota perdida y visitante (nunca el dueño): el navegador pregunta por la ubicación ANTES de mostrar la ficha
// (solo el permiso nativo, sin tarjetas ni avisos propios). En cuanto el visitante responde (permitir o bloquear)
// se muestra la ficha; si no responde en 12 s se muestra igual (la ficha nunca queda oculta). Si el navegador no
// va a preguntar (ya permitido o bloqueado, o sin geolocalización) la ficha se muestra de inmediato.
async function pedirUbicacionSiPerdida() {
  if (!petData || !petData.is_lost || esDueno() || noEsEscaneo) return;
  garantizarAviso();   // el aviso a Telegram sale con el resultado de la ubicación, a los 20 s o al salir de la página
  if (!navigator.geolocation) { solicitarUbicacion(); return; }   // sin geolocalización: escaneo sin ubicación

  try { permisoGeo = await navigator.permissions.query({ name: 'geolocation' }); } catch (e) { permisoGeo = null; }
  if (permisoGeo) {
    // Si el permiso se concede más tarde (respondió tarde o lo activó en el navegador), se toma la ubicación entonces
    permisoGeo.addEventListener('change', () => {
      if (permisoGeo.state === 'granted' && !ubicacionObtenida && !solicitudUbic) solicitarUbicacion();
    });
  }
  const preguntara = !permisoGeo || permisoGeo.state === 'prompt';

  const solicitud = solicitarUbicacion();
  if (!preguntara) return;

  await new Promise(resolve => {
    if (permisoGeo) permisoGeo.addEventListener('change', () => resolve());   // respondió: permitir o bloquear
    solicitud.then(() => resolve());                                          // o el navegador ya dio la ubicación / un error
    setTimeout(resolve, 12000);                                               // respaldo
  });
}

// Enlace de WhatsApp con el mensaje (con la ubicación si se tiene)
function urlWhatsApp(ubic) {
  const base = `¡Hola ${petData.owner}! Encontré a tu mascota ${petData.pet}.`;
  const texto = ubic ? `${base} Mi ubicación GPS actual es: https://maps.google.com/?q=${ubic.lat.toFixed(6)},${ubic.lon.toFixed(6)}` : base;
  return `https://wa.me/${petData.phone}?text=${encodeURIComponent(texto)}`;
}
function abrirWhatsApp(ubic) { window.location.href = urlWhatsApp(ubic); }

// Botón «¡La encontré! Enviar mi ubicación» (solo visible en modo perdido). Abre WhatsApp SOLO al tocarlo y SOLO
// si el visitante concedió el permiso (el mensaje lleva el enlace de Maps). Si ya hay ubicación, abre al instante.
// Si no, espera la solicitud en curso (o la repite: tocar el botón es un gesto del visitante) sin plazos cortos.
// Sin ubicación no abre nada: para avisar sin compartirla está el botón verde «WhatsApp».
async function enviarUbicacionGPS() {
  if (!petData) return;
  // Ubicación lista y escaneo ya guardado: abre WhatsApp al instante, dentro del propio toque
  if (ubicacionObtenida && !registrosEnCurso) { abrirWhatsApp(ubicacionObtenida); return; }

  const btn = $('btn-gps');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
  btn.querySelector('span').textContent = (!ubicacionObtenida && permisoGeo && permisoGeo.state === 'prompt')
    ? 'Esperando tu permiso...' : 'Obteniendo tu ubicación...';

  // Espera la MISMA solicitud de ubicación (tope de seguridad: 40 s, por si el visitante no responde al navegador)
  const ubic = await Promise.race([solicitarUbicacion(), new Promise(r => setTimeout(() => r(null), 40000))]) || ubicacionObtenida;
  // Deja terminar el guardado del escaneo (máx. 3 s): al cambiar de página el navegador cancela lo que siga en curso
  if (registroEscaneo) await Promise.race([registroEscaneo, new Promise(r => setTimeout(r, 3000))]);
  btn.disabled = false;
  actualizarBotonUbicacion();
  if (ubic) abrirWhatsApp(ubic);
  else if (estadoUbic === 'denegada' || estadoUbic === 'no-disponible') resaltarNota();
}

// Sin ubicación el botón no abre WhatsApp: resalta un momento la nota que explica qué hacer
function resaltarNota() {
  const n = $('gps-note');
  n.classList.add('resalta');
  setTimeout(() => n.classList.remove('resalta'), 4000);
}

// Enlace limpio del perfil (solo el id): sin canal=1, visitante=1 ni otros parámetros de quien lo abrió
function enlacePerfil() {
  const u = new URL(window.location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('id', tagId);
  return u.toString();
}

async function compartirPerfil() {
  const enlace = enlacePerfil();
  const shareData = {
    title: `Perfil Helpet - ${petData ? petData.pet : 'Mascota'}`,
    text: `Conoce la ficha de ${petData ? petData.pet : 'esta mascota'} protegida con Helpet:`,
    url: enlace
  };
  if (navigator.share) {
    try { await navigator.share(shareData); confirmarBoton($('btn-share-profile'), '¡Compartido!'); } catch (e) {}
  } else {
    try {
      await navigator.clipboard.writeText(enlace);
      confirmarBoton($('btn-share-profile'), '¡Copiado!');
    } catch (e) {
      window.prompt("Copia este enlace:", enlace);
    }
  }
}

async function crearQR(idContenedor, tam) {
  const box = $(idContenedor);
  if (!box) return;
  await cargarLib(LIB_QR);
  box.innerHTML = '';
  new QRCode(box, { text: enlacePerfil(), width: tam, height: tam, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
}

async function descargarCarnetDigital() {
  const carnet = $('carnet-digital'), btn = $('btn-carnet');
  if (!carnet || !petData || btn.disabled) return;
  btn.disabled = true;
  btn.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
  btn.querySelector('span').textContent = 'Creando...';
  try {
    await Promise.all([cargarLib(LIB_H2C), cargarLib(LIB_QR)]);
    if (historial === null) await cargarHistorialMedico();

    $('carnet-nombre').textContent = petData.pet || 'Mascota';
    $('carnet-raza').textContent = [petData.breed, petData.color].filter(Boolean).join(' • ');
    $('carnet-id').textContent = tagId;
    await crearQR('carnet-qrcode', 110);
    const foto = petData.photo || FOTO_VACIA;
    const im = $('carnet-img');
    if (im.getAttribute('src') !== foto) {
      im.crossOrigin = 'anonymous';
      im.src = foto;
      await new Promise(r => { im.onload = im.onerror = r; });
    }

    carnet.classList.remove('hidden');
    await new Promise(r => setTimeout(r, 80));
    const canvas = await html2canvas(carnet, { scale: 2, useCORS: true });
    carnet.classList.add('hidden');

    const link = document.createElement('a');
    link.download = `Carnet_Helpet_${tagId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    aviso('¡Carnet descargado!', 'ok');
  } catch (err) {
    console.error("Error al generar carnet:", err);
    carnet.classList.add('hidden');
    aviso('No se pudo crear el carnet. Revisa tu conexión e inténtalo de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('i').className = 'fa-solid fa-download';
    btn.querySelector('span').textContent = 'Carnet';
  }
}

// ==========================================
// AFICHE "¡SE BUSCA!"
// ==========================================
const esperarImg = img => new Promise(r => {
  if (img.complete && img.naturalWidth) return r();
  img.onload = img.onerror = () => r();
});

async function generarAficheBlob() {
  await Promise.all([cargarLib(LIB_H2C), crearQR('poster-qr', 216)]);
  await esperarImg($('poster-photo'));
  await new Promise(r => setTimeout(r, 80));
  // Escala 3: nítida también impresa o vista en grande. En la imagen el cartel va recto (sin esquinas redondas)
  // para que al compartirlo no queden esquinas de otro color
  const canvas = await html2canvas($('printable-poster'), {
    useCORS: true, scale: 3, backgroundColor: '#fbf6e3',
    onclone: doc => { doc.getElementById('printable-poster').style.borderRadius = '0'; }
  });
  return await new Promise(r => canvas.toBlob(r, 'image/png'));
}

function abrirAficheModal() {
  if (!petData) return;

  $('poster-pet-name').textContent = petData.pet || 'Mascota';
  $('poster-photo').src = petData.photo || FOTO_VACIA;

  // Dónde (si el dueño lo escribió) y cuándo («20 de octubre · 4:30 PM» o «Recientemente»)
  const lugar = String(petData.lost_location || '').trim();
  const cuando = [petData.lost_date, petData.lost_time].map(v => String(v || '').trim()).filter(Boolean).join(' · ');
  $('poster-lost-where').textContent = lugar;
  $('poster-row-where').classList.toggle('hidden', !lugar);
  $('poster-lost-when').textContent = cuando || 'Recientemente';
  $('poster-reward-text').classList.toggle('hidden', !petData.reward);

  $('poster-phone-num').textContent = fmtTel(petData.phone);
  $('poster-phone-btn').href = `tel:+${petData.phone}`;

  $('poster-breed').textContent = petData.breed || 'Sin indicar';
  $('poster-color').textContent = petData.color || 'Sin indicar';
  const edadPeso = [];
  if (petData.age) edadPeso.push(petData.age);
  if (petData.weight) edadPeso.push(fmtPeso(petData.weight));
  $('poster-age-weight').textContent = edadPeso.length > 0 ? edadPeso.join(' / ') : 'Sin indicar';

  capa('afiche-modal', true);
  // La imagen se prepara al abrir: así compartir responde al instante (iOS exige el toque reciente)
  posterBlobPromise = generarAficheBlob().catch(e => { console.error(e); return null; });
}

function cerrarAficheModal() { terminarImpresion(); capa('afiche-modal', false); }
// Imprime el afiche en su hoja ancha de dos columnas, lo más grande posible pero en una sola página A4
// (mide su alto ya con ese ancho). También funciona si se imprime desde el menú del navegador.
function prepararImpresion() {
  const poster = $('printable-poster');
  poster.classList.add('impreso');
  const alto = poster.getBoundingClientRect().height || 760;
  const zoom = Math.min(1.6, 700 / 600, 960 / alto);   // cabe en una página A4 y también en papel carta
  document.documentElement.style.setProperty('--zoom-afiche', zoom.toFixed(3));
}
function terminarImpresion() { $('printable-poster').classList.remove('impreso'); }
window.addEventListener('beforeprint', () => { if (!$('afiche-modal').classList.contains('hidden')) prepararImpresion(); });
window.addEventListener('afterprint', terminarImpresion);
function imprimirAfiche() {
  prepararImpresion();
  window.print();
}

async function compartirAficheImagen() {
  const btn = $('btn-share-img');
  const textOriginal = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generando...`;
  btn.disabled = true;
  try {
    let blob = posterBlobPromise ? await posterBlobPromise : null;
    if (!blob) blob = await generarAficheBlob();
    if (!blob) throw new Error("No se pudo generar la imagen.");

    const nombre = (petData.pet || 'MASCOTA').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const file = new File([blob], `SE_BUSCA_${nombre}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `¡SE BUSCA A ${petData.pet.toUpperCase()}!`,
        text: `Por favor ayúdanos a encontrar a ${petData.pet}. Si lo ves, comunícate al ${fmtTel(petData.phone)}`
      });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      aviso('Imagen del afiche descargada.', 'ok');
    }
  } catch (err) {
    if (!err || err.name !== 'AbortError') aviso("No se pudo compartir la imagen: " + (err && err.message ? err.message : err), 'error');
  } finally {
    btn.innerHTML = textOriginal;
    btn.disabled = false;
  }
}

// ==========================================
// HISTORIAL MÉDICO PÚBLICO (sin diagnóstico ni receta; vacío si la mascota está perdida)
// ==========================================
function abrirModalMedico() {
  capa('modal-medico', true);
  if (historial === null) cargarHistorialMedico();
}

function cerrarModalMedico() {
  capa('modal-medico', false);
  const hoja = document.querySelector('#modal-medico .hoja');
  hoja.style.animation = hoja.style.transition = hoja.style.transform = '';   // lista para entrar deslizándose otra vez
}

// Ícono según el motivo: vacuna, desparasitación o consulta
function iconoMotivo(motivo) {
  const m = String(motivo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /vacun|refuerzo|antirrab|quintuple|sextuple|triple/.test(m) ? 'fa-syringe'
    : /desparasit|parasit|pipeta|pulga|garrapat/.test(m) ? 'fa-pills'
    : /cirug|operac|castra|esteril/.test(m) ? 'fa-kit-medical' : 'fa-stethoscope';
}

function renderHistorial() {
  const lista = $('modal-medical-list');
  if (!lista) return;
  if (!historial || historial.length === 0) {
    lista.innerHTML = `
      <div class="lista-vacia">
        <i class="fa-solid fa-clipboard"></i>
        <b>Sin registros médicos</b>
        Aún no hay consultas ni vacunas registradas.
      </div>`;
    return;
  }
  // Línea de tiempo: de la consulta más reciente a la más antigua
  lista.innerHTML = `<div class="linea">${historial.map((rec, i) => `
    <div class="rec" style="--i:${i}">
      <div class="rec-h">
        <span class="ico amber"><i class="fa-solid ${iconoMotivo(rec.reason)}"></i></span>
        <b>${esc(rec.vet_name)}</b>
        <span class="pill">${esc(fmtFecha(rec.visit_date))}</span>
      </div>
      <p><i class="fa-solid fa-notes-medical"></i>${esc(rec.reason || 'Consulta general')}</p>
      ${rec.next_due_date && !rec.proxima_hecha_en ? `<p class="next"><i class="fa-solid fa-calendar-check"></i>Próximo refuerzo: ${esc(fmtFecha(rec.next_due_date))}${cuandoFalta(rec.next_due_date).texto ? ` · ${esc(cuandoFalta(rec.next_due_date).texto.toLowerCase())}` : ''}</p>` : ''}
    </div>`).join('')}</div>`;
}

async function cargarHistorialMedico() {
  const lista = $('modal-medical-list');
  if (!tagId) { actualizarSemaforoSalud([]); return; }

  if (lista) {
    lista.innerHTML = `
      <div class="lista-vacia">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        Cargando consultas...
      </div>`;
  }

  const { data: records, error } = await db.rpc('obtener_historial_medico', { p_id: tagId });
  if (error) {
    historial = null;
    if (lista) lista.innerHTML = `<div class="lista-vacia">No se pudo cargar el historial. Intenta de nuevo.</div>`;
    actualizarSemaforoSalud(null);
    return;
  }
  historial = records || [];
  renderHistorial();
  actualizarSemaforoSalud(historial);
}

// ==========================================
// CANAL DE AVISOS (@HelpetAvisos)
// ==========================================
// Todo lo del canal es solo para el dueño. Con la mascota perdida: tarjeta para publicar el aviso (el PIN y los
// límites los valida el servidor). Con la mascota en casa: invitación a unirse, solo si hay mascotas perdidas
// publicadas (la base responde solo sí/no). Los visitantes no ven nada del canal.
let publicandoCanal = false;
const zonaPerdida = () => String((petData && petData.lost_location) || '').trim();
const fmtMin = m => { m = Math.max(1, Number(m) || 1); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };

function prepararCanal() {
  if (!petData) return;
  const tarjeta = !!petData.is_lost && (esDueno() || atajoCanal);
  if (tarjeta) {
    const zona = zonaPerdida();
    $('canal-info').textContent = zona
      ? `Se publicará en el canal público su foto, sus datos, la zona «${zona}» y el enlace a su perfil.`
      : 'Para publicar, primero escribe «¿Dónde se perdió?» en Editar datos.';
    $('btn-canal-publicar').querySelector('span').textContent = zona ? 'Publicar en el canal' : 'Agregar dónde se perdió';
    $('canal-card').classList.remove('hidden');
    if (atajoCanal) setTimeout(() => $('canal-card').scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    return;
  }
  if (!esDueno()) return;   // los visitantes no ven nada del canal
  Promise.resolve(db.rpc('canal_hay_avisos'))
    .then(({ data }) => { if (data === true) $('canal-banner').classList.remove('hidden'); })
    .catch(() => {});
}

function mostrarEstadoCanal(texto, enlace) {
  const p = $('canal-estado');
  p.textContent = texto;
  if (enlace && /^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(enlace)) {
    const a = document.createElement('a');
    a.href = enlace; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ver publicación';
    a.style.cssText = 'font-weight:600;text-decoration:underline;margin-left:4px';
    p.append(a);
  }
  p.classList.remove('hidden');
}

async function publicarCanal() {
  if (!petData || publicandoCanal) return;
  const pin = leerAlmacen('sessionStorage', `pin_${tagId}`);
  if (!zonaPerdida()) {   // sin zona no hay aviso: a editar los datos (con el PIN)
    if (pin) window.location.href = `registro.html?id=${encodeURIComponent(tagId)}`;
    else abrirModalPIN();
    return;
  }
  if (!pin) { abrirModalPIN('#canal'); return; }

  publicandoCanal = true;
  const btn = $('btn-canal-publicar'), ico = btn.querySelector('i'), txt = btn.querySelector('span');
  btn.disabled = true;
  ico.className = 'fa-solid fa-spinner fa-spin';
  txt.textContent = 'Publicando...';
  let r = null;
  try { const { data } = await db.functions.invoke('publicar-canal', { body: { id: tagId, pin } }); r = data; } catch (e) {}
  publicandoCanal = false;
  btn.disabled = false;
  ico.className = 'fa-solid fa-bullhorn';
  txt.textContent = 'Publicar en el canal';

  const estado = r && r.estado;
  if (estado === 'ok') { mostrarEstadoCanal('✅ Publicado en el canal. ¡Compártelo con tus contactos!', r.enlace); return; }
  if (estado === 'incorrecto' || estado === 'pin_debil') {   // la sesión venció o ya no sirve: se pide el PIN otra vez
    try { sessionStorage.removeItem(`pin_${tagId}`); } catch (e) {}
    abrirModalPIN('#canal');
    return;
  }
  const mensajes = {
    bloqueado: '⏳ Demasiados intentos con el PIN. Espera 15 minutos o recupéralo por Telegram.',
    limite: `Ya publicaste hace poco. Podrás volver a publicar en ${fmtMin(r && r.minutos)}.`,
    limite_dia: 'Ya se publicó 3 veces hoy (el máximo). Podrás volver a publicar mañana.',
    limite_canal: 'El canal está recibiendo muchos avisos. Inténtalo de nuevo en unos minutos.',
    en_curso: 'Se está publicando… espera un momento.',
    no_perdida: 'La mascota ya no está marcada como perdida.',
    sin_zona: 'Primero escribe «¿Dónde se perdió?» en Editar datos.',
  };
  mostrarEstadoCanal(mensajes[estado] || 'No se pudo publicar ahora. Revisa tu conexión e inténtalo de nuevo.');
}

// ==========================================
// PIN DEL DUEÑO
// ==========================================
// El PIN solo ya no abre el panel: el servidor da una sesión (12 h) si este celular es del dueño (lo activó o ya se
// verificó). En un celular nuevo pide además el código que llega por Telegram, el de la tarjeta de la placa o uno de
// soporte. Un PIN fácil de adivinar se cambia antes de entrar. En el navegador solo quedan tokens, nunca el PIN.
let accesoPendiente = null;   // { acceso, telegram, tarjeta } mientras se espera la 2.ª prueba
let sesionPendiente = null;   // sesión con PIN fácil: solo sirve para cambiarlo
function mensajePIN(t) { const p = $('pin-msg'); p.textContent = t || ''; p.classList.toggle('hidden', !t); }
function pasoPIN(n, titulo, texto, ico) {
  ['pin-paso1', 'pin-paso2', 'pin-paso3'].forEach((id, i) => $(id).classList.toggle('hidden', i !== n - 1));
  $('pin-titulo').textContent = titulo;
  $('pin-texto').textContent = texto;
  $('pin-ico').className = 'fa-solid ' + ico;
  mensajePIN('');
}
function pasoInicialPIN(msg) {
  accesoPendiente = null; sesionPendiente = null;
  pasoPIN(1, 'PIN del dueño', destinoPIN === '#canal' ? 'Ingresa tus 4 dígitos para publicar el aviso.'
    : destinoPIN === '#perfil' ? 'Ingresa tus 4 dígitos para entrar.' : 'Ingresa tus 4 dígitos para editar.', 'fa-key');
  $('modal-pin-input').value = '';
  $('pin-caja').classList.remove('mal', 'bien');
  pintarPuntos();
  if (msg) mensajePIN(msg);
  $('modal-pin-input').focus();
}

function abrirModalPIN(destino = '') {
  destinoPIN = destino;
  cerrarModalMedico();
  capa('pin-modal', true);
  pasoInicialPIN();
}

function cerrarModalPIN() {
  capa('pin-modal', false);
  destinoPIN = '';
  accesoPendiente = null; sesionPendiente = null;
}

// Un punto por dígito escrito
function pintarPuntos() {
  const n = $('modal-pin-input').value.length;
  document.querySelectorAll('#pin-caja .pin-puntos span').forEach((p, k) => p.classList.toggle('lleno', k < n));
}
// Solo números; con el 4.º dígito entra solo
function alEscribirPIN() {
  const i = $('modal-pin-input');
  i.value = soloDigitos(i.value).slice(0, 4);
  $('pin-caja').classList.remove('mal', 'bien');
  pintarPuntos();
  if (i.value.length === 4) validarPINModal();
}

// Error dentro de la ventana: los puntos se ponen rojos, la caja tiembla y luego se vacía para volver a intentar
function errorPIN(texto, limpiar = true) {
  const i = $('modal-pin-input'), caja = $('pin-caja');
  mensajePIN(texto);
  caja.classList.remove('mal', 'bien');
  void caja.offsetWidth;   // reinicia la animación
  caja.classList.add('mal');
  vibrar([40, 50, 40]);
  if (limpiar) {
    const malo = i.value;
    setTimeout(() => { if (i.value === malo) { i.value = ''; pintarPuntos(); } }, sinMovimiento ? 0 : 450);
  }
  i.focus();
}

let validandoPIN = false;
async function validarPINModal() {
  const input = $('modal-pin-input').value.trim();
  if (!petData || validandoPIN) return;
  if (!/^[0-9]{4}$/.test(input)) { errorPIN('Escribe los 4 dígitos de tu PIN.', false); return; }   // no gasta un intento
  validandoPIN = true;
  const btn = $('btn-pin');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;
  const disp = leerAlmacen('localStorage', `disp_${tagId}`);
  let r = null, error = null;
  try { ({ data: r, error } = await db.rpc('entrar', { p_id: tagId, p_pin: input, p_disp: disp, p_etiqueta: etiquetaDispositivo() })); } catch (e) { error = e; }
  validandoPIN = false;
  btn.disabled = false;
  btn.textContent = 'Ingresar';
  if (error || !r) { errorPIN('No se pudo verificar el PIN. Revisa tu conexión e inténtalo de nuevo.', false); return; }
  if (r.dispositivo_invalido) { try { localStorage.removeItem(`disp_${tagId}`); } catch (e) {} }   // le quitaron el acceso a este celular
  if (r.estado === 'ok') return entradaLista(r.sesion, r.pin_debil);
  if (r.estado === 'verificar') { accesoPendiente = r; return mostrarPasoCodigo(); }
  if (r.estado === 'bloqueado') errorPIN('⏳ Demasiados intentos. Espera 15 minutos o recupera tu PIN por Telegram.');
  else if (r.estado === 'limite') errorPIN('⏳ Demasiados accesos desde celulares nuevos por hoy. Inténtalo más tarde o escríbenos por WhatsApp.');
  else errorPIN('PIN incorrecto. Inténtalo de nuevo.');
}

function mostrarPasoCodigo() {
  const a = accesoPendiente;
  const texto = a.telegram && a.tarjeta
    ? 'Este celular aún no está registrado como tuyo. Escribe el código que te enviamos por Telegram o el código de activación de la tarjeta de tu placa.'
    : a.telegram
      ? 'Este celular aún no está registrado como tuyo. Escribe el código de 6 dígitos que te enviamos por Telegram.'
      : a.tarjeta
        ? 'Este celular aún no está registrado como tuyo. Escribe el código de activación de la tarjeta de tu placa (ej. NAF3-NU2K).'
        : 'Este celular aún no está registrado como tuyo. Escríbenos por WhatsApp y te daremos un código para confirmar que eres el dueño.';
  pasoPIN(2, 'Confirma que eres el dueño', texto, 'fa-shield-halved');
  $('pin-soporte').href = 'https://wa.me/51921512933?text=' + encodeURIComponent(
    `Hola Helpet, necesito un código para entrar al panel de ${petData.pet || 'mi mascota'} (placa ${tagId}).`);
  $('btn-reenviar').classList.toggle('hidden', !a.telegram);
  $('modal-codigo-input').value = '';
  $('modal-codigo-input').focus();
}

let verificandoCodigo = false;
async function verificarCodigoModal() {
  if (!accesoPendiente || verificandoCodigo) return;
  const c = $('modal-codigo-input').value.trim();
  if (!c) { mensajePIN('Escribe el código.'); return; }
  verificandoCodigo = true;
  let r = null;
  try { const { data } = await db.rpc('verificar_acceso', { p_acceso: accesoPendiente.acceso, p_codigo: c, p_etiqueta: etiquetaDispositivo() }); r = data; } catch (e) {}
  verificandoCodigo = false;
  if (!r) { mensajePIN('No se pudo verificar. Revisa tu conexión e inténtalo de nuevo.'); return; }
  if (r.estado === 'ok') {
    try { localStorage.setItem(`disp_${tagId}`, r.dispositivo); } catch (e) {}   // desde ahora este celular es del dueño
    accesoPendiente = null;
    return entradaLista(r.sesion, r.pin_debil);
  }
  if (r.estado === 'incorrecto' && r.quedan > 0) {
    mensajePIN(`Código incorrecto. Te queda${r.quedan === 1 ? '' : 'n'} ${r.quedan} intento${r.quedan === 1 ? '' : 's'}.`);
    return;
  }
  pasoInicialPIN(r.estado === 'incorrecto' ? 'Código incorrecto. Vuelve a poner tu PIN para pedir otro.' : 'El código venció. Vuelve a poner tu PIN.');
}

async function reenviarCodigo() {
  if (!accesoPendiente) return;
  let r = null;
  try { const { data } = await db.rpc('acceso_reenviar', { p_acceso: accesoPendiente.acceso }); r = data; } catch (e) {}
  const estado = r && r.estado;
  if (estado === 'ok') mensajePIN('📲 Te enviamos otro código por Telegram.');
  else if (estado === 'espera') mensajePIN(`Espera ${r.segundos} s para pedir otro código.`);
  else if (estado === 'limite') mensajePIN('Ya te enviamos 3 códigos: usa el último que te llegó.');
  else if (estado === 'sin_telegram') { $('btn-reenviar').classList.add('hidden'); mensajePIN('Esta mascota ya no tiene Telegram vinculado.'); }
  else if (estado === 'vencido') pasoInicialPIN('El código venció. Vuelve a poner tu PIN.');
  else mensajePIN('No se pudo reenviar. Revisa tu conexión.');
}

function entradaLista(sesion, debil) {
  if (debil) {
    sesionPendiente = sesion;
    pasoPIN(3, 'Cambia tu PIN', 'Tu PIN es muy fácil de adivinar (como 1234, 0000, un año o los últimos dígitos de tu teléfono). Elige uno nuevo para continuar.', 'fa-key');
    $('pin-nuevo1').value = ''; $('pin-nuevo2').value = '';
    $('pin-nuevo1').focus();
    return;
  }
  finalizarEntrada(sesion);
}

function finalizarEntrada(sesion) {
  try {
    sessionStorage.setItem(`pin_${tagId}`, sesion);   // la sesión (no el PIN)
    localStorage.setItem(`dueno_${tagId}`, '1');      // este dispositivo es del dueño: sin avisos ni permisos de ubicación
  } catch (e) {}
  const destino = destinoPIN;
  $('pin-caja').classList.add('bien');   // los puntos se ponen verdes un momento antes de seguir
  vibrar(25);
  setTimeout(() => {
    if (destino === '#canal') { cerrarModalPIN(); publicarCanal(); return; }   // vuelve a «Publicar en el canal»
    if (destino === '#perfil') { window.location.replace(`index.html?id=${encodeURIComponent(tagId)}`); return; }   // su perfil, ya como dueño
    window.location.href = `registro.html?id=${encodeURIComponent(tagId)}${destino}`;
  }, sinMovimiento ? 0 : 450);
}

async function cambiarPinDebil() {
  if (!sesionPendiente) return;
  const p1 = $('pin-nuevo1').value.trim(), p2 = $('pin-nuevo2').value.trim();
  if (!/^[0-9]{4}$/.test(p1)) { mensajePIN('El PIN debe tener 4 números.'); return; }
  if (p1 !== p2) { mensajePIN('Los PIN no coinciden.'); return; }
  if (pinFacil(p1, petData.phone, petData.phone_secondary)) { mensajePIN(MSG_PIN_FACIL); return; }
  let r = null;
  try { const { data } = await db.rpc('cambiar_pin', { p_id: tagId, p_sesion: sesionPendiente, p_nuevo: p1 }); r = data; } catch (e) {}
  const estado = r && r.estado;
  if (estado === 'ok') { const s = sesionPendiente; sesionPendiente = null; finalizarEntrada(s); return; }
  if (estado === 'pin_debil') { mensajePIN(MSG_PIN_FACIL); return; }
  if (estado === 'incorrecto') { pasoInicialPIN('Tu sesión venció. Vuelve a poner tu PIN.'); return; }
  mensajePIN('No se pudo guardar el PIN. Revisa tu conexión e inténtalo de nuevo.');
}

// La foto en grande crece desde su lugar en la tarjeta (y al cerrar vuelve a él). Sin foto: solo las huellitas.
function cuadrosZoom() {
  const a = $('pet-photo').getBoundingClientRect(), b = $('full-pet-photo').getBoundingClientRect();
  if (!a.width || !b.width || !b.height) return null;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const s = Math.min(a.width / b.width, a.height / b.height);
  return [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, borderRadius: '50%', opacity: .5 }, { transform: 'none', borderRadius: '24px', opacity: 1 }];
}

async function abrirFotoGrande() {
  const chica = $('pet-photo'), grande = $('full-pet-photo');
  lanzarFiguras(chica, 7);
  hilar();
  vibrar(12);
  if (!petData || !petData.photo || chica.getAttribute('src') === FOTO_VACIA) return;
  grande.getAnimations && grande.getAnimations().forEach(a => a.cancel());
  grande.src = petData.photo;
  grande.style.visibility = 'hidden';   // hasta conocer su tamaño final
  capa('photo-modal', true);
  try { await grande.decode(); } catch (e) {}
  grande.style.visibility = '';
  const c = cuadrosZoom();
  if (c) animar(grande, c, { duration: 420 });
}

let cerrandoFoto = false;
function cerrarFotoGrande() {
  const modal = $('photo-modal'), grande = $('full-pet-photo');
  if (cerrandoFoto || modal.classList.contains('hidden')) return;
  const c = cuadrosZoom();
  const anims = [c && animar(grande, [c[1], c[0]], { duration: 320 }), animar(modal, [{ opacity: 1 }, { opacity: 0 }], { duration: 320 })].filter(Boolean);
  if (!anims.length) { capa('photo-modal', false); return; }
  cerrandoFoto = true;
  Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => {
    capa('photo-modal', false);
    anims.forEach(a => a.cancel());   // sin dejar estilos pegados para la próxima vez
    cerrandoFoto = false;
    hilar();                           // la foto vuelve y su anillo gira
  });
}

// ==========================================
// SEMÁFORO DE SALUD
// ==========================================
// Toma el último registro de cada motivo y gana la fecha de refuerzo más urgente.
// Un refuerzo que el dueño ya marcó como hecho no cuenta. Las fechas del carnet (próxima vacuna /
// desparasitación) cuentan siempre: con «Ya lo hice» se van actualizando solas.
function calcularEstadoSalud(registros) {
  if (registros === null) return { estado: 'error' };
  registros = registros || [];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const vistos = new Set();
  const fechas = [];
  registros.forEach(r => {
    const k = norm(r.reason);
    if (vistos.has(k)) return;
    vistos.add(k);
    if (r.next_due_date && !r.proxima_hecha_en) fechas.push(r.next_due_date);
  });
  if (petData) {
    [petData.next_vaccine, petData.next_deworming].forEach(f => { if (diasHasta(f) !== null) fechas.push(f); });
  }
  if (registros.length === 0 && fechas.length === 0) return { estado: 'sin' };
  const dias = fechas.map(diasHasta).filter(d => d !== null);
  if (dias.length === 0) return { estado: 'atendido' };
  return { estado: 'fecha', dias: Math.min(...dias) };
}

function actualizarSemaforoSalud(registros) {
  const badge = $('vaccine-badge');
  const text = $('badge-text');
  const carnetStatus = $('carnet-status-pill');
  if (!badge || !text) return;

  const e = calcularEstadoSalud(registros);
  let tono, textoEstado;

  if (e.estado === 'error') {
    tono = 'none'; textoEstado = "Estado no disponible";
  } else if (e.estado === 'sin') {
    tono = 'none'; textoEstado = "Sin historial médico";
  } else if (e.estado === 'atendido') {
    tono = 'ok'; textoEstado = "Atendido";
  } else if (e.dias > 15) {
    tono = 'ok'; textoEstado = "Protección al día";
  } else if (e.dias >= 0) {
    tono = 'warn'; textoEstado = e.dias === 0 ? "Refuerzo hoy" : `Refuerzo en ${e.dias} días`;
  } else {
    tono = 'bad'; textoEstado = "Atención vencida";
  }

  badge.className = `sem sem-${tono}`;
  text.textContent = textoEstado;

  if (carnetStatus) {
    carnetStatus.className = `cp cp-${tono}`;
    carnetStatus.textContent = textoEstado;
  }
}

// ==========================================
// INTERACCIÓN: onda al tocar, huellitas, Escape, paralaje, hoja que se arrastra y barra de contacto
// ==========================================
// Onda que nace donde se tocó el botón (sin crear nodos: mueve el ::after con --x / --y) y su ícono reacciona
ondaAlTocar('.btn', b => { if (b.matches('.btn-wa, .btn-call, .btn-gps')) vibrar(10); });

// Al tocar un espacio vacío queda un sello bordado (no en botones, enlaces, campos ni ventanas)
document.addEventListener('click', e => {
  if (sinMovimiento || (!e.clientX && !e.clientY)) return;   // sin coordenadas: «clic» del teclado
  if (e.target.closest('a, button, input, select, textarea, label, .modal, .dock, .dato, #pet-photo, #pet-name')) return;
  estamparBordado(e.clientX, e.clientY, !e.target.closest('.shell, .vacio, .card'));
});

// Tocar el nombre: las letras saltan, sale mixtura y el anillo gira
$('pet-name').addEventListener('click', () => { ola(); lanzarFiguras($('pet-name'), 7); hilar(); vibrar(12); });

// La hoja del historial se arrastra hacia abajo para cerrarla (como en las apps)
(function () {
  const hoja = document.querySelector('#modal-medico .hoja'), asa = hoja.querySelector('.hoja-h');
  let y0 = null, dy = 0;
  asa.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    y0 = e.clientY; dy = 0;
    hoja.style.animation = 'none';   // la animación de entrada ya terminó: el arrastre manda
    hoja.style.transition = 'none';
    try { asa.setPointerCapture(e.pointerId); } catch (err) {}
  });
  asa.addEventListener('pointermove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    hoja.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (y0 === null) return;
    y0 = null;
    hoja.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)';
    if (dy > 90) {
      hoja.style.transform = 'translateY(110%)';
      setTimeout(cerrarModalMedico, 230);
    } else hoja.style.transform = '';
  };
  asa.addEventListener('pointerup', soltar);
  asa.addEventListener('pointercancel', soltar);
})();

// Escape cierra la ventana de arriba
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const abierta = id => !$(id).classList.contains('hidden');
  if (abierta('photo-modal')) cerrarFotoGrande();
  else if (abierta('pin-modal')) cerrarModalPIN();
  else if (abierta('afiche-modal')) cerrarAficheModal();
  else if (abierta('modal-medico')) cerrarModalMedico();
});

// Paralaje: el paisaje andino de la cabecera baja más lento que la página y la franja de awayo avanza
const paisaje = document.querySelector('.hero > img'), franja = document.querySelector('.awayo');
if (paisaje && !sinMovimiento) {
  let pendiente = false;
  window.addEventListener('scroll', () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      paisaje.style.transform = `translate3d(0, ${Math.min(window.scrollY, 144) / 4}px, 0)`;
      franja.style.backgroundPosition = `${-window.scrollY * .5}px center`;
    });
  }, { passive: true });
}

// Barra flotante con WhatsApp y Llamar: aparece cuando la tarjeta del dueño quedó arriba, fuera de la vista.
// Copia los enlaces de esa tarjeta (el de WhatsApp cambia cuando llega la ubicación del visitante).
function sincronizarDock() {
  $('dock-wa').href = $('btn-whatsapp').href;
  $('dock-call').href = $('btn-call').href;
}
let dockActivo = false;
function activarDock() {
  if (dockActivo || !('IntersectionObserver' in window)) return;
  dockActivo = true;
  document.body.classList.add('con-dock');
  const dock = $('dock');
  $('dock-wa').addEventListener('pointerdown', sincronizarDock);
  new IntersectionObserver(([e]) => {
    const ver = !e.isIntersecting && e.boundingClientRect.top < 0;
    if (ver) sincronizarDock();
    dock.classList.toggle('ver', ver);
    dock.inert = !ver;
  }).observe($('contact-card'));
}

// ==========================================
// BOTONES Y TECLADO
// ==========================================
alClic('pet-photo', abrirFotoGrande);
$('pet-photo').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFotoGrande(); } });
alClic('btn-gps', enviarUbicacionGPS);
alClic('btn-afiche', abrirAficheModal);
alClic('btn-share-profile', compartirPerfil);
alClic('btn-canal-publicar', publicarCanal);
alClic('btn-medical-history', abrirModalMedico);
alClic('btn-carnet', descargarCarnetDigital);
// Con la sesión ya abierta en esta pestaña va directo a su panel; si no, pide el PIN
function irAlPanel(destino = '') {
  if (leerAlmacen('sessionStorage', `pin_${tagId}`)) window.location.href = `registro.html?id=${encodeURIComponent(tagId)}${destino}`;
  else abrirModalPIN(destino);
}
alClic('btn-dueno', () => irAlPanel());
// PIN: con el 4.º dígito entra solo; Enter también
$('modal-pin-input').addEventListener('input', alEscribirPIN);
alEnter('modal-pin-input', validarPINModal);
alClic('btn-pin', validarPINModal);
alEnter('modal-codigo-input', verificarCodigoModal);
alClic('btn-codigo', verificarCodigoModal);
alClic('btn-reenviar', reenviarCodigo);
alEnter('pin-nuevo2', cambiarPinDebil);
alClic('btn-pin-nuevo', cambiarPinDebil);
// Afiche
alClic('btn-share-img', compartirAficheImagen);
alClic('btn-imprimir', imprimirAfiche);
alClic('btn-cerrar-afiche', cerrarAficheModal);
// Historial médico
alClic('btn-registrar-medico', () => irAlPanel('#registrar-medico'));
alClic('btn-ir-vet', () => { location.href = 'vet.html?id=' + encodeURIComponent(tagId); });
// Ventanas: la X las cierra; tocar el fondo oscuro también (la foto en grande, con cualquier toque fuera de la foto)
alClic('pin-cerrar', cerrarModalPIN);
$('pin-modal').addEventListener('click', e => { if (e.target === e.currentTarget) cerrarModalPIN(); });
alClic('medico-cerrar', cerrarModalMedico);
$('modal-medico').addEventListener('click', e => { if (e.target === e.currentTarget) cerrarModalMedico(); });
alClic('foto-cerrar', cerrarFotoGrande);
document.querySelector('#photo-modal .foto-grande').addEventListener('click', e => e.stopPropagation());
alClic('photo-modal', cerrarFotoGrande);

cargarPerfil();
