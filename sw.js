// Forge service worker - offline support
const CACHE = 'forge-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first so updates land, but race it against a timeout so a slow
  // (not failed) connection falls back to cache instead of hanging the page
  var cacheFallback = () => caches.match(e.request).then(hit => hit || caches.match('./index.html'));
  var networkFetch = fetch(e.request).then(res => {
    if (res && res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  });
  e.respondWith(
    Promise.race([
      networkFetch,
      new Promise((_, reject) => setTimeout(() => reject(new Error('sw-fetch-timeout')), NETWORK_TIMEOUT_MS))
    ]).catch(() => {
      networkFetch.catch(() => {}); // don't let a late network failure surface as unhandled
      return cacheFallback();
    })
  );
});
