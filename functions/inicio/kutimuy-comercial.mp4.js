/*
  © 2026 Kutimuy. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Video de inicio.html. Cloudflare Pages responde con el archivo entero (200) aunque el navegador pida solo un trozo
   (cabecera Range), y Safari (iPhone, Mac) no reproduce video así. Aquí se entrega el trozo pedido con 206, como
   indica Cloudflare: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/#range-requests */
export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return env.ASSETS.fetch(request);
  const archivo = await env.ASSETS.fetch(new Request(request.url));   // siempre entero, sin Range
  if (!archivo.ok) return archivo;
  const cabeceras = new Headers(archivo.headers);
  cabeceras.set('Accept-Ranges', 'bytes');
  const pedido = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!pedido || (pedido[1] === '' && pedido[2] === '')) return new Response(archivo.body, { status: 200, headers: cabeceras });

  const datos = new Uint8Array(await archivo.arrayBuffer());
  const total = datos.length;
  const inicio = pedido[1] === '' ? Math.max(0, total - Number(pedido[2])) : Number(pedido[1]);   // «bytes=-500»: los últimos 500
  const fin = pedido[1] === '' || pedido[2] === '' ? total - 1 : Math.min(Number(pedido[2]), total - 1);
  if (inicio >= total || inicio > fin) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  cabeceras.set('Content-Range', `bytes ${inicio}-${fin}/${total}`);
  cabeceras.set('Content-Length', String(fin - inicio + 1));
  return new Response(datos.subarray(inicio, fin + 1), { status: 206, headers: cabeceras });
}
