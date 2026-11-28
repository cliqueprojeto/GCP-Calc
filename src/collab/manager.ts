/**
 * Sessões de colaboração: uma por nota/pasta compartilhada. Leva as edições locais para o
 * documento colaborativo e as dos outros para as notas do app, guarda o estado (para mesclar
 * certo depois) e mantém a lista de quem está online.
 */
import * as Y from 'yjs';
import { create } from 'zustand';
import { useData } from '../store/data';
import type { Note, Share } from '../lib/types';
import { LOCAL, fromB64, metaMap, noteFromY, notesMap, shareKey, toB64, writeNoteToY, changedNoteIds } from './doc';
import { p2pTransport, relayTransport, type Handlers, type Transport } from './transport';

const REMOTE = 'gcp-remote';
const INIT = 'gcp-init';

export interface Presence {
  status: 'connecting' | 'online' | 'offline' | 'error';
  peers: { id: string; name: string }[];
  relay?: 'connecting' | 'online' | 'offline' | 'error';
}
export const useCollab = create<Record<string, Presence>>(() => ({}));

interface Session {
  share: Share;
  doc: Y.Doc;
  snap: Map<string, string>;
  transports: Transport[];
  saveTimer?: ReturnType<typeof setTimeout>;
  peers: Map<string, { id: string; name: string }[]>;
}

