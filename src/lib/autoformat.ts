/**
 * Formatação automática no editor, como num editor de código:
 * - enquanto digita um valor em dinheiro, os separadores de milhar entram sozinhos
 *   (ponto ou vírgula, conforme o idioma/configuração);
 * - ao dar Enter, o valor da linha vira a forma canônica ("Flora: R$ 2.000,00",
 *   "-R$ 100,00") e contas com valor esperado ("Total #Receitas: …") são preenchidas.
 */
import type { LineResult } from '../engine/evaluate';
import { formatValue, type FormatOptions } from '../engine/value';

const SEP = (decimal: 'comma' | 'dot') => (decimal === 'comma' ? { th: '.', dec: ',' } : { th: ',', dec: '.' });

/** Agrupa os milhares do número em que está o cursor. Devolve null quando não há o que mudar. */
export function regroupAtCaret(text: string, caret: number, decimal: 'comma' | 'dot'): { text: string; caret: number } | null {
  const { th, dec } = SEP(decimal);
  let a = caret;
  let b = caret;
  const isNumCh = (c: string | undefined) => !!c && (/\d/.test(c) || c === th || c === dec);
  while (a > 0 && isNumCh(text[a - 1])) a--;
  while (b < text.length && isNumCh(text[b])) b++;
  if (a === b) return null;
  const before = text[a - 1];
  const after = text[b];
  // parte de palavra, hexadecimal, data ou hora: não mexe
  if (before && /[\p{L}_/:]/u.test(before)) return null;
  if (after && /[\p{L}_/:]/u.test(after) && !/^[kKM]$/.test(after)) return null;
  if ((after === '-' && /\d/.test(text[b + 1] ?? '')) || (before === '-' && /\d/.test(text[a - 2] ?? ''))) return null;
  const tok = text.slice(a, b);
  if (!/^\d/.test(tok)) return null;
  const parts = tok.split(dec);
  if (parts.length > 2) return null;
  const int = parts[0].split(th).join('');
  if (!/^\d+$/.test(int)) return null;
  // o usuário está digitando um separador no fim: espera o próximo dígito
  if (tok.endsWith(th)) return null;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, th);
  const next = grouped + (parts.length === 2 ? dec + parts[1] : '');
  if (next === tok) return null;
  // cursor: mesma quantidade de dígitos (e vírgula decimal) antes dele
  const sig = (s: string) => s.replace(new RegExp(`\\${th}`, 'g'), '').length;
  const want = sig(tok.slice(0, caret - a));
  let k = 0;
  let seen = 0;
  while (k < next.length && seen < want) {
    if (next[k] !== th) seen++;
    k++;
  }
  return { text: text.slice(0, a) + next + text.slice(b), caret: a + k };
}

/** Forma canônica da linha (ou null se já está boa / não se aplica). */
export function canonicalLine(line: string, r: LineResult | undefined, fmt: FormatOptions): string | null {
  if (!r || r.kind !== 'value' || !r.value || r.fill === undefined) return null;
  const v = formatValue(r.value, fmt);
  let head = line.slice(0, r.fill);
  // "… =" ou "… :" sem valor ainda: um espaço antes do resultado
  if (/[=:]\s*$/.test(head)) head = head.replace(/\s*$/, ' ');
  const next = head + v;
  return next === line ? null : next;
}

/** A linha trata de dinheiro (para agrupar milhares enquanto digita)? */
export function isMoneyLine(line: string, r: LineResult | undefined): boolean {
  if (r?.value?.unit?.dim === 'money') return true;
  if (r?.inferred) return true;
  return /R\$|US\$|€|£|¥|\$|\b(BRL|USD|EUR|GBP|reais|real|d[oó]lar(es)?|euros?)\b/i.test(line);
}
