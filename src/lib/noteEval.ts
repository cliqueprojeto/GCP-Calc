/** Avaliação de uma nota inteira (blocos de cálculo em sequência, variáveis compartilhadas). */
import { commonValues, evaluateLine, newDocState, type DocState, type LineResult } from '../engine/evaluate';
import { formatValue, type EvalContext, type FormatOptions } from '../engine/value';
import type { Block, Note } from './types';

export interface Evaluated {
  perBlock: Map<string, { results: LineResult[]; firstLine: number }>;
  progress: Map<string, { value?: LineResult; goal?: LineResult }>;
  final: DocState;
  context: string;
  hasValues: boolean;
}

export function evaluateNote(note: Note, ctx: EvalContext, fmt: FormatOptions): Evaluated {
  const st = newDocState();
  const perBlock = new Map<string, { results: LineResult[]; firstLine: number }>();
  const progress = new Map<string, { value?: LineResult; goal?: LineResult }>();
  const ctxLines: string[] = [];
  let line = 1;
  let hasValues = false;
  for (const b of note.blocks) {
    if (b.type === 'calc') {
      st.group = [];
      const results = b.text.split('\n').map((l) => evaluateLine(l, ctx, st));
      perBlock.set(b.id, { results, firstLine: line });
      b.text.split('\n').forEach((l, i) => {
        const v = results[i]?.value;
        if (v) hasValues = true;
        ctxLines.push(v ? `${l}  → ${formatValue(v, fmt)}` : l);
      });
      line += results.length;
    } else if (b.type === 'progress') {
      const probe = (expr: string) => {
        if (!expr.trim()) return undefined;
        const tmp: DocState = { ...st, vars: new Map(st.vars), lines: [...st.lines], group: [...st.group] };
        return evaluateLine(expr, ctx, tmp);
      };
      progress.set(b.id, { value: probe(b.value), goal: probe(b.goal) });
    }
  }
  return { perBlock, progress, final: st, context: ctxLines.join('\n'), hasValues };
}

/** Dados de um gráfico: linhas com rótulo do bloco de origem (ou do bloco de cálculo anterior). */
export function chartDataFor(note: Note, b: Extract<Block, { type: 'chart' }>, ev: Evaluated, ctx: EvalContext) {
  let src = note.blocks.find((x) => x.id === b.source && x.type === 'calc');
  if (!src) {
    const idx = note.blocks.indexOf(b);
    src = [...note.blocks.slice(0, idx)].reverse().find((x) => x.type === 'calc') ?? note.blocks.find((x) => x.type === 'calc');
  }
  if (!src || src.type !== 'calc') return [];
  const results = ev.perBlock.get(src.id)?.results ?? [];
  const lines = src.text.split('\n');
  const valued = results.map((r, i) => ({ r, line: lines[i] })).filter(({ r }) => r.kind === 'value' && r.value && !r.aggregate);
  // prioridade: linhas com rótulo ("Mercado: 320"); depois variáveis; depois tudo
  const labeled = valued.filter(({ r }) => r.label && !r.assigned);
  const items = (labeled.length ? labeled : valued.filter(({ r }) => r.assigned)).map(({ r, line }) => ({ label: r.label ?? r.assigned ?? line.trim().slice(0, 20), value: r.value! }));
  const fallback = items.length ? items : valued.map(({ r, line }) => ({ label: line.trim().slice(0, 20), value: r.value! }));
  return commonValues(fallback, ctx);
}