const sessions = new Map<string, Session>();
const clientId = (() => {
  try {
    let id = localStorage.getItem('gcp-calc:collab-client');
    if (!id) localStorage.setItem('gcp-calc:collab-client', (id = Math.random().toString(36).slice(2, 10)));
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
})();

const myName = () => useData.getState().settings.collab?.name?.trim() || defaultName();
function defaultName() {
  const n = navigator.userAgent;
  return /Android/i.test(n) ? 'Android' : /iPhone|iPad/i.test(n) ? 'iPhone/iPad' : /Mac/i.test(n) ? 'Mac' : /Windows/i.test(n) ? 'Windows' : 'Linux';
}

/** notas que fazem parte do compartilhamento neste aparelho */
function scopeNotes(sh: Share): Note[] {
  const notes = useData.getState().notes;
  return sh.kind === 'note' ? notes.filter((n) => n.id === sh.targetId) : notes.filter((n) => n.folderId === sh.targetId);
}

/** edições locais → documento */
function pushLocal(s: Session) {
  for (const n of scopeNotes(s.share)) {
    if (n.purged) continue;
    const k = shareKey(n);
    if (s.snap.get(n.id) === k) continue;
    writeNoteToY(s.doc, n);
    s.snap.set(n.id, k);
  }
  if (s.share.kind === 'folder' && s.share.owner) {
    const f = useData.getState().folders.find((x) => x.id === s.share.targetId);
    const meta = metaMap(s.doc);
    if (f && (meta.get('name') !== f.name || meta.get('icon') !== f.icon || meta.get('color') !== f.color))
      s.doc.transact(() => {
        meta.set('name', f.name);
        meta.set('icon', f.icon);
        meta.set('color', f.color);
      }, LOCAL);
  }
}

/** documento → notas do app (alterações dos outros) */
function applyRemote(s: Session, ids: Iterable<string>) {
  const st = useData.getState();
  const updates: Note[] = [];
  for (const id of ids) {
    const y = noteFromY(s.doc, id);
    if (!y) continue;
    const cur = st.notes.find((n) => n.id === id);
    const next: Note = cur
      ? { ...cur, title: y.title, icon: y.icon, color: y.color, blocks: y.blocks, deleted: y.deleted, updated: Date.now() }
      : { ...y, created: Date.now(), updated: Date.now(), folderId: s.share.kind === 'folder' ? s.share.targetId : undefined };
    if (cur && shareKey(cur) === shareKey(next)) {
      s.snap.set(id, shareKey(cur));
      continue;
    }
    s.snap.set(id, shareKey(next));
    updates.push(next);
  }
  if (!updates.length) return;
  useData.setState((d) => {
    const byId = new Map(updates.map((n) => [n.id, n]));
    const notes = d.notes.map((n) => byId.get(n.id) ?? n);
    for (const n of updates) if (!d.notes.some((x) => x.id === n.id)) notes.unshift(n);
    return { notes, rev: d.rev + 1 };
  });
}

function ensureFolder(s: Session) {
  if (s.share.kind !== 'folder') return;
  const st = useData.getState();
  const meta = metaMap(s.doc);
  const f = st.folders.find((x) => x.id === s.share.targetId);
  const name = (meta.get('name') as string) || s.share.name;
  if (!f)
    useData.setState((d) => ({
      folders: [...d.folders, { id: s.share.targetId, name, icon: (meta.get('icon') as string) || 'Users', color: (meta.get('color') as string) || '#8b5cf6', updated: Date.now() }],
      rev: d.rev + 1,
    }));
  else if (!s.share.owner && meta.get('name') && f.name !== name) st.updateFolder(f.id, { name });
}

function setPresence(id: string, patch: Partial<Presence>) {
  useCollab.setState((p) => ({ ...p, [id]: { ...{ status: 'connecting' as const, peers: [] }, ...p[id], ...patch } }));
}

async function startSession(sh: Share) {
  const doc = new Y.Doc();
  const s: Session = { share: sh, doc, snap: new Map(), transports: [], peers: new Map() };
  sessions.set(sh.id, s);
  setPresence(sh.id, { status: 'connecting', peers: [] });
  if (sh.state) {
    try {
      Y.applyUpdate(doc, fromB64(sh.state), INIT);
    } catch (e) {
      console.warn('estado colaborativo inválido', e);
    }
  }
  // o que já está no documento e ainda não chegou às notas (ex.: quem entrou pelo link)
  ensureFolder(s);
  applyRemote(s, notesMap(doc).keys());
  pushLocal(s);

  notesMap(doc).observeDeep((events, tr) => {
    if (tr.origin !== REMOTE) return;
    applyRemote(s, changedNoteIds(events, doc));
  });
  metaMap(doc).observe((_e, tr) => tr.origin === REMOTE && ensureFolder(s));
  doc.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE && origin !== INIT) s.transports.forEach((t) => t.send(u));
    clearTimeout(s.saveTimer);
    s.saveTimer = setTimeout(() => {
      if (sessions.get(sh.id) === s) useData.getState().patchShare(sh.id, { state: toB64(Y.encodeStateAsUpdate(doc)) });
    }, 1500);
  });

  const handlers = (kind: 'p2p' | 'relay'): Handlers => ({
    me: { id: clientId, name: myName() },
    stateVector: () => Y.encodeStateVector(doc),
    diffFor: (sv) => Y.encodeStateAsUpdate(doc, sv),
    full: () => Y.encodeStateAsUpdate(doc),
    onUpdate: (u) => {
      try {
        Y.applyUpdate(doc, u, REMOTE);
      } catch (e) {
        console.warn('alteração colaborativa inválida', e);
      }
    },
    onPeers: (list) => {
      s.peers.set(kind, list);
      // P2P sabe quem é cada um; o servidor só sabe quantos: junta sem contar a mesma pessoa duas vezes
      const named = s.peers.get('p2p') ?? [];
      const viaRelay = (s.peers.get('relay') ?? []).length;
      const all = [...named];
      for (let i = all.length; i < viaRelay; i++) all.push({ id: 'relay-' + i, name: '' });
      setPresence(sh.id, { peers: all });
    },
    onStatus: (st) => (kind === 'relay' ? setPresence(sh.id, { relay: st }) : setPresence(sh.id, { status: st === 'error' ? 'offline' : st })),
  });
  try {
    s.transports.push(await p2pTransport(sh.id, sh.secret, handlers('p2p')));
  } catch (e) {
    console.warn('P2P indisponível', e);
    setPresence(sh.id, { status: 'error' });
  }
  if (sh.mode === 'relay' && sh.relayUrl) {
    try {
      s.transports.push(await relayTransport(sh.relayUrl, sh.id, sh.secret, handlers('relay')));
    } catch (e) {
      console.warn('servidor de sincronização indisponível', e);
      setPresence(sh.id, { relay: 'error' });
    }
  }
}

function stopSession(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  clearTimeout(s.saveTimer);
  s.transports.forEach((t) => t.stop());
  s.doc.destroy();
  useCollab.setState((p) => {
    const n = { ...p };
    delete n[id];
    return n;
  });
}

