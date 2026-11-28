/**
 * Colaboração em tempo real: as notas compartilhadas vivem num documento Yjs (CRDT), que junta
 * edições simultâneas sem conflito. Aqui fica a ponte entre o documento e as notas do app:
 *
 *   raiz "notes": Y.Map<idDaNota, Y.Map>
 *     title, icon, color, updated, deleted
 *     blocks: Y.Array<Y.Map>   — cada bloco: id, type, json (demais campos) e txt (Y.Text)
 *   raiz "meta":  Y.Map        — nome, ícone e cor da pasta compartilhada
 *
 * O texto dos blocos de cálculo e de código é Y.Text: duas pessoas digitando na mesma linha
 * mesclam caractere a caractere.
 */
import * as Y from 'yjs';
import type { Block, Note } from '../lib/types';

/** campo de texto principal de cada tipo de bloco (mesclado caractere a caractere) */
const TEXT_FIELD: Partial<Record<Block['type'], string>> = { calc: 'text', code: 'code', heading: 'text', callout: 'text' };

export const LOCAL = 'gcp-local';

export function notesMap(doc: Y.Doc) {
  return doc.getMap<Y.Map<unknown>>('notes');
}
export function metaMap(doc: Y.Doc) {
  return doc.getMap<unknown>('meta');
}

function splitBlock(b: Block): { id: string; type: string; txt?: string; json: string } {
  const f = TEXT_FIELD[b.type];
  const rest: Record<string, unknown> = { ...(b as unknown as Record<string, unknown>) };
  let txt: string | undefined;
  if (f && typeof rest[f] === 'string') {
    txt = rest[f] as string;
    delete rest[f];
  }
  delete rest.id;
  delete rest.type;
  return { id: b.id, type: b.type, txt, json: JSON.stringify(rest) };
}

function blockFromY(m: Y.Map<unknown>): Block | null {
  const id = m.get('id') as string;
  const type = m.get('type') as Block['type'];
  if (!id || !type) return null;
  let rest: Record<string, unknown> = {};
  try {
    rest = JSON.parse((m.get('json') as string) || '{}');
  } catch {
    /* bloco corrompido: fica só com id e tipo */
  }
  const f = TEXT_FIELD[type];
  const t = m.get('txt');
  if (f && t instanceof Y.Text) rest[f] = t.toString();
  return { ...rest, id, type } as unknown as Block;
}

/** Nota como está no documento compartilhado (ou null se ainda não chegou). */
export function noteFromY(doc: Y.Doc, id: string): Omit<Note, 'folderId' | 'pinned' | 'created'> | null {
  const m = notesMap(doc).get(id);
  if (!m) return null;
  const arr = m.get('blocks');
  const blocks = arr instanceof Y.Array ? (arr.toArray() as Y.Map<unknown>[]).map(blockFromY).filter((b): b is Block => !!b) : [];
  return {
    id,
    title: (m.get('title') as string) ?? '',
    icon: (m.get('icon') as string) ?? 'Calculator',
    color: (m.get('color') as string) ?? '#8b5cf6',
    updated: (m.get('updated') as number) ?? 0,
    deleted: (m.get('deleted') as number) || undefined,
    blocks,
  };
}

/** O que importa comparar entre a nota local e a do documento. */
export function shareKey(n: Pick<Note, 'title' | 'icon' | 'color' | 'deleted' | 'blocks'>): string {
  return stable([n.title, n.icon, n.color, n.deleted ?? 0, n.blocks]);
}

/** JSON com as chaves em ordem: a mesma nota dá sempre o mesmo texto */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}

/** Troca o conteúdo de um Y.Text pelo novo texto, mexendo só no trecho que mudou. */
export function applyTextDiff(t: Y.Text, next: string) {
  const prev = t.toString();
  if (prev === next) return;
  let a = 0;
  const max = Math.min(prev.length, next.length);
  while (a < max && prev.charCodeAt(a) === next.charCodeAt(a)) a++;
  let b = 0;
  while (b < max - a && prev.charCodeAt(prev.length - 1 - b) === next.charCodeAt(next.length - 1 - b)) b++;
  // não corta um par de surrogates (emoji) ao meio
  if (a > 0 && /[\uD800-\uDBFF]/.test(prev[a - 1])) a--;
  if (b > 0 && /[\uDC00-\uDFFF]/.test(prev[prev.length - b])) b--;
  const del = prev.length - a - b;
  if (del > 0) t.delete(a, del);
  const ins = next.slice(a, next.length - b);
  if (ins) t.insert(a, ins);
}

function newBlockMap(b: Block): Y.Map<unknown> {
  const s = splitBlock(b);
  const m = new Y.Map<unknown>();
  m.set('id', s.id);
  m.set('type', s.type);
  m.set('json', s.json);
  if (s.txt !== undefined) m.set('txt', new Y.Text(s.txt));
  return m;
}

/** Leva a nota local para o documento (só as diferenças), numa transação marcada como local. */
export function writeNoteToY(doc: Y.Doc, n: Note) {
  doc.transact(() => {
    const notes = notesMap(doc);
    let m = notes.get(n.id);
    if (!m) {
      m = new Y.Map<unknown>();
      notes.set(n.id, m);
    }
    const set = (k: string, v: unknown) => m!.get(k) !== v && m!.set(k, v);
    set('title', n.title);
    set('icon', n.icon);
    set('color', n.color);
    set('updated', n.updated);
    set('deleted', n.deleted ?? 0);
    let arr = m.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!(arr instanceof Y.Array)) {
      arr = new Y.Array<Y.Map<unknown>>();
      m.set('blocks', arr);
    }
    // 1) tira blocos que não existem mais
    const want = new Set(n.blocks.map((b) => b.id));
    for (let i = arr.length - 1; i >= 0; i--) if (!want.has(arr.get(i).get('id') as string)) arr.delete(i, 1);
    // 2) ordem e conteúdo
    n.blocks.forEach((b, i) => {
      const cur = i < arr!.length ? arr!.get(i) : undefined;
      if (!cur || cur.get('id') !== b.id) {
        // bloco novo ou mudou de lugar: se já existe em outra posição, remove de lá
        for (let j = i + 1; j < arr!.length; j++) {
          if (arr!.get(j).get('id') === b.id) {
            arr!.delete(j, 1);
            break;
          }
        }
        arr!.insert(i, [newBlockMap(b)]);
        return;
      }
      const s = splitBlock(b);
      if (cur.get('type') !== s.type) cur.set('type', s.type);
      if (cur.get('json') !== s.json) cur.set('json', s.json);
      if (s.txt !== undefined) {
        let t = cur.get('txt');
        if (!(t instanceof Y.Text)) {
          t = new Y.Text();
          cur.set('txt', t);
        }
        applyTextDiff(t as Y.Text, s.txt);
      }
    });
  }, LOCAL);
}

/** Notas que uma transação remota alterou. */
export function changedNoteIds(events: Y.YEvent<Y.AbstractType<unknown>>[], doc: Y.Doc): Set<string> {
  const ids = new Set<string>();
  const root = notesMap(doc);
  for (const e of events) {
    if (e.target === root) {
      (e as Y.YMapEvent<unknown>).keysChanged.forEach((k) => ids.add(k));
      continue;
    }
    const first = e.path[0];
    if (typeof first === 'string') ids.add(first);
  }
  return ids;
}

export const toB64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
