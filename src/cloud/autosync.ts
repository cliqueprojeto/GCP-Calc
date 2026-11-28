/**
 * Sincronização automática: mantém os aparelhos conectados à mesma conta espelhados.
 * - Ao abrir o app, ao voltar para ele e ao reconectar: busca novidades.
 * - Depois de cada alteração local: envia no intervalo escolhido.
 * - Enquanto o app está aberto: confere a nuvem periodicamente (só metadados).
 * - Ao sair/fechar: envia o que estiver pendente.
 */
import { create } from 'zustand';
import { useData } from '../store/data';
import { syncNow } from './cloud';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error' | 'offline' | 'wrong-pass' | 'need-pass';

interface SyncState {
  status: SyncStatus;
  error?: string;
  lastAt?: number;
  pending: boolean;
}

export const useSync = create<SyncState>(() => ({ status: 'off', pending: false }));

export const SYNC_DELAYS = [5, 30, 60, 300, 900, 0] as const;

let known: number | undefined;
let syncedRev = -1;
let running: Promise<void> | null = null;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function enabled() {
  const c = useData.getState().settings.cloud;
  return c.autoSync && c.accounts.length > 0 && !!c.passphrase;
}

export function syncSoon(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function runOnce() {
  if (!enabled()) {
    const c = useData.getState().settings.cloud;
    // conectado ao Drive, mas sem a frase-senha: não dá para cifrar, então avisa
    useSync.setState({ status: c.accounts.length > 0 && !c.passphrase ? 'need-pass' : 'off' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSync.setState({ status: 'offline' });
    return;
  }
  const rev = useData.getState().rev;
  useSync.setState({ status: 'syncing' });
  try {
    const r = await syncNow({ known, localChanged: rev !== syncedRev });
    known = r.remoteModified;
    syncedRev = useData.getState().rev === rev ? rev : syncedRev;
    if (r.pulled) syncedRev = useData.getState().rev;
    useSync.setState({ status: 'ok', lastAt: Date.now(), error: undefined, pending: useData.getState().rev !== syncedRev });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    useSync.setState({ status: msg.includes('wrong-passphrase') ? 'wrong-pass' : 'error', error: msg });
  }
}

function schedulePush() {
  if (!enabled()) return;
  useSync.setState({ pending: true });
  const delay = (useData.getState().settings.cloud.syncDelay ?? 30) * 1000;
  if (delay === 0) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncSoon(), delay);
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  syncSoon();
  useData.subscribe((s, p) => {
    if (s.rev !== p.rev) schedulePush();
    if (s.settings.cloud !== p.settings.cloud && (['off', 'need-pass'].includes(useSync.getState().status) || !enabled())) syncSoon();
  });
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (enabled() && document.visibilityState === 'visible') syncSoon();
  }, 60_000);
  window.addEventListener('online', () => syncSoon());
  document.addEventListener('visibilitychange', () => {
    if (!enabled()) return;
    if (document.visibilityState === 'hidden' && useSync.getState().pending) syncSoon();
    if (document.visibilityState === 'visible') syncSoon();
  });
}

export function hasPendingSync() {
  return enabled() && useData.getState().rev !== syncedRev;
}
