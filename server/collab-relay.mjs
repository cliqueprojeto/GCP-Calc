// Servidor de sincronização opcional da colaboração do GCP-Calc.
// Guarda e repassa as alterações das notas compartilhadas — sempre cifradas com a chave do
// link (AES-256-GCM no aparelho): o servidor nunca vê o conteúdo. Sem ele, a colaboração
// continua funcionando direto entre os aparelhos (P2P) quando estão online ao mesmo tempo.
//
//   npm install && node collab-relay.mjs        (porta: PORT, padrão 8787; dados: DATA_DIR)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const DATA = process.env.DATA_DIR || path.resolve('relay-data');
const MAX_MSG = 8 * 1024 * 1024; // 8 MB por mensagem (notas com fotos de comprovantes)
const MAX_LOG = 5000;
fs.mkdirSync(DATA, { recursive: true });

/** sala → { log: string[], clients: Set<ws> } */
const rooms = new Map();
const file = (id) => path.join(DATA, id + '.json');
function room(id) {
  let r = rooms.get(id);
  if (!r) {
    let log = [];
    try {
      log = JSON.parse(fs.readFileSync(file(id), 'utf8'));
    } catch {}
    r = { log, clients: new Set(), timer: null };
    rooms.set(id, r);
  }
  return r;
}
function save(id, r) {
  clearTimeout(r.timer);
  r.timer = setTimeout(() => fs.writeFile(file(id), JSON.stringify(r.log), () => {}), 500);
}
const peers = (r) => {
  const msg = JSON.stringify({ t: 'peers', n: r.clients.size });
  for (const c of r.clients) c.readyState === 1 && c.send(msg);
};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end('GCP-Calc — servidor de sincronização ativo\n');
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });
wss.on('connection', (ws, req) => {
  const m = /^\/r\/([a-f0-9]{16,64})$/.exec((req.url || '').split('?')[0]);
  if (!m) return ws.close(1008, 'sala inválida');
  const id = m[1];
  const r = room(id);
  r.clients.add(ws);
  // entrega tudo o que estava guardado e avisa que terminou
  for (const d of r.log) ws.send(JSON.stringify({ t: 'up', d }));
  ws.send(JSON.stringify({ t: 'ready' }));
  let readyAt = r.log.length;
  peers(r);
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (typeof msg.d !== 'string') return;
    if (msg.t === 'up') {
      r.log.push(msg.d);
      if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);
      for (const c of r.clients) if (c !== ws && c.readyState === 1) c.send(JSON.stringify({ t: 'up', d: msg.d }));
      save(id, r);
    } else if (msg.t === 'snap') {
      // estado completo de quem acabou de receber tudo: compacta o histórico guardado
      r.log = [msg.d, ...r.log.slice(readyAt)];
      readyAt = 1;
      save(id, r);
    }
  });
  ws.on('close', () => {
    r.clients.delete(ws);
    peers(r);
  });
});
server.listen(PORT, () => console.log(`GCP-Calc relay na porta ${PORT} (dados em ${DATA})`));
