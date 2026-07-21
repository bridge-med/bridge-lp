/* ごきげん回復ガチャ — Service Worker (簡易オフラインキャッシュ / PWA) */
var CACHE = 'gokigen-gacha-v6';
var ASSETS = [
  './',
  './index.html',
  './app/styles.css?v=6',
  './app/data.js?v=6',
  './app/store.js?v=6',
  './app/app.js?v=6',
  './app/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* 一部が取れなくてもインストールは進める */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// cache-first(同一オリジンのGETのみ)。フォント等の外部リソースはネット任せ。
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
