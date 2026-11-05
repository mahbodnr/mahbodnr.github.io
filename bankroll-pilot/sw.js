/* Bankroll · offline support for the website. Network first: when online every file comes fresh from the server
   (so an update shows up straight away) and a copy is kept; offline, the kept copy is used, so a game that was
   opened once can be played without a connection. The leaderboard (Supabase) is never cached. */
const CACHE = 'bankroll-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co') || !url.protocol.startsWith('http')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate'){ const home = await caches.match(new URL('./', self.registration.scope).href); if (home) return home; }
      throw err;
    }
  })());
});
