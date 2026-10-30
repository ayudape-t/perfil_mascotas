/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Helpet como app instalada (lo registran el panel y app.html). No guarda copias de la página: cada pantalla se pide
   a internet, así siempre se ve la versión más nueva. Sin conexión, en lugar del error del navegador sale este aviso. */

const SIN_CONEXION = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="theme-color" content="#3b2420"><title>Sin conexión - Helpet</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#29170d;font-family:system-ui,sans-serif;color:#f8edd1;text-align:center;padding:24px;box-sizing:border-box">
<main><div style="font-size:56px" aria-hidden="true">🐾</div>
<h1 style="font-size:20px;margin:16px 0 6px">Sin conexión</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e8c9a0">Helpet necesita internet para mostrar a tus mascotas.<br>Revisa tu conexión e inténtalo otra vez.</p>
<a href="" style="display:inline-block;padding:12px 22px;border-radius:14px;background:#b4452b;color:#fff;font-weight:600;text-decoration:none">Reintentar</a>
</main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;   // fotos, scripts y datos van directo, como siempre
  e.respondWith(fetch(e.request).catch(() =>
    new Response(SIN_CONEXION, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
