/**
 * Como as alterações viajam entre os aparelhos:
 *
 * - P2P (padrão, nada para configurar): conexão direta entre os aparelhos (WebRTC). Para se
 *   encontrarem usam a infraestrutura pública e gratuita de rastreadores BitTorrent e de relays
 *   Nostr, as duas ao mesmo tempo (uma é reserva da outra). Os dados não passam por elas.
 * - Servidor de sincronização (opcional): guarda as alterações cifradas e entrega a quem abrir
 *   depois, mesmo com os outros offline. Ele só vê dados cifrados com a chave do link.
 */
export interface Handlers {
  /** id deste aparelho na sessão e nome mostrado aos outros */
  me: { id: string; name: string };
  stateVector(): Uint8Array;
  diffFor(sv: Uint8Array): Uint8Array;
  full(): Uint8Array;
  onUpdate(u: Uint8Array): void;
  onPeers(peers: { id: string; name: string }[]): void;
  onStatus(s: 'connecting' | 'online' | 'offline' | 'error', detail?: string): void;
}

export interface Transport {
  send(u: Uint8Array): void;
  stop(): void;
}

const u8 = (x: unknown) => (x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : new Uint8Array(x as ArrayLike<number>));

/** rastreadores próprios para testes (localStorage gcp-calc:collab-trackers = "ws://…,ws://…") */
function customTrackers(): string[] | undefined {
  try {
    const v = localStorage.getItem('gcp-calc:collab-trackers');
    return v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ P2P

export async function p2pTransport(roomId: string, secret: string, h: Handlers): Promise<Transport> {
  const trackers = customTrackers();
  const mods = trackers ? [await import('trystero/torrent')] : await Promise.all([import('trystero/torrent'), import('trystero/nostr')]);
  type Room = ReturnType<(typeof mods)[number]['joinRoom']>;
  const rooms: Room[] = [];
  const peers = new Map<string, { id: string; name: string; via: Set<string> }>();
  const emitPeers = () => h.onPeers([...peers.values()].map((p) => ({ id: p.id, name: p.name })));
  const senders: ((u: Uint8Array) => void)[] = [];
  h.onStatus('connecting');
  mods.forEach((m, i) => {
    const room = m.joinRoom({ appId: 'gcp-calc-collab-v1', password: secret, ...(trackers ? { relayUrls: trackers } : {}) }, roomId);
    rooms.push(room);
    const [sendSv, getSv] = room.makeAction<Uint8Array>('sv');
    const [sendUp, getUp] = room.makeAction<Uint8Array>('up');
    const [sendHi, getHi] = room.makeAction<{ id: string; name: string }>('hi');
    room.onPeerJoin((peer) => {
      // apresenta-se e pede o que falta: o outro responde só com a diferença
      sendHi({ id: h.me.id, name: h.me.name }, peer);
      sendSv(h.stateVector(), peer);
    });
    room.onPeerLeave((peer) => {
      for (const [k, p] of peers) {
        p.via.delete(`${i}:${peer}`);
        if (!p.via.size) peers.delete(k);
      }
      emitPeers();
    });
    getHi((d, peer) => {
      if (!d?.id || d.id === h.me.id) return;
      const p = peers.get(d.id) ?? { id: d.id, name: d.name || '', via: new Set<string>() };
      p.name = d.name || p.name;
      p.via.add(`${i}:${peer}`);
      peers.set(d.id, p);
      emitPeers();
      h.onStatus('online');
    });
    getSv((sv, peer) => {
      const diff = h.diffFor(u8(sv));
      if (diff.length > 2) sendUp(diff, peer);
    });
    getUp((u) => h.onUpdate(u8(u)));
    senders.push((u) => void sendUp(u));
  });
  return {
    send: (u) => senders.forEach((s) => s(u)),
    stop: () => rooms.forEach((r) => void r.leave()),
  };
}

// ------------------------------------------------------------------ servidor (opcional)

async function keyFor(secret: string, roomId: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode('gcp-calc-collab:' + roomId), iterations: 100_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function relayTransport(url: string, roomId: string, secret: string, h: Handlers): Promise<Transport> {
  const key = await keyFor(secret, roomId);
  const seal = async (u: Uint8Array) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, u as Uint8Array<ArrayBuffer>));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return b64(out);
  };
  const open = async (s: string) => {
    const all = unb64(s);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, key, all.subarray(12)));
  };
  const wsUrl = url.replace(/\/+$/, '').replace(/^http/i, 'ws') + '/r/' + encodeURIComponent(roomId);
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 0;
  const queue: string[] = [];
  const connect = () => {
    if (stopped) return;
    h.onStatus('connecting');
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      retry = 0;
      queue.splice(0).forEach((m) => ws!.send(m));
    };
    ws.onmessage = async (e) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m.t === 'up' && m.d) h.onUpdate(await open(m.d));
        else if (m.t === 'ready') {
          // já recebeu tudo o que estava guardado: manda o estado completo (o servidor compacta)
          ws?.send(JSON.stringify({ t: 'snap', d: await seal(h.full()) }));
          h.onStatus('online');
        } else if (m.t === 'peers') h.onPeers(Array.from({ length: Math.max(0, (m.n ?? 1) - 1) }, (_, i) => ({ id: 'relay-' + i, name: '' })));
      } catch (err) {
        h.onStatus('error', String((err as Error)?.message ?? err));
      }
    };
    ws.onclose = () => {
      if (stopped) return;
      h.onStatus('offline');
      setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  return {
    send: (u) =>
      void seal(u).then((d) => {
        const msg = JSON.stringify({ t: 'up', d });
        if (ws?.readyState === WebSocket.OPEN) ws.send(msg);
        else queue.push(msg);
      }),
    stop: () => {
      stopped = true;
      ws?.close();
    },
  };
}
