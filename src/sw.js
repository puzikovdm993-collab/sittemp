// Версия кэша. Меняйте при обновлении файлов, чтобы принудительно обновить кэш.
const CACHE_NAME = 'my-app-cache-v1';

// Файлы, которые нужно закэшировать для офлайн-доступа
const STATIC_ASSETS = [
  '/wtis_workspace.html'
];

// 1. Установка Service Worker и загрузка кэша
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// 2. Активация (очистка старых кэшей по желанию)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Обработка сетевых запросов
self.addEventListener('fetch', (event) => {
  // Игнорируем не-GET запросы или внешние ресурсы, если они не нужны в кэше
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Сначала пытаемся получить ответ из сети
    fetch(event.request)
      .then((networkResponse) => {
        // Если ответ успешный, можно обновить кэш (опционально)
        // if (networkResponse.ok) { ... }
        return networkResponse;
      })
      .catch((err) => {
        // Если сети нет, возвращаем из кэша
        return caches.match(event.request)
          .then((cachedResponse) => {
            // Если в кэше тоже ничего нет, возвращаем стандартную ошибку 404
            if (!cachedResponse) {
              return new Response('Offline: Page not found', {
                status: 404,
                statusText: 'Not Found',
                headers: new Headers({
                  'Content-Type': 'text/html'
                })
              });
            }
            return cachedResponse;
          });
      })
  );
});

