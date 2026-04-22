const CACHE = 'gtg-v9';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: bypass browser HTTP cache for same-origin files so deploys are instant
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = e.request.url.startsWith(self.location.origin);
  e.respondWith(
    fetch(e.request, sameOrigin ? { cache: 'reload' } : {})
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
