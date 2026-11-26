/**
 * Relatórios comparativos (BI) entre notas: junta, linha a linha, as seções (#Receitas,
 * #Despesas…) e os lançamentos com o mesmo nome em várias notas — por exemplo o orçamento
 * do mês passado e o deste mês — e calcula a variação absoluta e percentual.
 */
import { aggregateValues, sectionTone, sectionValues, type Tone } from '../engine/evaluate';
import { fold } from '../engine/units';
import { add, type EvalContext, type FormatOptions, type Value } from '../engine/value';
import { evaluateNote, type Evaluated } from './noteEval';
import type { Note } from './types';

export interface Figure {
  key: string;
  label: string;
  /** total de seção (#Receitas) ou resultado (saldo) */
  kind: 'section' | 'item' | 'summary';
  tone?: Tone;
  value: Value;
}

export interface CompareRow {
  key: string;
  label: string;
  kind: Figure['kind'];
  tone?: Tone;
  values: (Value | undefined)[];
  delta?: Value;
  /** variação relativa (0,2 = +20%) */
  pct?: number;
}

/** Números de uma nota: totais das seções, lançamentos e resultados com rótulo. */
export function noteFigures(note: Note, ctx: EvalContext, fmt: FormatOptions, ev?: Evaluated): Figure[] {
  const e = ev ?? evaluateNote(note, ctx, fmt);
  const out: Figure[] = [];
  const seen = new Set<string>();
  const push = (f: Figure) => {
    if (seen.has(f.kind + f.key)) return;
    seen.add(f.kind + f.key);
    out.push(f);
  };
  for (const sec of e.final.sections.values()) {
    if (!sec.values.length) continue;
    try {
      push({ key: fold(sec.name), label: sec.name, kind: 'section', tone: sectionTone(sec.name, sec.values), value: aggregateValues(sectionValues(sec), 'sum', ctx) });
    } catch {
      /* seção com valores incompatíveis */
    }
  }
  for (const b of note.blocks) {
    if (b.type !== 'calc') continue;
    for (const r of e.perBlock.get(b.id)?.results ?? []) {
      if (r.kind !== 'value' || !r.value || r.value.date) continue;
      let label = r.label ?? (r.assigned ? r.assigned : undefined);
      if (!label) continue;
      // "Total #Receitas" já aparece como seção; "#Receitas - #Despesas" vira um resultado
      label = label.replace(/^(total|subtotal|soma|sum)\s+/i, '');
      if (/^#[\p{L}\p{N}_]+$/u.test(label)) continue;
      // "Sobra %" é outra linha que "Sobra"
      if (r.value.pct) label += ' %';
      push({ key: fold(label), label, kind: r.aggregate ? 'summary' : 'item', tone: r.tone, value: r.value });
    }
  }
  return out;
}

export function compareRows(figs: Figure[][], ctx: EvalContext, only: 'all' | 'sections' = 'all'): CompareRow[] {
  const rows = new Map<string, CompareRow>();
  // ordem: a da nota mais recente (última coluna), depois o que só existe nas anteriores
  const order = [...figs].reverse();
  for (const list of order)
    for (const f of list) {
      const id = f.kind + f.key;
      if (!rows.has(id)) rows.set(id, { key: f.key, label: f.label, kind: f.kind, tone: f.tone, values: figs.map(() => undefined) });
    }
  figs.forEach((list, col) => {
    for (const f of list) rows.get(f.kind + f.key)!.values[col] = f.value;
  });
  const rank = { section: 0, summary: 2, item: 1 } as const;
  const out = [...rows.values()]
    .filter((r) => only === 'all' || r.kind !== 'item')
    .sort((a, b) => rank[a.kind] - rank[b.kind]);
  for (const r of out) {
    const first = r.values.find((v) => v);
    const last = [...r.values].reverse().find((v) => v);
    if (!first || !last || first === last || r.values.filter(Boolean).length < 2) continue;
    try {
      r.delta = add(last, first, -1, ctx);
      if (first.n) r.pct = r.delta.n / Math.abs(first.n);
    } catch {
      /* dimensões diferentes */
    }
  }
  return out;
}

/** Variação boa (verde) ou ruim (vermelho): despesas subindo é ruim; receitas subindo é bom. */
export function deltaTone(r: CompareRow): Tone | undefined {
  if (!r.delta || !r.delta.n) return undefined;
  const first = r.values.find(Boolean)!;
  const last = [...r.values].reverse().find(Boolean)!;
  const expense = r.tone === 'expense' || first.n < 0;
  // despesas lançadas como negativas: o que importa é o tamanho
  const grew = expense ? Math.abs(last.n) > Math.abs(first.n) : last.n > first.n;
  return grew !== expense ? 'income' : 'expense';
}
