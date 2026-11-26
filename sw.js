// 더밀착수학 앱 서비스워커 - 앱을 고칠 때마다 VERSION 숫자를 올리면 가족 폰에 "새 버전" 알림이 떠요
const VERSION = '1.4.0';
const CACHE = 'tmm-' + VERSION;
const SHELL = ['./', './index.html', './app.js', './push.js', './firebase-config.js', './manifest.json', './icon-192.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tmm-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});

// 푸시 알림 표시
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '더밀착수학', { body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { if (e.notification.tag === 'update' && 'navigate' in c) return c.focus().then(w => (w || c).navigate(url)).catch(() => c.focus()); return c.focus(); } } return clients.openWindow(url); }));
});
