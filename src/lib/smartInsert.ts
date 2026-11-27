/**
 * Inserção inteligente: itens novos (ditado, IA) vão para a seção que já existe no bloco —
 * despesas na última linha de #Despesas, receitas na de #Receitas —, antes do "total" e sem
 * criar seção repetida. O que não tiver seção correspondente vai para o fim.
 */
import type { LineResult } from '../engine/evaluate';
import { classifyTerm, type Kind } from '../engine/vocab';

export interface Incoming {
  line: string;
  tone?: Kind;
  /** fórmula pedida (total, saldo, média…): vai para o fim do bloco */
  formula?: boolean;
}

interface Sec {
  tone: Kind;
  name: string;
  /** índice da linha depois da qual entram os itens novos */
  after: number;
}

const AGG_LINE = /^\s*(total|subtotal|soma|saldo|sobra|resultado|balance|left|sum|average|média|media|promedio)\b/i;

/** linha comparável: sem emojis, maiúsculas, espaços extras, separador de milhar e ",00" */
export function normLine(l: string): string {
  return l
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3\p{Emoji_Modifier}]/gu, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)[.,](?=\d{3}(?!\d))/g, '$1')
    .replace(/[.,]00(?!\d)/g, '')
    .replace(/\s*([:=*+\-|])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function insertIntoSections(text: string, results: LineResult[], incoming: Incoming[]): { text: string; placed: { name: string; n: number }[]; skipped: number } {
  const lines = text.split('\n');
  // o que já está no bloco não entra de novo (a IA às vezes devolve a nota inteira)
  const existing = new Set(lines.map(normLine).filter(Boolean));
  let skipped = 0;
  incoming = incoming.filter((it) => {
    const k = normLine(it.line);
    if (!k || /^#/.test(k) || it.formula && !existing.has(k)) return true;
    if (existing.has(k)) {
      if (!AGG_LINE.test(it.line) && !k.includes('#')) skipped++;
      return false;
    }
    existing.add(k);
    return true;
  });
  const secs: Sec[] = [];
  let cur: Sec | null = null;
  lines.forEach((l, i) => {
    const r = results[i];
    if (r?.kind === 'header') {
      cur = r.section && r.tone ? { tone: r.tone, name: r.section, after: i } : null;
      if (cur) secs.push(cur);
      return;
    }
    if (!cur) return;
    // item da seção (com valor, sem ser total/saldo)
    if ((r?.kind === 'value' && !r.aggregate) || (r?.kind === 'error' && !AGG_LINE.test(l))) cur.after = i;
  });
  const has = (k: Kind) => secs.find((s) => s.tone === k);

  // limpa o que veio: títulos e totais que já existem no bloco saem; itens herdam o tipo do título
  const items: Incoming[] = [];
  let headerTone: Kind | undefined;
  for (const it of incoming) {
    const l = it.line;
    if (!l.trim()) continue;
    if (it.formula) {
      items.push({ line: l, formula: true });
      continue;
    }
    const head = l.match(/^\s*#+\s*([^\n]*)$/);
    if (head) {
      headerTone = classifyTerm(head[1]);
      if (headerTone && has(headerTone)) continue;
      items.push({ line: l });
      continue;
    }
    // totais que vêm junto com um título repetido (a IA refez a seção) saem; fórmulas soltas ficam
    if (secs.length && headerTone && has(headerTone) && AGG_LINE.test(l)) continue;
    items.push({ line: l, tone: it.tone ?? headerTone ?? classifyTerm(l) });
  }

  const bySec = new Map<Sec, string[]>();
  const rest: string[] = [];
  for (const it of items) {
    const s = it.tone && !it.formula ? has(it.tone) : undefined;
    if (s) bySec.set(s, [...(bySec.get(s) ?? []), it.line]);
    else rest.push(it.line);
  }
  // insere de baixo para cima para os índices continuarem valendo
  const order = [...bySec.entries()].sort((a, b) => b[0].after - a[0].after);
  for (const [s, add] of order) lines.splice(s.after + 1, 0, ...add);
  let out = lines.join('\n');
  if (rest.length) out = out.replace(/\s+$/, '') + (out.trim() ? '\n' : '') + rest.join('\n');
  return { text: out, placed: [...bySec.entries()].map(([s, a]) => ({ name: s.name, n: a.length })), skipped };
}
