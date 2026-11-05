/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Página de inicio: el aviso de Telegram de la escena 2 entra cuando aparece, y en el celular el botón de pedido
   queda fijo abajo mientras no se vea ningún otro. Sin este script la página funciona igual (todo queda visible). */
(function () {
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js');

  const notif = document.querySelector('.notif');
  new IntersectionObserver((vistos, obs) => {
    if (!vistos.some(v => v.isIntersecting)) return;
    notif.classList.add('llego');
    obs.disconnect();
  }, { threshold: 0.55 }).observe(notif.closest('figure'));

  const barra = document.querySelector('.barra'), enlace = barra.querySelector('a');
  const [portada, ...otros] = [...document.querySelectorAll('.btn-pedir')].filter(b => !barra.contains(b));
  const visibles = new Set();
  let pasoPortada = false;
  const vigia = new IntersectionObserver(vistos => {
    for (const v of vistos) {
      if (v.isIntersecting) visibles.add(v.target); else visibles.delete(v.target);
      if (v.target === portada) pasoPortada = !v.isIntersecting && v.boundingClientRect.top < 0;
    }
    const ver = pasoPortada && visibles.size === 0;
    barra.classList.toggle('ver', ver);
    barra.setAttribute('aria-hidden', String(!ver));
    enlace.tabIndex = ver ? 0 : -1;
    document.body.classList.toggle('con-barra', ver);
  });
  [portada, ...otros].forEach(b => vigia.observe(b));
})();
