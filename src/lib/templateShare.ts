/**
 * Compartilhar modelos entre usuários: um arquivo .gcptpl (JSON) ou um código de texto
 * ("GCPCALC1:…") que pode ser colado em mensagens. O modelo leva a nota completa —
 * blocos, gráficos, ícone, cores — e é validado ao importar.
 */
import type { Block, Note, UserTemplate } from './types';
import { uid } from './platform';

export const SHARE_PREFIX = 'GCPCALC1:';
const KINDS = new Set(['calc', 'heading', 'image', 'chart', 'divider', 'callout', 'sticker', 'progress', 'ticker', 'compare']);

export interface SharedTemplate {
  kind: 'gcp-calc-template';
  version: 1;
  title: string;
  desc: string;
  icon: string;
  color: string;
  author?: string;
  blocks: Block[];
}

/** Blocos da nota prontos para virar modelo (novos ids, gráficos religados). */
export function blocksForTemplate(blocks: Block[]): Block[] {
  const ids = new Map(blocks.map((b) => [b.id, uid()]));
  return blocks.map((b) => {
    const nb = { ...b, id: ids.get(b.id)! } as Block;
    if (nb.type === 'chart' && nb.source) nb.source = ids.get(nb.source) ?? '';
    return nb;
  });
}

export function templateFromNote(note: Note, title: string, desc: string, icon: string, color: string, author?: string): Omit<UserTemplate, 'updated'> {
  return { id: uid(), title, desc, icon, color, author, blocks: blocksForTemplate(note.blocks) };
}

export function toShared(t: UserTemplate): SharedTemplate {
  return { kind: 'gcp-calc-template', version: 1, title: t.title, desc: t.desc, icon: t.icon, color: t.color, author: t.author, blocks: t.blocks };
}

const b64encode = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64decode = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export const shareCode = (t: UserTemplate) => SHARE_PREFIX + b64encode(JSON.stringify(toShared(t)));
export const shareFile = (t: UserTemplate) => JSON.stringify(toShared(t), null, 2);

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback);

/** Lê um modelo de arquivo ou código. Lança erro se não for um modelo válido. */
export function parseShared(input: string): Omit<UserTemplate, 'updated'> {
  let raw = input.trim();
  const at = raw.indexOf(SHARE_PREFIX);
  if (at >= 0) raw = b64decode(raw.slice(at + SHARE_PREFIX.length).replace(/\s+/g, ''));
  const data = JSON.parse(raw) as Partial<SharedTemplate>;
  if (data.kind !== 'gcp-calc-template' || !Array.isArray(data.blocks)) throw new Error('invalid');
  const blocks = data.blocks.filter((b): b is Block => !!b && typeof b === 'object' && KINDS.has((b as Block).type)).slice(0, 200);
  if (!blocks.length) throw new Error('invalid');
  return {
    id: uid(),
    title: str(data.title, 80, 'Modelo'),
    desc: str(data.desc, 200),
    icon: str(data.icon, 40, 'Calculator'),
    color: /^#[0-9a-f]{3,8}$/i.test(String(data.color)) ? String(data.color) : '#8b5cf6',
    author: str(data.author, 80) || undefined,
    blocks: blocksForTemplate(blocks),
  };
}

export const fileNameFor = (t: { title: string }) =>
  (t.title || 'modelo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() + '.gcptpl';
