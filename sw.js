// Kristall-Echo Service Worker: offline spielbar, Updates kommen trotzdem sofort an.
const CACHE = 'kristall-echo-v1';
const ASSETS = ['./', './index.html', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Seite: erst Netz (max. 3 s), sonst Cache. So gibt es online immer die neueste Version.
function pageFromNetwork(req) {
  const net = fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => { c.put('./index.html', copy.clone()); c.put('./', copy); });
    }
    return res;
  });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000));
  return Promise.race([net, timeout])
    .catch(() => caches.match('./index.html').then(m => m || caches.match('./')).then(m => m || net));
}

// Icon & Schriften: aus dem Cache, im Hintergrund aktualisieren.
function staleWhileRevalidate(req) {
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith(pageFromNetwork(req));
    return;
  }
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
  }
});
