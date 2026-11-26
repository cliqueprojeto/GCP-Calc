/**
 * "Organizar": reescreve um bloco de cálculo como um orçamento limpo — lançamentos
 * separados em receitas e despesas (#seções), valores com moeda, totais por seção,
 * saldo e saldo em %. Funciona sem IA; a IA pode revisar o resultado depois.
 */
import type { LineResult } from '../engine/evaluate';
import { formatValue, type FormatOptions } from '../engine/value';
import type { Lang } from './types';

const EXPENSE_WORDS =
  /aluguel|mercado|supermercado|feira|luz|energia|[aá]gua|g[aá]s|internet|telefone|celular|unimed|plano|sa[uú]de|m[eé]dic|farm[aá]cia|rem[eé]dio|escola|faculdade|curso|cart[aã]o|transporte|combust|gasolina|uber|[oô]nibus|condom[ií]nio|iptu|ipva|seguro|lazer|assinatura|netflix|spotify|conta|imposto|taxa|parcela|empr[eé]stimo|financiamento|academia|restaurante|delivery|ifood|presente|manuten|reforma|despesa|gasto|custo|pagamento|rent|groceries|food|bill|insurance|tax|fee|loan|gym|alquiler|comida|luz|factura|seguro|impuesto|cuota|gasto/i;

const NAMES: Record<Lang, { income: string; expense: string; balance: string }> = {
  pt: { income: 'Receitas', expense: 'Despesas', balance: 'Saldo' },
  en: { income: 'Income', expense: 'Expenses', balance: 'Balance' },
  es: { income: 'Ingresos', expense: 'Gastos', balance: 'Saldo' },
};

interface Entry {
  line: string;
  label: string;
  body: string;
}

export function organizeText(text: string, results: LineResult[], fmt: FormatOptions, lang: Lang): string {
  const lines = text.split('\n');
  const keep: string[] = [];
  const income: Entry[] = [];
  const expense: Entry[] = [];
  let incomeName = '';
  let expenseName = '';
  let tone: LineResult['tone'];
  lines.forEach((line, i) => {
    const r = results[i];
    if (!r) return keep.push(line);
    if (r.kind === 'header') {
      tone = r.tone;
      if (r.section && r.tone === 'income' && !incomeName) incomeName = r.section;
      else if (r.section && r.tone === 'expense' && !expenseName) expenseName = r.section;
      else if (!r.section || !r.tone) keep.push(line);
      return;
    }
    if (r.kind === 'empty') return;
    const money = r.kind === 'value' && r.value?.unit?.dim === 'money';
    // totais, saldos e percentuais antigos são refeitos no fim
    if ((r.kind === 'value' && r.aggregate) || (r.value?.pct && r.aggregate)) return;
    if (!money || !r.label || r.assigned) return keep.push(line);
    const literal = r.fill !== undefined;
    const v = r.value!;
    const isExpense = tone === 'expense' || v.n < 0 || (tone !== 'income' && EXPENSE_WORDS.test(r.label));
    const body = literal ? formatValue({ ...v, n: Math.abs(v.n) }, fmt) : line.slice(line.indexOf(':') + 1).trim().replace(/^-\s*/, '');
    (isExpense ? expense : income).push({ line, label: r.label, body });
  });
  const n = NAMES[lang];
  const inc = (incomeName || n.income).replace(/\s+/g, '');
  const exp = (expenseName || n.expense).replace(/\s+/g, '');
  const out: string[] = [];
  while (keep.length && !keep[keep.length - 1].trim()) keep.pop();
  if (keep.length) out.push(...keep, '');
  if (income.length) out.push(`#${inc}`, ...income.map((e) => `${e.label}: ${e.body}`), `Total #${inc}`, '');
  if (expense.length) out.push(`#${exp}`, ...expense.map((e) => `${e.label}: ${e.body}`), `Total #${exp}`, '');
  if (income.length && expense.length) out.push(`${n.balance}: #${inc} - #${exp}`, `${n.balance} %`);
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}
