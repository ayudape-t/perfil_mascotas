/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* La app instalada abre aquí (app.html): las mascotas que este celular abrió con su PIN. Va después de js/comun.js */

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

function pintar(lista) {
  $('app-vacio').classList.toggle('hidden', lista.length > 0);
  $('app-lista').innerHTML = lista.map(m => `
    <a class="card row-mini app-mascota" href="${esc(enlaceMascota(m.id))}">
      <span class="mis-foto">${m.f ? `<img src="${esc(m.f)}" alt="">` : '<i class="fa-solid fa-paw"></i>'}</span>
      <span class="txt">
        <span class="t">${esc(m.n || 'Mascota')}</span>
        <span class="s${m.p ? ' perdida' : ''}">${m.p ? '<i class="fa-solid fa-bullhorn"></i> Alarma activa' : 'En casa'}</span>
      </span>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </a>`).join('');
  // Una foto que no carga deja la huellita
  $('app-lista').querySelectorAll('.mis-foto img').forEach(img => img.addEventListener('error', () => {
    img.replaceWith(Object.assign(document.createElement('i'), { className: 'fa-solid fa-paw' }));
  }, { once: true }));
}

// Se muestran al instante y luego se actualizan (nombre, foto, alarma); las que ya no existen salen de la lista
async function cargar() {
  const lista = leerMisMascotas();
  pintar(lista);
  if (!lista.length) return;
  const resp = await Promise.all(lista.map(m => Promise.resolve(client.rpc('obtener_mascota', { p_id: m.id })).catch(() => null)));
  const nueva = [];
  lista.forEach((m, k) => {
    const r = resp[k];
    if (!r || r.error) { nueva.push(m); return; }   // sin conexión: se queda como estaba
    if (!r.data) { olvidarMascota(m.id); return; }
    nueva.push({ id: m.id, n: r.data.pet || '', f: r.data.photo || '', p: !!r.data.is_lost });
  });
  guardarMisMascotas(nueva);
  pintar(nueva);
}

// ---- Agregar una mascota: el QR de su placa (cámara), acercar el celular (NFC, solo Android con Chrome) o su código ----
// En iPhone la app empieza sin la lista de Safari: así se agrega cada mascota. Después, su perfil pide el PIN.
function idDePlaca(texto) {
  let v = String(texto || '').trim();
  try { v = new URL(v).searchParams.get('id') || ''; } catch (e) {}   // era el enlace de la placa, no el código
  v = v.toUpperCase();
  return /^[A-Z0-9-]{3,40}$/.test(v) ? v : null;
}
const abrirPlaca = id => { window.location.href = `index.html?id=${encodeURIComponent(id)}&entrar=1`; };

$('app-agregar').addEventListener('submit', e => {
  e.preventDefault();
  const id = idDePlaca($('app-codigo').value);
  if (!id) { aviso('Revisa el código: son letras y números, como UJRA59MUPZ.', 'error'); return; }
  abrirPlaca(id);
});

let camara = null, lecturaNFC = null;   // lo que está abierto: se apaga al cerrar el lector
function cerrarEscaner() {
  if (camara) { camara.getTracks().forEach(t => t.stop()); camara = null; }
  if (lecturaNFC) { lecturaNFC.abort(); lecturaNFC = null; }
  $('escaner').classList.add('hidden');
}
function abrirEscaner(nfc) {
  $('escaner-titulo').textContent = nfc ? 'Acerca el celular a su placa' : 'Escanea el QR de su placa';
  $('escaner-texto').textContent = nfc ? 'Pon la parte de atrás del celular sobre la placa y espera un momento.' : 'Apunta la cámara al código QR de la placa.';
  $('escaner-camara').classList.toggle('hidden', nfc);
  $('escaner-nfc').classList.toggle('hidden', !nfc);
  $('escaner').classList.remove('hidden');
}
// Lo leído (enlace o código): si es de una placa Helpet, abre su perfil; si no, avisa y sigue leyendo
function leida(texto) {
  const id = idDePlaca(texto);
  if (!id) { $('escaner-texto').textContent = 'Eso no es una placa Helpet. Prueba otra vez.'; return false; }
  vibrar(40);
  cerrarEscaner();
  abrirPlaca(id);
  return true;
}
const cargarScript = src => new Promise((ok, mal) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = mal;
  document.head.append(s);
});

alClic('btn-qr', async () => {
  abrirEscaner(false);
  try {
    if (!window.jsQR) await cargarScript('vendor/jsqr-1.4.0/jsQR.js');   // solo se descarga al usar el lector
    camara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (err) {
    cerrarEscaner();
    aviso(err && err.name === 'NotAllowedError'
      ? 'No diste permiso para usar la cámara. Actívalo en los ajustes del celular, o escribe el código de la placa.'
      : 'No se pudo abrir la cámara. Escribe el código de la placa.', 'error');
    return;
  }
  const video = $('escaner-video');
  video.srcObject = camara;
  try { await video.play(); } catch (e) {}
  const lienzo = document.createElement('canvas'), ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const mirar = () => {
    if (!camara) return;   // se cerró el lector
    if (video.readyState >= 2 && video.videoWidth) {
      const escala = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));   // imagen chica: lee más rápido
      lienzo.width = Math.round(video.videoWidth * escala);
      lienzo.height = Math.round(video.videoHeight * escala);
      ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const qr = jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height, { inversionAttempts: 'dontInvert' });
      if (qr && qr.data && leida(qr.data)) return;
    }
    setTimeout(mirar, 150);
  };
  mirar();
});

// NFC: solo Chrome en Android lo permite a las páginas web (en iPhone no aparece el botón)
if ('NDEFReader' in window) $('btn-nfc').classList.remove('hidden');
alClic('btn-nfc', async () => {
  abrirEscaner(true);
  lecturaNFC = new AbortController();
  try {
    const lector = new NDEFReader();
    lector.onreading = e => {
      for (const r of e.message.records) {
        if (!['url', 'absolute-url', 'text'].includes(r.recordType)) continue;
        if (leida(new TextDecoder(r.encoding || 'utf-8').decode(r.data))) return;
      }
      $('escaner-texto').textContent = 'Esa placa no tiene un enlace de Helpet. Prueba con el QR o el código.';
    };
    lector.onreadingerror = () => { $('escaner-texto').textContent = 'No se pudo leer la placa. Acércala de nuevo, sin moverla.'; };
    await lector.scan({ signal: lecturaNFC.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') return;   // se canceló
    cerrarEscaner();
    aviso(err && err.name === 'NotAllowedError'
      ? 'No diste permiso para usar NFC. Puedes escanear el QR o escribir el código.'
      : 'No se pudo usar NFC. Revisa que esté activado en tu celular, o escanea el QR.', 'error');
  }
});

alClic('escaner-cerrar', cerrarEscaner);
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarEscaner(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) cerrarEscaner(); });   // no deja la cámara prendida

cargar();
