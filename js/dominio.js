/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Todas las páginas: se carga primero, en la cabecera */

// La web se mudó de GitHub Pages a Cloudflare. Las placas, los QR y los mensajes antiguos con la dirección vieja
// siguen funcionando: llevan a la misma página (con su ?id= y su #) en la dirección nueva.
(function () {
  if (location.hostname !== 'ayudape-t.github.io') return;
  window.__redirigiendo = true;
  location.replace('https://helpet.pages.dev' + location.pathname.replace(/^\/perfil_mascotas(?=\/|$)/, '') +
    location.search + location.hash);
})();
