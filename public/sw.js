const cacheName = 'outagemap-tiles-v1';
const allowedOrigins = new Set(new URL(self.location.href).searchParams.getAll('origin'));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !allowedOrigins.has(url.origin) || !/\.(pbf|mvt|png|jpg|jpeg|webp)(\?|$)/i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(event.request);
    if (cached && Date.now() - Number(cached.headers.get('x-outagemap-cached-at')) < 7 * 86400000) return cached;
    if (cached) await cache.delete(event.request);
    const response = await fetch(event.request);
    if (response.ok && response.type !== 'opaque' && !/no-store|private/i.test(response.headers.get('cache-control') ?? '')) {
      const headers = new Headers(response.headers); headers.set('x-outagemap-cached-at', String(Date.now()));
      await cache.put(event.request, new Response(await response.clone().arrayBuffer(), { status: response.status, headers }));
      const keys = await cache.keys();
      if (keys.length > 500) await cache.delete(keys[0]);
    }
    return response;
  })());
});
