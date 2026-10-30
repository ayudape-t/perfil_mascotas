/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Lo que comparten las páginas: conexión a Supabase, atajos, avisos breves, animaciones al tocar y reglas del PIN.
   Va antes del script de cada página. Si lo cambias, sube su ?v= en las cinco páginas (el navegador guarda la versión anterior). */

// Clave pública (anon) del proyecto: está hecha para ir en la página; lo que cada quien puede hacer lo decide la base de datos
const SUPABASE_URL = "https://cjxcqdgtchhtfowreuca.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqeGNxZGd0Y2hodGZvd3JldWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTA3NTksImV4cCI6MjEwNjI4Njc1OX0.x2Pm3dqIU7fbXhfSU0aQTi1Ve5daNgUMPkP0R3IrP4o";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtFecha = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
};

// Aviso breve abajo de la pantalla (en lugar de los alert, que bloquean la página). Usa el #toast de la página
let toastTimer = null;
function aviso(texto, tipo = 'info') {
  const t = $('toast');
  const ico = { ok: 'fa-circle-check', error: 'fa-circle-exclamation' }[tipo] || 'fa-paw';
  t.className = `toast ${tipo}`;
  t.innerHTML = `<i class="fa-solid ${ico}"></i><span></span>`;
  t.querySelector('span').textContent = texto;
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('ver')));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), tipo === 'error' ? 5000 : 3200);
}

// ---- Animaciones al tocar (todas se apagan con «reducir movimiento») ----
const sinMovimiento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const vibrar = patron => { try { if (!sinMovimiento && navigator.vibrate) navigator.vibrate(patron); } catch (e) {} };

// Reinicia una animación de CSS: quita la clase, fuerza el recálculo, la vuelve a poner y la quita al terminar
function repetir(el, clase, ms) {
  if (!el) return;
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
  clearTimeout(el['_' + clase]);
  el['_' + clase] = setTimeout(() => el.classList.remove(clase), ms);
}

// Onda (en rombo) que nace donde se tocó el botón; su ícono salta. «alTocar» recibe el botón (para vibrar, por ejemplo)
function ondaAlTocar(selector, alTocar) {
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest(selector);
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--x', `${e.clientX - r.left}px`);
    b.style.setProperty('--y', `${e.clientY - r.top}px`);
    repetir(b, 'onda', 700);   // al quitarla a tiempo, el ícono no repite su gesto cuando cambia
    if (alTocar) alTocar(b);
  }, { passive: true });
}

// Mixtura: chakanas (cruz escalonada), rombos y huellitas que saltan en abanico y caen meciéndose,
// como la mixtura que se lanza en los carnavales andinos
const CHAKANA = 'M9 0h6v3h3v3h3v3h3v6h-3v3h-3v3h-3v3H9v-3H6v-3H3v-3H0V9h3V6h3V3h3zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z';
const ROMBO = 'M12 0l12 12-12 12L0 12zM12 7l-5 5 5 5 5-5z';
const svgFigura = d => `<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${d}"/></svg>`;
const FIGURAS = [svgFigura(CHAKANA), svgFigura(ROMBO), '<i class="fa-solid fa-paw"></i>'];
const COLORES_TEJIDO = ['#b4452b', '#e0a24a', '#7f9a3e', '#3b2420'];
function lanzarFiguras(el, cantidad = 8) {
  if (sinMovimiento || !el || !el.animate) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let k = 0; k < cantidad; k++) {
    const f = document.createElement('span');
    f.className = 'figura';
    f.innerHTML = FIGURAS[k % FIGURAS.length];
    const tam = 15 + Math.random() * 11;
    f.style.cssText = `left:${x}px;top:${y}px;width:${tam}px;height:${tam}px;font-size:${tam}px;color:${COLORES_TEJIDO[(k + 1) % COLORES_TEJIDO.length]}`;
    document.body.appendChild(f);
    const ang = (-90 + (k - (cantidad - 1) / 2) * (170 / cantidad)) * Math.PI / 180;
    const dist = 80 + Math.random() * 60, giro = (Math.random() < .5 ? -1 : 1) * (140 + Math.random() * 160);
    const mece = 14 + Math.random() * 14, dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    const pos = (px, py, g, e) => `translate(-50%, -50%) translate(${px}px, ${py}px) rotate(${g}deg) scale(${e})`;
    f.animate([   // el ritmo va en cada tramo
      { transform: pos(0, 0, 0, .3), opacity: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
      { transform: pos(dx, dy, giro * .4, 1.1), opacity: 1, offset: .3, easing: 'ease-in-out' },
      { transform: pos(dx * 1.15 + mece, dy + 34, giro * .75, 1), opacity: 1, offset: .65, easing: 'ease-in' },
      { transform: pos(dx * 1.25 - mece / 2, dy + 78, giro, .9), opacity: 0 }
    ], { duration: 1300 + Math.random() * 400, delay: k * 28, fill: 'both' }).finished.then(() => f.remove(), () => f.remove());
  }
}

