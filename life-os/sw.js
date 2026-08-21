/* LIFE//OS — Service Worker（オフラインキャッシュ / PWA）
   資産を更新したら CACHE の版名を必ず上げる。上げ忘れは旧画面の配信になる。 */
var CACHE = 'life-os-v2';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/styles.css',
  './app/store.js',
  './app/engine.js',
  './app/charts.js',
  './app/app.js',
  './app/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 同一オリジンのみ cache-first。フォント等の外部はネットワーク任せ（オフラインでは代替書体になる） */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
