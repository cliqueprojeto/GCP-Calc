import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { noteFromY, writeNoteToY, shareKey, applyTextDiff } from '../src/collab/doc';
import type { Note } from '../src/lib/types';

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1', title: 'Orçamento', icon: 'Wallet', color: '#10b981', created: 1, updated: 1,
  blocks: [{ id: 'b1', type: 'calc', text: '#Despesas\nAluguel: R$ 1.000\nTotal #Despesas' } as never, { id: 'b2', type: 'heading', text: 'Resumo' } as never],
  ...over,
});
const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};

describe('colaboração (documento compartilhado)', () => {
  it('dois aparelhos editando ao mesmo tempo convergem sem perder nada', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    writeNoteToY(a, note());
    sync(a, b);
    expect(shareKey(noteFromY(b, 'n1') as Note)).toBe(shareKey(note()));
    // A acrescenta uma despesa; B acrescenta outra na MESMA seção e muda o título — sem estarem conectados
    const na = note();
    (na.blocks[0] as { text: string }).text = '#Despesas\nAluguel: R$ 1.000\nLuz: R$ 150\nTotal #Despesas';
    writeNoteToY(a, na);
    const nb = note({ title: 'Orçamento da casa' });
    (nb.blocks[0] as { text: string }).text = '#Despesas\nAluguel: R$ 1.000\nMercado: R$ 600\nTotal #Despesas';
    writeNoteToY(b, nb);
    sync(a, b);
    const ra = noteFromY(a, 'n1')!;
    const rb = noteFromY(b, 'n1')!;
    expect(shareKey(ra as Note)).toBe(shareKey(rb as Note));
    const txt = (ra.blocks[0] as { text: string }).text;
    expect(txt).toContain('Luz: R$ 150');
    expect(txt).toContain('Mercado: R$ 600');
    expect(txt.startsWith('#Despesas\nAluguel: R$ 1.000\n')).toBe(true);
    expect(txt.endsWith('Total #Despesas')).toBe(true);
    expect(ra.title).toBe('Orçamento da casa');
  });
  it('blocos novos, removidos e reordenados', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    writeNoteToY(a, note());
    sync(a, b);
    const n = note();
    n.blocks = [n.blocks[1], { id: 'b3', type: 'divider' } as never, n.blocks[0]];
    writeNoteToY(a, n);
    sync(a, b);
    expect(noteFromY(b, 'n1')!.blocks.map((x) => x.id)).toEqual(['b2', 'b3', 'b1']);
    n.blocks = n.blocks.filter((x) => x.id !== 'b3');
    writeNoteToY(b, n);
    sync(a, b);
    expect(noteFromY(a, 'n1')!.blocks.map((x) => x.id)).toEqual(['b2', 'b1']);
  });
  it('diferença de texto não corta emojis', () => {
    const d = new Y.Doc();
    const t = d.getText('t');
    t.insert(0, 'Mercado 🛒: R$ 10');
    applyTextDiff(t, 'Mercado 🛍️: R$ 10');
    expect(t.toString()).toBe('Mercado 🛍️: R$ 10');
    applyTextDiff(t, '🇧🇷 Mercado 🛍️: R$ 12');
    expect(t.toString()).toBe('🇧🇷 Mercado 🛍️: R$ 12');
  });
});
