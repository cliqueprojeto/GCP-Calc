/**
 * Dados do usuário: notas, pastas, tags de moeda e configurações.
 * Gravados no disco (app) ou no localStorage (navegador), com escrita adiada.
 */
import { create } from 'zustand';
import { loadDoc, saveDoc, uid } from '../lib/platform';
import type { Block, DataDoc, Folder, Note, Settings, Tag } from '../lib/types';
import { welcomeNotes } from '../notes/welcome';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'auto',
  theme: 'nebula',
  customTheme: { dark: true, bg: '#0e0f1f', panel: '#171933', text: '#eef0ff', accent: '#8b5cf6', accent2: '#22d3ee' },
  synColors: {},
  font: 'jetbrains',
  fontSize: 16,
  decimal: 'auto',
  grouping: true,
  precision: 6,
  currencyPosition: 'auto',
  dollar: 'USD',
  baseCurrency: 'BRL',
  favoriteCurrencies: ['USD', 'EUR', 'GBP', 'BTC'],
  angle: 'deg',
  dateOrder: 'auto',
  ratesOnOpen: true,
  ratesMaxAge: 6,
  lineNumbers: false,
  keypad: 'auto',
  resultColors: true,
  ai: { providers: [], inline: true },
  cloud: { accounts: [], autoSync: true, syncDelay: 30, autoBackup: 'daily', keep: 10 },
  updateFrequency: 'startup',
  lastUpdateCheck: 0,
};

interface DataState {
  loaded: boolean;
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  settings: Settings;
  /** contador de alterações locais (para a sincronização) */
  rev: number;
  load(): Promise<void>;
  createNote(p?: Partial<Note>): string;
  updateNote(id: string, fn: (n: Note) => Note | void): void;
  updateBlock(noteId: string, blockId: string, patch: Partial<Block>): void;
  trashNote(id: string): void;
  restoreNote(id: string): void;
  purgeNote(id: string): void;
  duplicateNote(id: string): string | undefined;
  createFolder(name: string): string;
  updateFolder(id: string, patch: Partial<Folder>): void;
  deleteFolder(id: string): void;
  upsertTag(t: Omit<Tag, 'updated'>): void;
  deleteTag(id: string): void;
  setSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)): void;
  exportDoc(): DataDoc;
  importDoc(doc: DataDoc, mode: 'merge' | 'replace'): void;
  /** Junta dados vindos da nuvem: o mais recente vence. */
  mergeRemote(doc: DataDoc): { pulled: number; ahead: boolean };
}

const now = () => Date.now();

function mergeLists<T extends { id: string; updated: number; deleted?: number }>(local: T[], remote: T[]) {
  const map = new Map(local.map((x) => [x.id, x]));
  let pulled = 0;
  let ahead = false;
  const seen = new Set<string>();
  for (const r of remote) {
    seen.add(r.id);
    const l = map.get(r.id);
    const rt = Math.max(r.updated, r.deleted ?? 0);
    const lt = l ? Math.max(l.updated, l.deleted ?? 0) : -1;
    if (!l || rt > lt) {
      map.set(r.id, r);
      pulled++;
    } else if (lt > rt) ahead = true;
  }
  for (const id of map.keys()) if (!seen.has(id)) ahead = true;
  return { list: [...map.values()], pulled, ahead };
}

