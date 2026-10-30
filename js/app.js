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

// Entrar con el código de la placa (o su enlace pegado): en iPhone la app empieza sin la lista de Safari
$('app-agregar').addEventListener('submit', e => {
  e.preventDefault();
  let codigo = $('app-codigo').value.trim();
  try { codigo = new URL(codigo).searchParams.get('id') || ''; } catch (err) {}   // no era un enlace: era el código
  codigo = codigo.toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(codigo)) { aviso('Revisa el código: son letras y números, como UJRA59MUPZ.', 'error'); return; }
  window.location.href = `index.html?id=${encodeURIComponent(codigo)}&entrar=1`;
});

cargar();
