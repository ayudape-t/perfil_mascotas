/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* zona.html: el área aproximada donde se perdió una mascota. El enlace lo arma el aviso del canal con la zona
   que guardó el dueño, ya redondeada por la base de datos (nunca es su ubicación exacta). */

const q = new URLSearchParams(window.location.search);
const lat = Number(q.get('lat')), lon = Number(q.get('lon')), id = q.get('id') || '';
const valida = q.get('lat') && q.get('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

if (/^[A-Za-z0-9-]{3,40}$/.test(id)) {
  const perfil = document.getElementById('zona-perfil');
  perfil.href = `index.html?id=${encodeURIComponent(id)}&src=canal`;   // como desde el canal: no cuenta como escaneo
  perfil.classList.remove('hidden');
}

if (!valida || !window.L) {
  document.getElementById('zona-titulo').textContent = 'Zona no disponible';
  document.getElementById('zona-texto').textContent = 'Este enlace no tiene una zona válida. Revisa el aviso del canal.';
} else {
  const mapa = L.map('mapa', { zoomControl: true }).setView([lat, lon], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
  L.circle([lat, lon], { radius: 250, color: '#be123c', weight: 2, fillColor: '#be123c', fillOpacity: .18 }).addTo(mapa);
}