function reconcile() {
  const shares = useData.getState().shares.filter((x) => !x.deleted);
  const want = new Set(shares.map((x) => x.id));
  for (const id of [...sessions.keys()]) if (!want.has(id)) stopSession(id);
  for (const sh of shares) {
    const s = sessions.get(sh.id);
    if (!s) void startSession(sh);
    else {
      // modo ou servidor mudou: reinicia
      if (s.share.mode !== sh.mode || s.share.relayUrl !== sh.relayUrl) {
        stopSession(sh.id);
        void startSession(sh);
      } else s.share = sh;
    }
  }
}

let started = false;
export function startCollab() {
  if (started) return;
  started = true;
  reconcile();
  useData.subscribe((st, prev) => {
    if (st.shares !== prev.shares) reconcile();
    if (st.notes !== prev.notes || st.folders !== prev.folders) for (const s of sessions.values()) pushLocal(s);
  });
  window.addEventListener('beforeunload', () => {
    for (const s of sessions.values()) {
      clearTimeout(s.saveTimer);
      useData.getState().patchShare(s.share.id, { state: toB64(Y.encodeStateAsUpdate(s.doc)) });
    }
  });
}

// ------------------------------------------------------------------ criar e entrar

const WEB = 'https://cliqueprojeto.github.io/GCP-Calc/';
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function roomIdFor(secret: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gcp-calc-room:' + secret)));
  return [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Invite {
  v: 1;
  s: string;
  k: Share['kind'];
  t: string;
  n: string;
  m: Share['mode'];
  r?: string;
}

export function inviteLink(sh: Share): string {
  const inv: Invite = { v: 1, s: sh.secret, k: sh.kind, t: sh.targetId, n: sh.name, m: sh.mode, ...(sh.relayUrl ? { r: sh.relayUrl } : {}) };
  return WEB + '#join=' + b64url(new TextEncoder().encode(JSON.stringify(inv)));
}

export function parseInvite(text: string): Invite | null {
  const m = text.trim().match(/join=([A-Za-z0-9_-]+)/) ?? text.trim().match(/^([A-Za-z0-9_-]{40,})$/);
  if (!m) return null;
  try {
    const raw = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const inv = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)))) as Invite;
    return inv?.v === 1 && inv.s && inv.t && (inv.k === 'note' || inv.k === 'folder') ? inv : null;
  } catch {
    return null;
  }
}

/** Começa a compartilhar uma nota ou pasta e devolve o link. */
export async function createShare(kind: Share['kind'], targetId: string, name: string, mode: Share['mode'], relayUrl?: string): Promise<Share> {
  const secret = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const sh: Share = { id: await roomIdFor(secret), kind, targetId, name, secret, mode, relayUrl: mode === 'relay' ? relayUrl : undefined, owner: true, created: Date.now(), updated: Date.now() };
  useData.getState().saveShare(sh);
  return sh;
}

/** Entra num compartilhamento pelo link recebido. */
export async function joinShare(inv: Invite): Promise<Share> {
  const id = await roomIdFor(inv.s);
  const existing = useData.getState().shares.find((x) => x.id === id && !x.deleted);
  if (existing) return existing;
  const sh: Share = { id, kind: inv.k, targetId: inv.t, name: inv.n, secret: inv.s, mode: inv.m, relayUrl: inv.r, owner: false, created: Date.now(), updated: Date.now() };
  if (inv.k === 'folder' && !useData.getState().folders.some((f) => f.id === inv.t))
    useData.setState((d) => ({ folders: [...d.folders, { id: inv.t, name: inv.n, icon: 'Users', color: '#8b5cf6', updated: Date.now() }], rev: d.rev + 1 }));
  useData.getState().saveShare(sh);
  return sh;
}

/** Para de compartilhar (as notas continuam no aparelho, só deixam de sincronizar). */
export function stopShare(id: string) {
  useData.getState().patchShare(id, { deleted: Date.now(), state: undefined });
}

export const shareFor = (noteId: string, folderId?: string) =>
  useData.getState().shares.find((x) => !x.deleted && ((x.kind === 'note' && x.targetId === noteId) || (x.kind === 'folder' && folderId && x.targetId === folderId)));