export const useData = create<DataState>((set, get) => ({
  loaded: false,
  notes: [],
  folders: [],
  tags: [],
  settings: DEFAULT_SETTINGS,
  rev: 0,

  async load() {
    const [doc, settings] = await Promise.all([loadDoc<DataDoc>('data'), loadDoc<Settings>('settings')]);
    const s: Settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    s.ai = { ...DEFAULT_SETTINGS.ai, ...(settings?.ai || {}) };
    s.cloud = { ...DEFAULT_SETTINGS.cloud, ...(settings?.cloud || {}) };
    s.customTheme = { ...DEFAULT_SETTINGS.customTheme, ...(settings?.customTheme || {}) };
    const notes = doc?.notes ?? welcomeNotes(s.lang);
    // o que está na lixeira há mais de 30 dias é esvaziado (fica só a marca de exclusão)
    const cutoff = now() - 30 * 86400_000;
    set({
      loaded: true,
      notes: notes.map((n) => (n.deleted && n.deleted < cutoff && !n.purged ? { ...n, blocks: [], title: '', purged: true } : n)),
      folders: doc?.folders ?? [],
      tags: doc?.tags ?? [],
      settings: s,
    });
    if (!doc) persistData();
  },

  createNote(p = {}) {
    const id = uid();
    const t = now();
    const note: Note = {
      id,
      title: '',
      icon: 'Calculator',
      color: '#8b5cf6',
      created: t,
      updated: t,
      blocks: [{ id: uid(), type: 'calc', text: '' }],
      ...p,
    };
    set((s) => ({ notes: [note, ...s.notes], rev: s.rev + 1 }));
    return id;
  },

  updateNote(id, fn) {
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== id) return n;
        const copy = structuredClone(n);
        const r = fn(copy) ?? copy;
        r.updated = now();
        return r;
      }),
      rev: s.rev + 1,
    }));
  },

  updateBlock(noteId, blockId, patch) {
    get().updateNote(noteId, (n) => {
      n.blocks = n.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b));
    });
  },

  trashNote(id) {
    get().updateNote(id, (n) => {
      n.deleted = now();
    });
  },
  restoreNote(id) {
    get().updateNote(id, (n) => {
      delete n.deleted;
    });
  },
  purgeNote(id) {
    // mantém uma marca mínima para a exclusão chegar aos outros aparelhos
    get().updateNote(id, (n) => ({ ...n, blocks: [], title: '', deleted: n.deleted ?? now(), purged: true }) as Note);
  },
  duplicateNote(id) {
    const n = get().notes.find((x) => x.id === id);
    if (!n) return;
    const copy = structuredClone(n);
    return get().createNote({ ...copy, id: uid(), title: n.title + ' (2)', pinned: false, blocks: copy.blocks.map((b) => ({ ...b, id: uid() })) });
  },

  createFolder(name) {
    const id = uid();
    set((s) => ({ folders: [...s.folders, { id, name, icon: 'Folder', color: '#22d3ee', updated: now() }], rev: s.rev + 1 }));
    return id;
  },
  updateFolder(id, patch) {
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch, updated: now() } : f)), rev: s.rev + 1 }));
  },
  deleteFolder(id) {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, deleted: now(), updated: now() } : f)),
      notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: undefined, updated: now() } : n)),
      rev: s.rev + 1,
    }));
  },

  upsertTag(t) {
    set((s) => {
      const exists = s.tags.some((x) => x.id === t.id);
      const tag: Tag = { ...t, updated: now() };
      return { tags: exists ? s.tags.map((x) => (x.id === t.id ? tag : x)) : [...s.tags, tag], rev: s.rev + 1 };
    });
  },
  deleteTag(id) {
    set((s) => ({ tags: s.tags.map((x) => (x.id === id ? { ...x, deleted: now(), updated: now() } : x)), rev: s.rev + 1 }));
  },

  setSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...(typeof patch === 'function' ? patch(s.settings) : patch) } }));
  },

  exportDoc() {
    const { notes, folders, tags } = get();
    return { version: 1, notes, folders, tags };
  },

  importDoc(doc, mode) {
    if (mode === 'replace') set((s) => ({ notes: doc.notes, folders: doc.folders, tags: doc.tags, rev: s.rev + 1 }));
    else get().mergeRemote(doc);
  },

  mergeRemote(doc) {
    const s = get();
    const n = mergeLists(s.notes, doc.notes || []);
    const f = mergeLists(s.folders, doc.folders || []);
    const t = mergeLists(s.tags, doc.tags || []);
    const pulled = n.pulled + f.pulled + t.pulled;
    if (pulled) set({ notes: n.list.sort((a, b) => b.updated - a.updated), folders: f.list, tags: t.list });
    return { pulled, ahead: n.ahead || f.ahead || t.ahead };
  },
}));

// ------------------------------------------------------------ persistência

let dataTimer: ReturnType<typeof setTimeout> | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | null = null;

function persistData() {
  const s = useData.getState();
  return saveDoc('data', s.exportDoc()).catch((e) => console.error('falha ao salvar', e));
}

export function flushSave() {
  if (dataTimer) clearTimeout(dataTimer);
  if (settingsTimer) clearTimeout(settingsTimer);
  dataTimer = settingsTimer = null;
  return Promise.all([persistData(), saveDoc('settings', useData.getState().settings)]);
}

useData.subscribe((s, prev) => {
  if (!s.loaded) return;
  if (s.notes !== prev.notes || s.folders !== prev.folders || s.tags !== prev.tags) {
    if (dataTimer) clearTimeout(dataTimer);
    dataTimer = setTimeout(persistData, 400);
  }
  if (s.settings !== prev.settings) {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => saveDoc('settings', useData.getState().settings).catch(console.error), 300);
  }
});

/** Tags ativas (sem as excluídas). */
export const activeTags = (tags: Tag[]) => tags.filter((t) => !t.deleted);
export const visibleNotes = (notes: Note[]) => notes.filter((n) => !n.deleted);
