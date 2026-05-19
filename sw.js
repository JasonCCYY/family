// ── 每次部署更新這個版本號 ──
const VER = 'fam-v' + Date.now(); // 每次 SW 檔案有變動就會觸發更新

const STATIC = [
  'https://cdn.jsdelivr.net/gh/6tail/lunar-javascript@master/lunar.js'
];

self.addEventListener('install', e => {
  // 立即接管，不等舊 SW 結束
  self.skipWaiting();
  e.waitUntil(
    caches.open(VER).then(cache => cache.addAll(STATIC))
  );
});

self.addEventListener('activate', e => {
  // 清除所有舊版快取
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VER).map(k => {
        console.log('[SW] 清除舊快取:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 請求：永遠走網路，不快取
  if (url.pathname.startsWith('/api/')) return;

  // index.html 和所有頁面路由：永遠走網路取最新版
  if (url.origin === self.location.origin) return;

  // 外部靜態資源（lunar.js 等）：快取優先
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(VER).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// 接收主頁面發來的 SKIP_WAITING 訊號
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
