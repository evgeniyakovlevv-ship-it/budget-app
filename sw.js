// Service worker: хранит оболочку приложения, чтобы оно открывалось мгновенно и без интернета.
// Запросы к серверу (script.google.com) не кэшируются — данные всегда свежие.
// При изменении файлов приложения увеличьте номер версии.
const CACHE = 'budget-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
  './jsQR.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // «Поделиться» картинкой с QR из другого приложения (Ozon, Купер, галерея):
  // сохраняем файл и открываем приложение — оно само распознает чек
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('file');
        const text = [form.get('text'), form.get('url'), form.get('title')].filter(Boolean).join(' ');
        const c = await caches.open('budget-share');
        if (file && file.size) await c.put('./shared-file', new Response(file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }));
        else if (text) await c.put('./shared-text', new Response(text));
      } catch (e) { /* откроем приложение как обычно */ }
      return Response.redirect('./?share=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // API и чужие адреса — мимо кэша

  // Страница: сначала сеть (чтобы получать обновления), без сети — из кэша
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Остальное (иконки, манифест): из кэша, иначе из сети
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
