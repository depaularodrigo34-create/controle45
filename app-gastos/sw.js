const CACHE = 'gastos-v15-offline100';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const CDN_CACHE = 'gastos-cdn-v15';
// CDNs para cache opcional (não bloqueia install se falhar)
const CDN_URLS = [
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // Cache CDNs em background, sem falhar install
    try {
      const cdnCache = await caches.open(CDN_CACHE);
      await Promise.allSettled(CDN_URLS.map(async url => {
        try {
          const res = await fetch(url, { mode: 'no-cors' });
          // no-cors opaque responses ainda podem ser cacheadas
          if (res) await cdnCache.put(url, res.clone());
        } catch {}
      }));
    } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isNavigate = e.request.mode === 'navigate';

  // Navegação: network-first com fallback para cache (resolve ?v=11 e offline)
  if (isNavigate) {
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request);
        if (net && net.status === 200) {
          const c = await caches.open(CACHE);
          c.put('./index.html', net.clone());
          c.put('./', net.clone());
        }
        return net;
      } catch {
        const cached = await caches.match('./index.html') || await caches.match('./') || await caches.match(e.request);
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // CDN / assets: stale-while-revalidate
  if (CDN_URLS.some(u => e.request.url.startsWith(u.split('?')[0])) || url.origin !== location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      const fetchPromise = fetch(e.request).then(async resp => {
        if (resp && resp.status === 200) {
          const c = await caches.open(CDN_CACHE);
          c.put(e.request, resp.clone());
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }

  // Outros: cache-first com network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // revalida em background
        fetch(e.request).then(resp => {
          if (resp && resp.status === 200) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
