/**
 * Service Worker - 离线缓存与PWA安装支持（双端独立版）
 */
const CACHE_NAME = 'hw-eval-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/student.html',
  '/parent.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/manifest-student.json',
  '/manifest-parent.json',
  '/icons/icon-student-192.png',
  '/icons/icon-student-512.png',
  '/icons/icon-parent-192.png',
  '/icons/icon-parent-512.png'
];

// 安装：缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 网络优先，失败回退缓存（API请求不缓存）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求：网络直连，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  // 上传图片不缓存
  if (url.pathname.startsWith('/uploads/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 缓存成功的GET静态资源
        if (event.request.method === 'GET' && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // 导航请求回退：按路径回退对应入口页
          if (event.request.mode === 'navigate') {
            if (url.pathname.startsWith('/student')) {
              return caches.match('/student.html');
            }
            if (url.pathname.startsWith('/parent')) {
              return caches.match('/parent.html');
            }
            return caches.match('/index.html');
          }
          return new Response('', { status: 404, statusText: 'Offline' });
        });
      })
  );
});
