const CACHE_NAME = 'family-v1';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/gh/6tail/lunar-javascript@master/lunar.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
