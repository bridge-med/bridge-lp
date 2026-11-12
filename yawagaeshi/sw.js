/* やわ返 — Service Worker (簡易オフラインキャッシュ / PWA) */
var CACHE = 'yawagaeshi-v3';
var ASSETS = [
  './',
  './index.html',
  './app/styles.css',
  './app/store.js',
  './app/replyService.js',
  './app/app.js',
  './app/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    // 同じオリジンのほかの道具のキャッシュは消さない(Cache Storage はオリジン単位。自分の接頭辞だけを片づける)
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('yawagaeshi-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// cache-first（同一オリジンのみ）。フォント等はネット任せ。
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
