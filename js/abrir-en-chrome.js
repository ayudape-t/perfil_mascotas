/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* index.html: se carga primero, en la cabecera, para reabrir la ficha en Chrome lo antes posible */

// Android: si la ficha se abre en el navegador de Xiaomi o en el visor de una app, la reabre en Chrome
(function () {
  var ua = navigator.userAgent, q = location.search;
  if (window.__redirigiendo || !/Android/i.test(ua) || /[?&]nochrome=1/.test(q) || sessionStorage.getItem('a_chrome')) return;
  if (!/; wv\)|MiuiBrowser|FBAN|FBAV|Instagram|Line\/|GSA\/|UCBrowser|HeyTapBrowser|VivoBrowser|MicroMessenger|Telegram/i.test(ua)) return;
  sessionStorage.setItem('a_chrome', '1');
  window.__redirigiendo = true;
  var fallback = encodeURIComponent(location.href + (q ? '&' : '?') + 'nochrome=1');
  location.replace('intent://' + location.host + location.pathname + q +
    '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + fallback + ';end');
})();
