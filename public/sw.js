/* GCP-Calc na web (iPhone, iPad e navegadores): funciona offline depois da primeira visita.
 *
 * Dois caches:
 * - "shell" (versionado): a página e os arquivos do app — trocado a cada versão nova.
 * - "runtimes" (permanente): modelos de transcrição, Python, SQL e o motor do Whisper.
 *   São grandes (dezenas de MB) e não mudam entre versões: ficam guardados e não são baixados
 *   de novo a cada atualização do app.
 * Cotações e IA continuam pela rede. */
const SHELL = 'gcp-calc-shell-v3';
const RUNTIMES = 'gcp-calc-runtimes-v1';
const START = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];
const isRuntime = (url) => /\/runtimes\//.test(url);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(START)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      // apaga só os caches antigos do app; os motores e modelos ficam
      .then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== RUNTIMES && k !== 'transformers-cache').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // página: rede primeiro (pega a versão nova), cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  // motores/modelos: cache permanente · demais arquivos (com hash no nome): cache da versão
  const bucket = isRuntime(req.url) ? RUNTIMES : SHELL;
  e.respondWith(
    caches.match(req, { ignoreSearch: isRuntime(req.url) }).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok && r.status === 200 && r.type === 'basic') {
            const copy = r.clone();
            caches.open(bucket).then((c) => c.put(req, copy));
          }
          return r;
        }),
    ),
  );
});

// notificações: tocar abre o app; "Marcar como pago" avisa o app aberto (ou abre e avisa)
self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  const data = n.data || {};
  n.close();
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      let c = all.find((x) => x.url.startsWith(self.registration.scope));
      if (c) await c.focus();
      else c = await self.clients.openWindow(data.url || self.registration.scope);
      if (c) c.postMessage({ type: 'gcp-notification', key: data.key, action: e.action || 'open' });
    })(),
  );
});
