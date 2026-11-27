/**
 * Dicionário de fórmulas faladas: entende que uma frase é um PEDIDO DE CÁLCULO (e não um
 * lançamento) e escreve a fórmula com as seções e variáveis que já existem na nota.
 *   "faça agora o total de receitas menos despesas" → "Saldo: #Receitas - #Despesas"
 *   "média dos gastos" → "Média: média #Gastos"     "10 por cento das receitas" → "10% de #Receitas"
 *   "quanto sobra em porcentagem" → "Sobra em %: (#Receitas - #Despesas) em % de #Receitas"
 */
import type { Lang } from './types';
import { classifyTerm, type Kind } from '../engine/vocab';
import { wordsToNumbers } from './dictation';

export interface KnownNames {
  sections: { name: string; tone?: Kind }[];
  vars: string[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const has = (list: string[], w: string) => list.includes(w);

// palavras que pedem cálculo (o "aplicativo" do que foi dito)
const TRIGGER = ['faca', 'faz', 'fazer', 'calcule', 'calcula', 'calcular', 'mostre', 'mostra', 'mostrar', 'quanto', 'quanta', 'qual', 'quero', 'coloque', 'coloca', 'adicione', 'crie', 'cria', 'gere', 'total', 'totalize', 'some', 'soma', 'somar', 'saldo', 'sobra', 'sobrou', 'sobrando', 'resta', 'restou', 'diferenca', 'media', 'maior', 'menor', 'maximo', 'minimo', 'porcentagem', 'percentual', 'porcento', 'subtraia', 'subtrair', 'tire', 'divida', 'dividir', 'dividido', 'multiplique', 'multiplicar', 'vezes', 'menos', 'calculate', 'compute', 'show', 'make', 'what', 'how', 'balance', 'difference', 'average', 'highest', 'lowest', 'percent', 'percentage', 'sum', 'multiply', 'divide', 'divided', 'times', 'minus', 'calcula', 'cuanto', 'cuanta', 'muestra', 'diferencia', 'promedio', 'mayor', 'suma', 'resta', 'multiplica', 'divide', 'porcentaje'];
// verbos de lançamento: aí é compra/recebimento, não fórmula
const ENTRY = ['comprei', 'paguei', 'gastei', 'recebi', 'vendi', 'ganhei', 'bought', 'paid', 'spent', 'received', 'sold', 'earned', 'compre', 'pague', 'gaste', 'recibi', 'vendi', 'gane'];
const MINUS = ['menos', 'subtraia', 'subtrair', 'subtraindo', 'tirando', 'tira', 'tire', 'descontando', 'desconta', 'minus', 'less', 'subtract', 'resta', 'restando'];
const PLUS = ['mais', 'somando', 'plus', 'add', 'adding'];
const TIMES = ['vezes', 'multiplicado', 'multiplique', 'multiplicar', 'times', 'multiply', 'multiplied', 'multiplica'];
const DIV = ['dividido', 'divida', 'dividir', 'divide', 'divided', 'entre'];
const SUM = ['total', 'totalize', 'soma', 'some', 'somar', 'somatorio', 'sum', 'suma', 'sumar'];
const AVG = ['media', 'average', 'mean', 'promedio'];
const MAX = ['maior', 'maximo', 'highest', 'largest', 'biggest', 'mayor'];
const MIN = ['menor', 'minimo', 'lowest', 'smallest'];
const PCT = ['porcentagem', 'percentual', 'percentage', 'porcentaje', 'percent'];
const BAL = ['saldo', 'sobra', 'sobrou', 'sobrando', 'restou', 'balance', 'left', 'leftover', 'remaining', 'sobrante', 'queda'];

const LABELS: Record<Lang, Record<string, string>> = {
  pt: { bal: 'Saldo', diff: 'Diferença', sum: 'Soma', res: 'Resultado', avg: 'Média', max: 'Maior', min: 'Menor', pct: 'Sobra em %' },
  en: { bal: 'Balance', diff: 'Difference', sum: 'Sum', res: 'Result', avg: 'Average', max: 'Highest', min: 'Lowest', pct: 'Left as %' },
  es: { bal: 'Saldo', diff: 'Diferencia', sum: 'Suma', res: 'Resultado', avg: 'Promedio', max: 'Mayor', min: 'Menor', pct: 'Sobra en %' },
};

/** A frase é um pedido de cálculo? */
export function isFormulaRequest(sentence: string): boolean {
  const ws = fold(sentence).split(/[^a-z0-9%]+/);
  if (ws.some((w) => has(ENTRY, w))) return false;
  return ws.some((w) => has(TRIGGER, w)) || /\bpor cento\b|%/.test(fold(sentence));
}

const sectionRef = (s: { name: string }) => '#' + s.name.replace(/\s+/g, '');

export function buildFormula(sentence: string, known: KnownNames, lang: Lang): string | null {
  if (!isFormulaRequest(sentence)) return null;
  const L = LABELS[lang];
  const words = fold(wordsToNumbers(sentence.replace(/\bpor\s+ciento\b|\bpor\s+cento\b|\bporcento\b|\bper\s*cent\b/gi, ' % '), lang)).replace(/(\d)%/g, '$1 %').replace(/[^a-z0-9%,.\s]/g, ' ').split(/\s+/).filter(Boolean);
  const income = known.sections.find((s) => s.tone === 'income');
  const expense = known.sections.find((s) => s.tone === 'expense');
  const ops: string[] = [];
  const operands: { s: string; sec?: { name: string; tone?: Kind } }[] = [];
  let verb: '+' | '-' | '*' | '/' | null = null;
  let agg: 'avg' | 'max' | 'min' | null = null;
  let total = false;
  let pct = false;
  let bal = false;
  const varsF = known.vars.map((v) => ({ v, f: fold(v).split(/\s+/) })).sort((a, b) => b.f.length - a.f.length);
  const pushOperand = (o: { s: string; sec?: { name: string; tone?: Kind } }) => {
    if (operands.length > ops.length) ops.push(verb ?? (total ? '+' : '+'));
    operands.push(o);
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // variável (pode ter várias palavras: "valor da hora")
    const v = varsF.find((x) => x.f.every((p, k) => words[i + k] === p));
    if (v) {
      pushOperand({ s: v.v });
      i += v.f.length - 1;
      continue;
    }
    // seção: pelo nome (singular/plural) ou pelo sentido (receitas → #Ganhos)
    const sec =
      known.sections.find((s) => {
        const n = fold(s.name);
        return n === w || n === w + 's' || n + 's' === w || n === w.replace(/oes$/, 'ao');
      }) ?? (() => {
        const k = classifyTerm(w);
        return k && !has(TRIGGER, w) && !has(ENTRY, w) ? known.sections.find((s) => s.tone === k) : undefined;
      })();
    if (sec) {
      pushOperand({ s: sectionRef(sec), sec });
      continue;
    }
    if (/^\d+([.,]\d+)?$/.test(w)) {
      if (words[i + 1] === '%') {
        pushOperand({ s: `${w}% de` });
        i++;
        if (['de', 'das', 'dos', 'do', 'da', 'of'].includes(words[i + 1])) i++;
        continue;
      }
      pushOperand({ s: w });
      continue;
    }
    if (has(MINUS, w)) (operands.length > ops.length ? ops.push('-') : (verb = '-'));
    else if (has(PLUS, w) || (w === 'e' && verb === '+') || (w === 'and' && verb === '+')) operands.length > ops.length && ops.push('+');
    else if (has(TIMES, w)) (operands.length > ops.length ? ops.push('*') : (verb = '*'));
    else if (has(DIV, w)) (operands.length > ops.length ? ops.push('/') : (verb = '/'));
    else if (w === 'por' || w === 'by') {
      if (verb === '*' || verb === '/') operands.length > ops.length && ops.push(verb);
    } else if (has(SUM, w)) {
      total = true;
      if (!verb) verb = '+';
    } else if (has(AVG, w)) agg = 'avg';
    else if (has(MAX, w)) agg = 'max';
    else if (has(MIN, w)) agg = 'min';
    else if (has(PCT, w) || w === '%') pct = true;
    else if (has(BAL, w)) bal = true;
    else if (w === 'diferenca' || w === 'difference' || w === 'diferencia') verb = '-';
  }
  // "10% de" precisa de algo depois
  const exprOf = () => operands.map((o, k) => (k ? ` ${ops[k - 1] ?? '+'} ` : '') + o.s).join('').replace(/% de \+ /g, '% de ');
  const balanceExpr = income && expense ? `${sectionRef(income)} - ${sectionRef(expense)}` : null;

  if (!operands.length) {
    if ((bal || pct) && balanceExpr) return pct ? `${L.pct}: (${balanceExpr}) em % de ${sectionRef(income!)}` : `${L.bal}: ${balanceExpr}`;
    if (total) return 'total';
    return null;
  }
  if (agg && operands.length === 1 && operands[0].sec) return `${L[agg]}: ${agg === 'avg' ? 'média' : agg === 'max' ? 'maior' : 'menor'} ${operands[0].s}`;
  if (total && operands.length === 1 && operands[0].sec && !pct) return `Total ${operands[0].s}`;
  const expr = exprOf();
  const isBalance = operands.length === 2 && ops[0] === '-' && operands[0].sec?.tone === 'income' && operands[1].sec?.tone === 'expense';
  if (pct && !/% de/.test(expr)) {
    const base = income ? sectionRef(income) : operands[0].s;
    return `${L.pct}: (${isBalance || operands.length > 1 ? expr : balanceExpr ?? expr}) em % de ${base}`;
  }
  if (/% de$/.test(expr)) return null;
  const pctOf = /% de/.test(expr);
  const label = isBalance || (bal && ops[0] === '-') ? L.bal : pctOf ? L.res : ops[0] === '-' ? L.diff : ops[0] === '+' && operands.length > 1 ? L.sum : L.res;
  return `${label}: ${expr}`;
}
