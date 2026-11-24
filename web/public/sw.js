/**
 * Service worker da Klava Intranet (PWA).
 * - Páginas (HTML): rede primeiro → sempre a versão mais nova; sem internet, usa a última salva.
 * - Arquivos do build (assets/ com hash no nome): cache primeiro (nunca mudam).
 * - Demais arquivos do próprio site (legado/app.js, logos, ícones): usa o salvo e atualiza por trás.
 * - Supabase, Google e qualquer outro domínio: não passa por aqui (dados sempre ao vivo).
 */
const VERSAO = 'klava-v1';
const BASICO = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(BASICO)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(VERSAO).then((c) => c.put('./index.html', copia));
      return r;
    }).catch(() => caches.match('./index.html').then((r) => r || new Response(
      '<meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:32px">Sem internet. Conecte-se e abra de novo.</body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    })));
    return;
  }

  e.respondWith(caches.match(req).then((hit) => {
    const rede = fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => hit);
    return hit || rede;
  }));
});
