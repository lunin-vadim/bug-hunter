'use strict';

/**
 * Офлайн-режим: оболочка игры кэшируется, поэтому в гостевом режиме она запускается без сети.
 * Стратегия «сначала сеть»: пока сервер доступен, игрок всегда получает свежие файлы, а кэш — только запасной вариант.
 * API и проверка здоровья не кэшируются: рейтинг и сессия должны быть настоящими.
 */
const CACHE = 'bug-hunter-v1';
const SHELL = [
  './', 'index.html', 'style.css', 'game.js', 'board.js', 'cabinet.js', 'favicon.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/healthz') { return; }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
