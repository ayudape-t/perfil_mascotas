/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* privacidad.html: «← Volver» regresa a la página de Helpet de donde vino; si no vino de una, no aparece */

(function () {
  const volver = document.getElementById('volver');
  let r = '';
  try { r = document.referrer ? new URL(document.referrer).origin : ''; } catch (e) {}
  if (history.length <= 1 || r !== location.origin) volver.style.display = 'none';
  volver.addEventListener('click', e => { e.preventDefault(); history.back(); });
})();