// ---- PIN ----
// Mismas reglas que el servidor (pin_es_debil), solo para avisar antes de enviar. «tels»: los 4 últimos dígitos de un teléfono tampoco sirven
const MSG_PIN_FACIL = 'Ese PIN es muy fácil de adivinar (como 1234, 0000, un año o los últimos 4 dígitos de tu teléfono). Elige otro.';
function pinFacil(p, ...tels) {
  if (!/^[0-9]{4}$/.test(p)) return true;
  if (/^(\d\d)\1$/.test(p) || /^(\d)\1(\d)\2$/.test(p) || /^(\d)(\d)\2\1$/.test(p) || /^(19|20)\d\d$/.test(p)) return true;
  if ('01234567890'.includes(p) || '09876543210'.includes(p)) return true;
  if (['2580','0852','1357','2468','1470','0741','3690','0963','1478','8741','3214','1236','1004','6969','1590'].includes(p)) return true;
  return tels.some(t => { const d = String(t || '').replace(/\D/g, ''); return d.length >= 4 && d.slice(-4) === p; });
}
// «Chrome · Android»: lo ve el dueño en el aviso de Telegram y en su lista de dispositivos
function etiquetaDispositivo() {
  const u = navigator.userAgent || '';
  const so = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iPod/i.test(u) ? 'iPhone' : /Windows/i.test(u) ? 'Windows' : /Mac OS/i.test(u) ? 'Mac' : /Linux/i.test(u) ? 'Linux' : 'Otro';
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Chrome|CriOS/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Navegador';
  return `${nav} · ${so}`;
}

// ---- Eventos ----
// Se conectan desde aquí y no con onclick en el HTML: así la página puede prohibir el código en línea (ver la CSP de cada página)
function alClic(id, accion) { $(id).addEventListener('click', () => accion()); }
// Enter en un campo hace lo mismo que su botón
function alEnter(id, accion) {
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') accion(); });
}

// ---- Mis mascotas: las que este celular abrió con su PIN (las usan el panel y la app instalada, app.html) ----
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
function olvidarMascota(id) {   // ya no existe (se borraron sus datos): sale de la lista y este celular la olvida
  guardarMisMascotas(leerMisMascotas().filter(m => m.id !== id));
  try { localStorage.removeItem(`dueno_${id}`); localStorage.removeItem(`disp_${id}`); sessionStorage.removeItem(`pin_${id}`); } catch (e) {}
}
// Con sesión abierta en esta pestaña entra directo a su panel; si no, su perfil abre la ventana del PIN
function enlaceMascota(id) {
  let conSesion = false;
  try { conSesion = !!sessionStorage.getItem(`pin_${id}`); } catch (e) {}
  return conSesion ? `registro.html?id=${encodeURIComponent(id)}` : `index.html?id=${encodeURIComponent(id)}&entrar=1`;
}

// ---- App instalada: el botón «atrás» del celular ----
// Vuelve a «Mis mascotas» y desde ahí sale de la app, en lugar de repasar cada pantalla que se abrió.
// Para eso, fuera de «Mis mascotas» cada paso reemplaza al anterior en el historial. (Chrome/Android; el iPhone no tiene «atrás».)
if (window.navigation && window.matchMedia('(display-mode: standalone)').matches) {
  navigation.addEventListener('navigate', e => {
    if (e.navigationType !== 'push' || e.hashChange || e.downloadRequest !== null || !e.cancelable) return;
    if (/\/app(\.html)?$/.test(location.pathname)) return;   // desde «Mis mascotas» sí se avanza: «atrás» vuelve a ella
    const destino = new URL(e.destination.url);
    if (destino.origin !== location.origin) return;           // WhatsApp, Telegram, mapas: como siempre
    e.preventDefault();
    location.replace(destino.href);
  });
}
