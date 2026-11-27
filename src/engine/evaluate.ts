/**
 * Motor de cálculo em linguagem natural (PT / EN / ES).
 *
 * Cada linha da nota é lida como uma expressão. Palavras desconhecidas são
 * ignoradas (como em "Aluguel 1.500 + condomínio 450"), e o que sobra é
 * interpretado: números com separadores do idioma, porcentagens, unidades,
 * moedas, tags personalizadas, variáveis, funções, datas e totais.
 */
import { classifyTerm } from './vocab';
import { findUnit, fold, unitById, MAX_UNIT_WORDS, type Unit } from './units';
import { findCurrency, SYMBOLS, MAX_CURRENCY_WORDS } from './currencies';
import {
  add,
  CalcError,
  convert,
  currencyUnit,
  div,
  mul,
  neg,
  pow,
  type EvalContext,
  type NumFormat,
  type Value,
} from './value';

// --------------------------------------------------------------- palavras

type Kw =
  | { k: 'conv' }
  | { k: 'of' }
  | { k: 'off' }
  | { k: 'on' }
  | { k: 'pctword' }
  | { k: 'agg'; name: 'sum' | 'avg' | 'prev' | 'min' | 'max' | 'count' }
  | { k: 'date'; name: 'today' | 'now' | 'tomorrow' | 'yesterday' }
  | { k: 'fmt'; name: NumFormat }
  | { k: 'op'; op: Op }
  | { k: 'scale'; v: number }
  | { k: 'const'; v: number };

type Op = '+' | '-' | '*' | '/' | '^' | 'mod';

const KW: Record<string, Kw> = {};
const kw = (names: string[], v: Kw) => names.forEach((n) => (KW[n] = v));
kw(['in', 'to', 'as', 'into', 'em', 'para', 'en', 'a', 'como', 'in terms of'], { k: 'conv' });
kw(['of', 'de', 'del', 'da', 'do', 'sobre'], { k: 'of' });
kw(['off', 'desconto', 'de desconto', 'descuento', 'de descuento'], { k: 'off' });
kw(['on', 'acrescimo', 'de acrescimo', 'a mais', 'recargo'], { k: 'on' });
kw(['percent', 'por cento', 'porcento', 'por ciento', 'porciento', 'pct'], { k: 'pctword' });
kw(['sum', 'total', 'soma', 'suma', 'totais', 'subtotal'], { k: 'agg', name: 'sum' });
kw(['average', 'avg', 'mean', 'media', 'promedio'], { k: 'agg', name: 'avg' });
kw(['maior', 'maximo', 'mayor', 'maximum', 'highest'], { k: 'agg', name: 'max' });
kw(['menor', 'minimo', 'minimum', 'lowest'], { k: 'agg', name: 'min' });
kw(['prev', 'previous', 'ans', 'anterior', 'ultimo', 'resultado anterior'], { k: 'agg', name: 'prev' });
kw(['count', 'contagem', 'conteo', 'quantidade de linhas'], { k: 'agg', name: 'count' });
kw(['today', 'hoje', 'hoy'], { k: 'date', name: 'today' });
kw(['now', 'agora', 'ahora'], { k: 'date', name: 'now' });
kw(['tomorrow', 'amanha', 'manana'], { k: 'date', name: 'tomorrow' });
kw(['yesterday', 'ontem', 'ayer'], { k: 'date', name: 'yesterday' });
kw(['hex', 'hexadecimal'], { k: 'fmt', name: 'hex' });
kw(['bin', 'binary', 'binario'], { k: 'fmt', name: 'bin' });
kw(['oct', 'octal'], { k: 'fmt', name: 'oct' });
kw(['sci', 'scientific', 'cientifica', 'cientifico', 'notacao cientifica', 'notacion cientifica'], { k: 'fmt', name: 'sci' });
kw(['plus', 'mais', 'with', 'com', 'and', 'con'], { k: 'op', op: '+' });
kw(['minus', 'menos', 'without', 'sem'], { k: 'op', op: '-' });
kw(['times', 'vezes', 'multiplied by', 'multiplicado por', 'multiplicados por', 'veces'], { k: 'op', op: '*' });
kw(['divided by', 'dividido por', 'divididos por', 'over', 'dividido entre', 'entre'], { k: 'op', op: '/' });
kw(['mod', 'modulo', 'resto de'], { k: 'op', op: 'mod' });
kw(['elevado a', 'elevado ao', 'to the power of', 'pow'], { k: 'op', op: '^' });
kw(['thousand', 'thousands', 'mil'], { k: 'scale', v: 1e3 });
kw(['million', 'millions', 'milhao', 'milhoes', 'millon', 'millones'], { k: 'scale', v: 1e6 });
kw(['billion', 'billions', 'bilhao', 'bilhoes', 'mil millones'], { k: 'scale', v: 1e9 });
kw(['billon', 'billones', 'trillion', 'trillions', 'trilhao', 'trilhoes'], { k: 'scale', v: 1e12 });
kw(['dozen', 'dozens', 'duzia', 'duzias', 'docena', 'docenas'], { k: 'scale', v: 12 });
kw(['pi', 'π'], { k: 'const', v: Math.PI });
kw(['tau', 'τ'], { k: 'const', v: Math.PI * 2 });
kw(['phi', 'φ', 'golden ratio', 'numero de ouro'], { k: 'const', v: (1 + Math.sqrt(5)) / 2 });
kw(['euler'], { k: 'const', v: Math.E });

/** Palavras que só valem com acento exato (evita "mas" = "mais" em espanhol × "mas" = "porém"). */
const EXACT: Record<string, Kw> = { más: { k: 'op', op: '+' } };
/** Palavras de escala que dependem do idioma (em PT "2 mi" = 2 milhões; em EN "mi" = milha). */
const PT_SCALE: Record<string, number> = { mi: 1e6, bi: 1e9, tri: 1e12 };

export const FUNCS = new Set([
  'sqrt', 'raiz', 'cbrt', 'abs', 'round', 'arredondar', 'arredonda', 'redondear', 'ceil', 'teto', 'floor', 'piso', 'trunc',
  'sin', 'sen', 'seno', 'cos', 'cosseno', 'coseno', 'tan', 'tg', 'asin', 'arcsen', 'acos', 'atan', 'arctg', 'log', 'log2', 'ln', 'exp',
  'fact', 'fatorial', 'factorial', 'min', 'max', 'avg', 'mean', 'sum', 'pmt', 'parcela', 'cuota', 'fv', 'vf', 'pv', 'vp', 'root',
  'random', 'aleatorio', 'clamp', 'hypot', 'gcd', 'mdc', 'mcd', 'lcm', 'mmc', 'mcm',
]);
const FUNC_ALIAS: Record<string, string> = {
  raiz: 'sqrt', arredondar: 'round', arredonda: 'round', redondear: 'round', teto: 'ceil', piso: 'floor', sen: 'sin', seno: 'sin',
  cosseno: 'cos', coseno: 'cos', tg: 'tan', arcsen: 'asin', arctg: 'atan', fatorial: 'fact', factorial: 'fact', mean: 'avg',
  parcela: 'pmt', cuota: 'pmt', vf: 'fv', vp: 'pv', aleatorio: 'random', mdc: 'gcd', mcd: 'gcd', mmc: 'lcm', mcm: 'lcm',
};

// --------------------------------------------------------------- tokens

export type Cls = 'num' | 'unit' | 'cur' | 'op' | 'var' | 'func' | 'kw' | 'cmt' | 'hdr' | 'label' | 'text' | 'tag' | 'date' | 'assign' | 'paren' | 'section' | 'ghost';

export interface Segment {
  text: string;
  cls: Cls;
}

type Tok =
  | { k: 'num'; v: number; fmt?: NumFormat }
  | { k: 'dateLit'; v: number }
  | { k: 'op'; op: Op }
  | { k: 'pct' }
  | { k: 'fact' }
  | { k: 'sq'; p: number }
  | { k: 'lp' }
  | { k: 'rp' }
  | { k: 'sep' }
  | { k: 'unit'; u: Unit; word: string }
  | { k: 'cur'; code: string; prefixOk: boolean }
  | { k: 'var'; name: string }
  | { k: 'func'; name: string }
  | { k: 'ufunc'; name: string }
  | { k: 'line'; n: number }
  | { k: 'section'; name: string }
  | Kw;

interface Raw {
  t: 'ws' | 'num' | 'word' | 'sym' | 'op' | 'other' | 'date' | 'tag' | 'cmt';
  s: string;
}

const WORD_RE = /^[\p{L}_°º][\p{L}\p{N}_]*(?:[²³])?/u;

function rawLex(line: string, ctx: EvalContext): Raw[] {
  const out: Raw[] = [];
  let i = 0;
  const comma = ctx.decimal === 'comma';
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\s+/))) out.push({ t: 'ws', s: m[0] });
    else if (rest.startsWith('//')) out.push({ t: 'cmt', s: rest });
    else if ((m = rest.match(/^\d{4}-\d{2}-\d{2}(?!\d)/)) || (m = rest.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}(?![\d/])/))) out.push({ t: 'date', s: m[0] });
    else if ((m = rest.match(/^0x[0-9a-f]+|^0b[01]+|^0o[0-7]+/i))) out.push({ t: 'num', s: m[0] });
    else if ((m = rest.match(comma ? /^(?:\d[\d.,]*|,\d+)(?:e[+-]?\d+)?/i : /^(?:\d[\d.,]*|\.\d+)(?:e[+-]?\d+)?/i))) {
      let s = m[0];
      // separador solto no fim ("5," ou "fim.") não faz parte do número
      while (/[.,]$/.test(s)) s = s.slice(0, -1);
      if (!s) {
        out.push({ t: 'other', s: m[0] });
        i += m[0].length;
        continue;
      }
      out.push({ t: 'num', s });
      i += s.length;
      // "3k", "2.5M" e "3x4"
      const after = line.slice(i);
      const sc = after.match(/^[kK](?![\p{L}\p{N}])|^M(?![\p{L}\p{N}])/u);
      if (sc) {
        out.push({ t: 'word', s: sc[0] });
        i += sc[0].length;
      } else if (/^x\d/.test(after)) {
        out.push({ t: 'op', s: 'x' });
        i += 1;
      }
      continue;
    } else if ((m = rest.match(/^#[\p{L}\p{N}_]+/u))) out.push({ t: 'tag', s: m[0] });
    else if (SYMBOLS.some(([s]) => rest.startsWith(s))) {
      const s = SYMBOLS.find(([s]) => rest.startsWith(s))![0];
      out.push({ t: 'sym', s });
    } else if (rest[0] === '$') out.push({ t: 'sym', s: '$' });
    else if ((m = rest.match(/^(\*\*|->|→|=>|[+\-−–*×·⋅\/÷^%!()=;,²³])/))) out.push({ t: 'op', s: m[0] });
    else if ((m = rest.match(WORD_RE))) {
      // unidades compostas com barra: km/h, m/s, mb/s
      const slash = rest.match(/^[\p{L}]+\/[\p{L}]+/u);
      if (slash && findUnit(slash[0])) out.push({ t: 'word', s: slash[0] });
      else out.push({ t: 'word', s: m[0] });
    } else out.push({ t: 'other', s: rest[0] });
    i += out[out.length - 1].s.length;
  }
  return out;
}

export function parseNumber(s: string, decimal: 'comma' | 'dot'): number {
  if (/^0x/i.test(s)) return parseInt(s.slice(2), 16);
  if (/^0b/i.test(s)) return parseInt(s.slice(2), 2);
  if (/^0o/i.test(s)) return parseInt(s.slice(2), 8);
  let [mant, exp] = s.split(/e/i);
  if (decimal === 'comma') {
    if (mant.includes(',')) mant = mant.replace(/\./g, '').replace(/,(?=[^,]*$)/, '.').replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3})+$/.test(mant)) mant = mant.replace(/\./g, '');
    else if ((mant.match(/\./g) || []).length > 1) mant = mant.replace(/\./g, '');
  } else {
    if (mant.includes('.')) mant = mant.replace(/,/g, '');
    else if (/^\d{1,3}(,\d{3})+$/.test(mant)) mant = mant.replace(/,/g, '');
    else mant = mant.replace(/,(?=[^,]*$)/, '.').replace(/,/g, '');
  }
  const n = parseFloat(mant);
  return exp !== undefined ? n * Math.pow(10, parseInt(exp, 10)) : n;
}

function parseDateLit(s: string, ctx: EvalContext): number {
  if (/^\d{4}-/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  let [a, b, y] = s.split('/').map(Number);
  if (y < 100) y += 2000;
  const [d, m] = ctx.dateOrder === 'mdy' ? [b, a] : [a, b];
  return new Date(y, m - 1, d).getTime();
}

interface Scope {
  vars: Map<string, Value>;
  funcs: Map<string, { params: string[]; body: string }>;
  /** valores do bloco atual (para total/média) */
  group: Value[];
  prev?: Value;
  lines: (Value | undefined)[];
  sections?: Map<string, Section>;
  /** seção atual: "total" soma a seção inteira, mesmo com linhas em branco no meio */
  section?: string;
}

/** Seção nomeada (#Receitas): soma das linhas abaixo do título. */
export interface Section {
  name: string;
  values: Value[];
  tone?: Tone;
  /** previsto/meta dos lançamentos "previsto | realizado" */
  planned?: Value[];
  /** "## Equipe" dentro de "# Despesas": chave da seção-mãe (os valores também somam nela) */
  parent?: string;
  /** tipo herdado da seção-mãe */
  inherit?: Tone;
}

export type Tone = 'income' | 'expense';


/** Receita (verde) ou despesa (vermelho), pelo nome da seção ou pelo sinal da soma. */
export function sectionTone(name: string, values: Value[] = []): Tone | undefined {
  const k = classifyTerm(name);
  if (k) return k;
  const money = values.filter((v) => v.unit?.dim === 'money');
  if (money.length && money.every((v) => v.n < 0)) return 'expense';
  return undefined;
}

/**
 * Valores que somam numa seção. Em despesas, lançamentos com e sem sinal de menos
 * ("Mercado: R$ 100" e "Farmácia: -R$ 85") são todos gastos: usam o sinal da maioria.
 */
export function sectionValues(sec: Section): Value[] {
  if (sec.tone !== 'expense') return sec.values;
  const money = sec.values.filter((v) => v.n !== 0);
  const neg = money.filter((v) => v.n < 0).length;
  if (!neg || neg === money.length) return sec.values;
  const sign = neg > money.length / 2 ? -1 : 1;
  return sec.values.map((v) => ({ ...v, n: sign * Math.abs(v.n) }));
}

/** Rótulos que são quantidades, nunca dinheiro ("pessoas: 2", "dias: 8"). */
const QUANTITY_RE = /(^|[^\p{L}])(qtd|qtde|quant\p{L}*|pessoas?|dias?|meses|m[eê]s|anos?|horas?|minutos?|semanas?|unidades?|un|itens|item|vezes|por[cç][oõ]es|pe[cç]as|pcs|parcelas?|presta[cç][oõ]es|alunos|convidados|ingressos|lugares|people|persons?|guests|days?|weeks?|months?|years?|hours?|minutes?|units?|items?|times|servings?|qty|pieces|tickets|seats|installments|personas?|d[ií]as|a[nñ]os|cantidad|veces|porciones|cuotas|entradas|invitados)(?![\p{L}])/iu;
export const isQuantityLabel = (label: string) => QUANTITY_RE.test(label);

/** Ligação entre os pedaços brutos e os tokens: devolve tokens e a coloração da linha. */
function resolve(raws: Raw[], ctx: EvalContext, scope: Scope): { toks: Tok[]; segs: Segment[] } {
  const toks: Tok[] = [];
  const segs: Segment[] = [];
  const tagNames = new Map(ctx.tags.map((t) => [fold(t.name), t.name]));
  const seg = (text: string, cls: Cls) => segs.push({ text, cls });
  const lastTok = () => toks[toks.length - 1];
  const valueEnded = () => {
    const t = lastTok();
    return !!t && ['num', 'rp', 'unit', 'cur', 'var', 'pct', 'scale', 'dateLit', 'date', 'agg', 'const', 'line', 'fact', 'sq', 'pctword', 'section'].includes(t.k);
  };

  for (let i = 0; i < raws.length; i++) {
    const r = raws[i];
    switch (r.t) {
      case 'ws':
        seg(r.s, 'text');
        continue;
      case 'other': {
        // "# Despesas" (com espaço) dentro de uma conta também é a seção
        if (r.s === '#' && raws[i + 1]?.t === 'ws' && raws[i + 2]?.t === 'word' && scope.sections?.has(fold(raws[i + 2].s))) {
          toks.push({ k: 'section', name: fold(raws[i + 2].s) });
          seg(r.s + raws[i + 1].s + raws[i + 2].s, 'section');
          i += 2;
          continue;
        }
        seg(r.s, 'text');
        continue;
      }
      case 'cmt':
        seg(r.s, 'cmt');
        continue;
      case 'num': {
        toks.push({ k: 'num', v: parseNumber(r.s, ctx.decimal), fmt: /^0x/i.test(r.s) ? 'hex' : /^0b/i.test(r.s) ? 'bin' : undefined });
        seg(r.s, 'num');
        continue;
      }
      case 'date':
        toks.push({ k: 'dateLit', v: parseDateLit(r.s, ctx) });
        seg(r.s, 'date');
        continue;
      case 'tag': {
        const name = tagNames.get(fold(r.s.slice(1)));
        const sec = !name ? scope.sections?.get(fold(r.s.slice(1))) : undefined;
        if (sec) {
          toks.push({ k: 'section', name: fold(r.s.slice(1)) });
          seg(r.s, 'section');
          continue;
        }
        // "#Incentivo": um lançamento (rótulo) da nota
        if (!name && scope.vars.has(fold(r.s.slice(1)))) {
          toks.push({ k: 'var', name: fold(r.s.slice(1)) });
          seg(r.s, 'var');
          continue;
        }
        const code = name ?? findCurrency(r.s.slice(1));
        if (code) {
          toks.push({ k: 'cur', code, prefixOk: true });
          seg(r.s, 'tag');
        } else seg(r.s, 'text');
        continue;
      }
      case 'sym': {
        const code = r.s === '$' ? ctx.dollar : SYMBOLS.find(([s]) => s === r.s)![1];
        toks.push({ k: 'cur', code, prefixOk: true });
        seg(r.s, 'cur');
        continue;
      }
      case 'op': {
        const s = r.s;
        if (s === '(') toks.push({ k: 'lp' });
        else if (s === ')') toks.push({ k: 'rp' });
        else if (s === ';' || s === ',') {
          toks.push({ k: 'sep' });
        } else if (s === '%') toks.push({ k: 'pct' });
        else if (s === '!') toks.push({ k: 'fact' });
        else if (s === '²') toks.push({ k: 'sq', p: 2 });
        else if (s === '³') toks.push({ k: 'sq', p: 3 });
        else if (s === '=') {
          seg(s, 'op');
          continue; // "5 + 5 =" — o igual final é ignorado
        } else if (s === '->' || s === '→' || s === '=>') toks.push({ k: 'conv' });
        else {
          const op: Op = s === '+' ? '+' : s === '-' || s === '−' || s === '–' ? '-' : s === '/' || s === '÷' ? '/' : s === '^' || s === '**' ? '^' : '*';
          toks.push({ k: 'op', op });
        }
        seg(s, s === '(' || s === ')' ? 'paren' : 'op');
        continue;
      }
      case 'word':
        break;
    }

    // ---- palavras (com frases de várias palavras: "dividido por", "colher de sopa", variáveis com espaço)
    let matched = false;
    const maxWords = Math.max(MAX_UNIT_WORDS, MAX_CURRENCY_WORDS, 4);
    for (let n = maxWords; n >= 1 && !matched; n--) {
      // monta a frase com n palavras separadas só por espaço
      const parts: string[] = [];
      let j = i;
      let ok = true;
      for (let w = 0; w < n; w++) {
        if (j >= raws.length || raws[j].t !== 'word') {
          ok = false;
          break;
        }
        parts.push(raws[j].s);
        if (w < n - 1) {
          if (raws[j + 1]?.t !== 'ws' || raws[j + 1].s !== ' ') {
            ok = false;
            break;
          }
          j += 2;
        }
      }
      if (!ok) continue;
      const phrase = parts.join(' ');
      const f = fold(phrase);
      const lower = phrase.toLowerCase();
      const nextRaw = raws.slice(j + 1).find((x) => x.t !== 'ws');
      const nextIsParen = nextRaw?.t === 'op' && nextRaw.s === '(';
      const prevValue = valueEnded();
      const tok = classify(phrase, f, lower, { prevValue, nextIsParen, n, ctx, scope, tagNames, nextRaw });
      if (!tok) continue;
      matched = true;
      const text = raws.slice(i, j + 1).map((x) => x.s).join('');
      i = j;
      if (tok === 'skip') {
        seg(text, 'text');
        break;
      }
      toks.push(tok);
      seg(text, tok.k === 'unit' ? 'unit' : tok.k === 'cur' ? (tagNames.has(f) ? 'tag' : 'cur') : tok.k === 'var' ? 'var' : tok.k === 'section' ? 'section' : tok.k === 'func' || tok.k === 'ufunc' ? 'func' : tok.k === 'op' ? 'op' : tok.k === 'scale' ? 'num' : tok.k === 'date' ? 'date' : 'kw');
    }
    if (!matched) seg(r.s, 'text');
  }
  return { toks: tidy(toks), segs };
}

interface ClassifyEnv {
  prevValue: boolean;
  nextIsParen: boolean;
  n: number;
  ctx: EvalContext;
  scope: Scope;
  tagNames: Map<string, string>;
  nextRaw?: Raw;
}

function classify(phrase: string, f: string, lower: string, e: ClassifyEnv): Tok | 'skip' | null {
  // variáveis do usuário vêm primeiro (podem ter espaços)
  if (e.scope.vars.has(f)) return { k: 'var', name: f };
  // nome de seção sem "#": "receitas - despesas"
  if (e.scope.sections?.has(f) && !e.nextIsParen) return { k: 'section', name: f };
  if (e.n === 1 && e.scope.funcs.has(f) && e.nextIsParen) return { k: 'ufunc', name: f };
  if (e.tagNames.has(f)) return { k: 'cur', code: e.tagNames.get(f)!, prefixOk: true };
  if (e.n === 1 && /^line\d+$|^linha\d+$|^linea\d+$/.test(f)) return { k: 'line', n: parseInt(f.replace(/\D/g, ''), 10) };
  if (EXACT[lower]) return EXACT[lower];
  if (e.n === 1 && e.nextIsParen && FUNCS.has(f)) return { k: 'func', name: FUNC_ALIAS[f] ?? f };
  if (e.n === 1 && e.ctx.lang === 'pt' && PT_SCALE[f] && e.prevValue) return { k: 'scale', v: PT_SCALE[f] };
  if (e.n === 1 && (phrase === 'k' || phrase === 'K') && e.prevValue) return { k: 'scale', v: 1e3 };
  if (e.n === 1 && phrase === 'M' && e.prevValue) return { k: 'scale', v: 1e6 };
  if (e.n === 1 && phrase === 'x') return { k: 'op', op: '*' };
  // unidades e moedas só fazem sentido depois de um valor ou como destino de conversão
  const unit = findUnit(phrase);
  const code = findCurrency(phrase);
  const isUpperCode = /^[A-Z]{3,4}$/.test(phrase) && !!code;
  if (KW[f]) {
    const k = KW[f];
    // "in" pode ser polegada: decide-se na análise (ver tidy)
    if (k.k === 'conv' && f === 'in' && e.prevValue && unit && !nextIsTarget(e)) return { k: 'unit', u: unit, word: phrase };
    if (k.k === 'agg' && k.name === 'min' && f === 'min') return null; // "min" = minutos
    if (k.k === 'scale' && !e.prevValue) return 'skip';
    return k;
  }
  if (unit && e.prevValue) return { k: 'unit', u: unit, word: phrase };
  if (code && (e.prevValue || isUpperCode)) return { k: 'cur', code, prefixOk: isUpperCode };
  if (unit) return { k: 'unit', u: unit, word: phrase }; // pode ser destino ("em km"); se sobrar, é descartado
  if (code && e.n > 1) return { k: 'cur', code, prefixOk: false };
  if (code) return { k: 'cur', code, prefixOk: false };
  const tUnit = findUnit(phrase, true);
  if (tUnit && e.n === 1) return { k: 'unit', u: tUnit, word: phrase };
  if (e.n === 1 && FUNCS.has(f)) return { k: 'func', name: FUNC_ALIAS[f] ?? f };
  return null;
}

function nextIsTarget(e: ClassifyEnv): boolean {
  const r = e.nextRaw;
  if (!r) return false;
  if (r.t === 'sym' || r.t === 'tag') return true;
  if (r.t === 'op' && r.s === '%') return true;
  if (r.t !== 'word') return false;
  const f = fold(r.s);
  return !!(findUnit(r.s, true) || findCurrency(r.s) || (KW[f] && KW[f].k === 'fmt') || e.tagNames.has(f));
}

const ENDS_VALUE = new Set(['num', 'rp', 'unit', 'cur', 'var', 'pct', 'scale', 'dateLit', 'date', 'agg', 'const', 'line', 'fact', 'sq', 'pctword', 'section']);
const STARTS_TARGET = new Set(['unit', 'cur', 'fmt', 'pct']);

/** Remove palavras-chave que ficaram fora de contexto (ex.: "a" e "de" no meio do texto). */
function tidy(toks: Tok[]): Tok[] {
  let cur = toks;
  for (let pass = 0; pass < 3; pass++) {
    const out: Tok[] = [];
    for (let i = 0; i < cur.length; i++) {
      const t = cur[i];
      const prev = out[out.length - 1];
      const next = cur[i + 1];
      if (t.k === 'conv') {
        // "10 mil reais em 10 meses", "R$ 500 por 3 vezes": multiplica
        if (prev && ENDS_VALUE.has(prev.k) && next?.k === 'num') {
          out.push({ k: 'op', op: '*' });
          continue;
        }
        if (!prev || !ENDS_VALUE.has(prev.k) || !next || !STARTS_TARGET.has(next.k)) continue;
      }
      if (t.k === 'of') {
        const okPrev = prev && (prev.k === 'pct' || prev.k === 'pctword' || prev.k === 'func');
        if (!okPrev || !next) continue;
      }
      if ((t.k === 'off' || t.k === 'on') && !(prev && (prev.k === 'pct' || prev.k === 'pctword'))) continue;
      if (t.k === 'unit') {
        // unidade solta, sem valor antes e sem ser destino de conversão: é texto
        if (!prev || (!ENDS_VALUE.has(prev.k) && prev.k !== 'conv' && prev.k !== 'num')) continue;
      }
      if (t.k === 'cur' && !t.prefixOk) {
        if (!prev || (!ENDS_VALUE.has(prev.k) && prev.k !== 'conv')) continue;
      }
      if (t.k === 'op' && t.op !== '-' && (!prev || !ENDS_VALUE.has(prev.k))) {
        // operador sem valor antes ("com leite", "+5"): ignora
        continue;
      }
      if (t.k === 'agg' && next && (next.k === 'num' || next.k === 'cur' || next.k === 'var' || (next.k === 'section' && t.name === 'sum'))) {
        // "total 500", "média 7": aqui a palavra é rótulo, não total
        continue;
      }
      out.push(t);
    }
    if (out.length === cur.length) return out;
    cur = out;
  }
  return cur;
}

// --------------------------------------------------------------- análise

class Parser {
  i = 0;
  usedAggregate = false;
  constructor(
    private t: Tok[],
    private ctx: EvalContext,
    private scope: Scope,
    private depth = 0,
  ) {}

  peek(o = 0): Tok | undefined {
    return this.t[this.i + o];
  }
  next(): Tok {
    return this.t[this.i++];
  }
  done() {
    return this.i >= this.t.length;
  }

  parse(): Value {
    if (!this.t.length) throw new CalcError('empty');
    const v = this.conversion();
    // operadores pendurados no fim ("5 +") e parênteses sobrando são tolerados
    while (!this.done()) {
      const p = this.peek()!;
      if (p.k === 'rp' || p.k === 'op' || p.k === 'sep') this.i++;
      else throw new CalcError('syntax');
    }
    return v;
  }

  isConv(): boolean {
    const p = this.peek();
    if (!p) return false;
    if (p.k === 'conv') return true;
    return false;
  }

  conversion(): Value {
    let v = this.additive();
    while (this.isConv()) {
      this.i++;
      const p = this.peek();
      if (!p) break;
      if (p.k === 'pct') {
        this.i++;
        if (this.peek()?.k === 'of') {
          this.i++;
          const r = this.additive();
          const ratio = div({ ...v, pct: false }, { ...r, pct: false }, this.ctx);
          v = { n: ratio.n, pct: true };
        } else v = { n: v.pct ? v.n : v.n, pct: true };
      } else if (p.k === 'fmt') {
        this.i++;
        v = { ...v, fmt: p.name };
      } else if (p.k === 'unit') {
        this.i++;
        v = convert(v, p.u, this.ctx);
      } else if (p.k === 'cur') {
        this.i++;
        v = convert(v, currencyUnit(p.code), this.ctx);
      } else break;
      // depois da conversão a conta pode continuar: "área em m2 * R$ 25"
      for (;;) {
        const o = this.peek();
        if (o?.k !== 'op' || o.op === '^') break;
        this.i++;
        if (this.isTerminator()) break;
        if (o.op === '+' || o.op === '-') v = add(v, this.multiplicative(), o.op === '+' ? 1 : -1, this.ctx);
        else if (o.op === '*') v = mul(v, this.unary(), this.ctx);
        else if (o.op === '/') v = div(v, this.unary(), this.ctx);
        else {
          const r = this.unary();
          v = { ...v, n: ((v.n % r.n) + r.n) % r.n };
        }
      }
    }
    return v;
  }

  additive(): Value {
    let v = this.multiplicative();
    for (;;) {
      const p = this.peek();
      if (p?.k === 'op' && (p.op === '+' || p.op === '-')) {
        this.i++;
        if (!this.peek() || this.isTerminator()) break;
        const first = this.peek();
        const at = this.i;
        let r = this.multiplicative();
        // "#Receitas - #Despesas": despesas lançadas como negativas entram pelo valor absoluto
        if (p.op === '-' && first?.k === 'section' && this.i === at + 1 && r.n < 0) r = neg(r);
        v = add(v, r, p.op === '+' ? 1 : -1, this.ctx);
      } else break;
    }
    return v;
  }

  isTerminator() {
    const p = this.peek();
    return !p || p.k === 'rp' || p.k === 'sep' || p.k === 'conv';
  }

  startsPrimary(p?: Tok) {
    return !!p && ['num', 'lp', 'var', 'const', 'func', 'ufunc', 'dateLit', 'date', 'agg', 'line', 'section'].includes(p.k);
  }

  multiplicative(): Value {
    let v = this.unary();
    for (;;) {
      const p = this.peek();
      if (p?.k === 'op' && (p.op === '*' || p.op === '/' || p.op === 'mod')) {
        this.i++;
        if (this.isTerminator()) break;
        const r = this.unary();
        if (p.op === '*') v = mul(v, r, this.ctx);
        else if (p.op === '/') v = div(v, r, this.ctx);
        else {
          if (r.n === 0) throw new CalcError('div0');
          v = { ...v, n: ((v.n % r.n) + r.n) % r.n };
        }
      } else if (p?.k === 'of' && v.pct) {
        this.i++;
        const r = this.unary();
        v = mul(v, r, this.ctx);
      } else if ((p?.k === 'off' || p?.k === 'on') && v.pct) {
        this.i++;
        const r = this.unary();
        v = { ...r, n: r.n * (1 + (p.k === 'off' ? -1 : 1) * v.n) };
      } else if (p && (p.k === 'lp' || p.k === 'const' || (p.k === 'func' && v.unit === undefined))) {
        // multiplicação implícita: 2(3+4), 2 pi
        const r = this.unary();
        v = mul(v, r, this.ctx);
      } else break;
    }
    return v;
  }

  unary(): Value {
    const p = this.peek();
    if (p?.k === 'op' && p.op === '-') {
      this.i++;
      return neg(this.unary());
    }
    if (p?.k === 'op' && p.op === '+') {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  power(): Value {
    const base = this.postfix();
    const p = this.peek();
    if (p?.k === 'op' && p.op === '^') {
      this.i++;
      const e = this.unary();
      return pow(base, e);
    }
    return base;
  }

  postfix(): Value {
    let v = this.primary();
    for (;;) {
      const p = this.peek();
      if (!p) break;
      if (p.k === 'pct' || p.k === 'pctword') {
        // "50% de 200" já é tratado no multiplicativo; aqui só marca porcentagem
        if (p.k === 'pct' && this.peek(1)?.k === 'of' && v.pct) break;
        this.i++;
        v = { n: v.n / 100, pct: true };
      } else if (p.k === 'fact') {
        this.i++;
        v = { ...v, n: factorial(v.n) };
      } else if (p.k === 'sq') {
        this.i++;
        v = pow(v, { n: p.p });
      } else if (p.k === 'scale' && !v.unit && !v.pct) {
        this.i++;
        v = { ...v, n: v.n * p.v };
      } else if (p.k === 'unit' && !v.pct && !v.date) {
        if (v.unit) {
          break;
        }
        this.i++;
        v = { ...v, unit: p.u };
        // "5 ft 3 in", "1 h 30 min": soma valores seguidos da mesma dimensão
        while (this.peek()?.k === 'num' && this.peek(1)?.k === 'unit') {
          const u2 = (this.peek(1) as { u: Unit }).u;
          if (u2.dim !== p.u.dim) break;
          const n2 = (this.next() as { v: number }).v;
          this.i++;
          v = add(v, { n: n2, unit: u2 }, 1, this.ctx);
        }
      } else if (p.k === 'cur' && !v.unit && !v.pct && !v.date) {
        this.i++;
        v = { ...v, unit: currencyUnit(p.code) };
      } else break;
    }
    return v;
  }

  args(): Value[] {
    const out: Value[] = [];
    if (this.peek()?.k !== 'lp') {
      // função sem parênteses: "raiz de 16", "sqrt 16"
      if (this.peek()?.k === 'of') this.i++;
      out.push(this.power());
      return out;
    }
    this.i++;
    if (this.peek()?.k === 'rp') {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.conversion());
      const p = this.peek();
      if (p?.k === 'sep') {
        this.i++;
        continue;
      }
      if (p?.k === 'rp') this.i++;
      break;
    }
    return out;
  }

  primary(): Value {
    const p = this.next();
    if (!p) throw new CalcError('syntax');
    switch (p.k) {
      case 'num':
        return { n: p.v, fmt: p.fmt };
      case 'dateLit':
        return { n: p.v, date: true };
      case 'date': {
        const d = new Date(this.ctx.now);
        if (p.name !== 'now') d.setHours(0, 0, 0, 0);
        if (p.name === 'tomorrow') d.setDate(d.getDate() + 1);
        if (p.name === 'yesterday') d.setDate(d.getDate() - 1);
        return { n: d.getTime(), date: true };
      }
      case 'const':
        return { n: p.v };
      case 'cur': {
        // prefixo: R$ 1.500, USD 20, #milhas 300
        const v = this.power();
        if (v.unit && v.unit.dim !== 'money') throw new CalcError('incompatible');
        return { ...v, unit: currencyUnit(p.code), pct: false };
      }
      case 'lp': {
        const v = this.conversion();
        if (this.peek()?.k === 'rp') this.i++;
        return v;
      }
      case 'var':
        return { ...this.scope.vars.get(p.name)! };
      case 'line': {
        const v = this.scope.lines[p.n - 1];
        if (!v) throw new CalcError('noline', String(p.n));
        return { ...v };
      }
      case 'agg': {
        // "média #Gastos", "maior #Despesas": conta sobre a seção
        const nx = this.peek();
        if (nx?.k === 'section' && p.name !== 'sum' && p.name !== 'prev') {
          this.i++;
          const sec = this.scope.sections?.get(nx.name);
          return this.aggregate(p.name, sec ? sectionValues(sec) : []);
        }
        return this.aggregate(p.name);
      }
      case 'section': {
        this.usedAggregate = true;
        const sec = this.scope.sections?.get(p.name);
        return this.aggregate('sum', sec ? sectionValues(sec) : []);
      }
      case 'func':
        return callFunc(p.name, this.args(), this.ctx);
      case 'ufunc':
        return this.callUser(p.name, this.args());
      case 'unit':
        // unidade sozinha vale 1 (ex.: "km em m")
        return { n: 1, unit: p.u };
      case 'op':
        if (p.op === '-') return neg(this.unary());
        throw new CalcError('syntax');
      default:
        throw new CalcError('syntax');
    }
  }

  aggregate(name: 'sum' | 'avg' | 'prev' | 'min' | 'max' | 'count', from?: Value[]): Value {
    if (name !== 'prev') this.usedAggregate = true;
    const sec = !from && this.scope.section ? this.scope.sections?.get(this.scope.section) : undefined;
    const g = (from ?? (sec && sec.values.length >= this.scope.group.length ? sectionValues(sec) : this.scope.group)).filter((v) => !v.date);
    if (name === 'prev') {
      if (!this.scope.prev) throw new CalcError('noprev');
      return { ...this.scope.prev };
    }
    if (name === 'count') return { n: g.length };
    if (!g.length) return { n: 0 };
    // soma na dimensão mais frequente do bloco (horas com horas, dinheiro com dinheiro)
    const dims = new Map<string, number>();
    for (const v of g) dims.set(v.unit?.dim ?? "-", (dims.get(v.unit?.dim ?? "-") ?? 0) + 1);
    const dim = [...dims.entries()].sort((a, b) => b[1] - a[1] || (a[0] === '-' ? 1 : -1))[0][0];
    const base = g.find((v) => (v.unit?.dim ?? '-') === dim) ?? g[0];
    let acc: Value = { n: 0, unit: base.unit };
    let count = 0;
    const each: Value[] = [];
    for (const v of g) {
      if ((v.unit?.dim ?? '-') !== dim && v.unit && base.unit) continue;
      // num total em dinheiro (ou outra unidade), números soltos e percentuais ficam de fora
      if (dim !== '-' && (!v.unit || v.pct)) continue;
      try {
        acc = add(acc, v.pct ? { n: v.n } : v, 1, this.ctx);
        each.push(add({ n: 0, unit: base.unit }, v.pct ? { n: v.n } : v, 1, this.ctx));
        count++;
      } catch {
        /* valores incompatíveis ficam fora do total */
      }
    }
    if (name === 'avg') return { ...acc, n: count ? acc.n / count : 0 };
    if ((name === 'max' || name === 'min') && each.length) {
      // despesas lançadas como negativas: "maior gasto" é o de maior valor absoluto
      const allNeg = each.every((v) => v.n <= 0);
      const key = (v: Value) => (allNeg ? Math.abs(v.n) : v.n);
      return each.reduce((a, b) => ((name === 'max' ? key(b) > key(a) : key(b) < key(a)) ? b : a));
    }
    return acc;
  }

  callUser(name: string, args: Value[]): Value {
    if (this.depth > 24) throw new CalcError('recursion');
    const f = this.scope.funcs.get(name)!;
    const vars = new Map(this.scope.vars);
    f.params.forEach((p, i) => vars.set(fold(p), args[i] ?? { n: 0 }));
    const sub: Scope = { ...this.scope, vars };
    const { toks } = resolve(rawLex(f.body, this.ctx), this.ctx, sub);
    return new Parser(toks, this.ctx, sub, this.depth + 1).parse();
  }
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('domain');
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const gcd2 = (a: number, b: number): number => (b ? gcd2(b, a % b) : Math.abs(a));

/** Taxa: porcentagem (1,5%) ou número (1,5 = 1,5% quando ≥ 1; 0,015 quando < 1). */
function rateOf(v: Value): number {
  if (v.pct) return v.n;
  return Math.abs(v.n) >= 1 ? v.n / 100 : v.n;
}

function callFunc(name: string, a: Value[], ctx: EvalContext): Value {
  const x = a[0] ?? { n: 0 };
  const toRad = (v: Value) => (v.unit?.dim === 'angle' ? v.n * v.unit.factor : ctx.angle === 'deg' ? (v.n * Math.PI) / 180 : v.n);
  const fromRad = (r: number): Value => (ctx.angle === 'deg' ? { n: (r * 180) / Math.PI, unit: unitById('deg') } : { n: r, unit: unitById('rad') });
  const keep = (n: number): Value => ({ ...x, n });
  switch (name) {
    case 'sqrt':
      if (x.n < 0) throw new CalcError('domain');
      if (x.unit?.dim === 'area') {
        const u = x.unit;
        return { n: Math.sqrt(x.n * u.factor), unit: unitById('m') };
      }
      return { n: Math.sqrt(x.n) };
    case 'cbrt':
      return { n: Math.cbrt(x.n) };
    case 'root':
      return { n: Math.pow(x.n, 1 / (a[1]?.n ?? 2)) };
    case 'abs':
      return keep(Math.abs(x.n));
    case 'round': {
      const d = a[1]?.n ?? 0;
      const f = Math.pow(10, d);
      return keep(Math.round(x.n * f) / f);
    }
    case 'ceil':
      return keep(Math.ceil(x.n));
    case 'floor':
      return keep(Math.floor(x.n));
    case 'trunc':
      return keep(Math.trunc(x.n));
    case 'sin':
      return { n: Math.sin(toRad(x)) };
    case 'cos':
      return { n: Math.cos(toRad(x)) };
    case 'tan':
      return { n: Math.tan(toRad(x)) };
    case 'asin':
      return fromRad(Math.asin(x.n));
    case 'acos':
      return fromRad(Math.acos(x.n));
    case 'atan':
      return fromRad(Math.atan(x.n));
    case 'log':
      if (a[1]) return { n: Math.log(x.n) / Math.log(a[1].n) };
      return { n: Math.log10(x.n) };
    case 'log2':
      return { n: Math.log2(x.n) };
    case 'ln':
      return { n: Math.log(x.n) };
    case 'exp':
      return { n: Math.exp(x.n) };
    case 'fact':
      return { n: factorial(x.n) };
    case 'hypot':
      return { n: Math.hypot(...a.map((v) => v.n)) };
    case 'gcd':
      return { n: a.map((v) => v.n).reduce(gcd2) };
    case 'lcm':
      return { n: a.map((v) => v.n).reduce((p, q) => Math.abs(p * q) / gcd2(p, q)) };
    case 'random': {
      const lo = a.length > 1 ? a[0].n : 0;
      const hi = a.length > 1 ? a[1].n : a.length ? a[0].n : 1;
      return { n: a.length ? Math.floor(lo + Math.random() * (hi - lo + 1)) : Math.random() };
    }
    case 'clamp':
      return keep(Math.min(Math.max(x.n, a[1]?.n ?? -Infinity), a[2]?.n ?? Infinity));
    case 'min':
    case 'max':
    case 'sum':
    case 'avg': {
      if (!a.length) return { n: 0 };
      const u = a.find((v) => v.unit)?.unit;
      const vals = a.map((v) => (u && v.unit ? convert(v, u, ctx).n : v.n));
      const n = name === 'min' ? Math.min(...vals) : name === 'max' ? Math.max(...vals) : vals.reduce((p, q) => p + q, 0) / (name === 'avg' ? vals.length : 1);
      return { n, unit: u };
    }
    case 'pmt': {
      // parcela fixa (Tabela Price): pmt(taxa; períodos; valor)
      const r = rateOf(a[0] ?? { n: 0 });
      const n = a[1]?.n ?? 1;
      const pv = a[2] ?? { n: 0 };
      const p = r === 0 ? pv.n / n : (pv.n * r) / (1 - Math.pow(1 + r, -n));
      return { n: p, unit: pv.unit };
    }
    case 'fv': {
      // valor futuro: fv(taxa; períodos; aporte; valor inicial)
      const r = rateOf(a[0] ?? { n: 0 });
      const n = a[1]?.n ?? 1;
      const pmt = a[2] ?? { n: 0 };
      const pv = a[3] ?? { n: 0 };
      const g = Math.pow(1 + r, n);
      const f = pv.n * g + (r === 0 ? pmt.n * n : (pmt.n * (g - 1)) / r);
      return { n: f, unit: pmt.unit ?? pv.unit };
    }
    case 'pv': {
      const r = rateOf(a[0] ?? { n: 0 });
      const n = a[1]?.n ?? 1;
      const pmt = a[2] ?? { n: 0 };
      const v = r === 0 ? pmt.n * n : (pmt.n * (1 - Math.pow(1 + r, -n))) / r;
      return { n: v, unit: pmt.unit };
    }
  }
  throw new CalcError('nofunc', name);
}

// --------------------------------------------------------------- documento

export type LineKind = 'empty' | 'header' | 'comment' | 'value' | 'text' | 'error' | 'def' | 'command';

/** Linha de comando da IA: "/ia pergunta" (também /ai). */
export const AI_COMMAND = /^(\s*)(\/(?:ia|ai))(\s+.*)?$/i;

export interface LineResult {
  kind: LineKind;
  value?: Value;
  error?: string;
  segments: Segment[];
  label?: string;
  /** nome da variável atribuída nesta linha */
  assigned?: string;
  /** a linha é um total/média (não entra no total seguinte) */
  aggregate?: boolean;
  /** conta à parte com outros lançamentos/seções (rascunho, prova): não entra na seção */
  derived?: boolean;
  /** previsto × realizado: o valor da linha é o realizado; aqui o previsto (meta) */
  planned?: Value;
  /** tipo da seção em que a linha está (para colorir o % executado) */
  sectionTone?: Tone;
  /** título de seção (#Receitas): nome exibido */
  section?: string;
  /** receita (verde) ou despesa (vermelho) */
  tone?: Tone;
  /** moeda deduzida do contexto ("Flora: 2.000" numa seção em reais) */
  inferred?: string;
  /** posição onde começa o valor literal/esperado — o Enter reescreve dali em diante */
  fill?: number;
  /** onde termina o valor (antes de "vence 10/12"); sem isso, vai até o fim da linha */
  fillEnd?: number;
  /** vencimento escrito na linha ("vence 10/12", "vence dia 5" = todo mês) */
  due?: { at: number; monthly: boolean };
}

export interface DocResult {
  lines: LineResult[];
  vars: Map<string, Value>;
}

const ASSIGN_RE = /^(\s*)((?:[\p{Extended_Pictographic}←-⯿☀-➿][️‍\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)*[\p{L}_][\p{L}\p{N}_ ]{0,40}?)(\s*=\s*)(?!=)(.+)$/u;
const FUNC_RE = /^(\s*)([\p{L}_][\p{L}\p{N}_]*)\(([^)]*)\)(\s*=\s*)(.+)$/u;
const LABEL_RE = /^(\s*)((?:[\p{Extended_Pictographic}←-⯿☀-➿][️‍\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)*[\p{L}][^:+*\/^=()\d]{0,58}?[^\s:]?)(:\s*)(.*)$/u;

/** emojis e símbolos decorativos: enfeitam a linha, mas ficam fora dos nomes de variáveis e seções */
const EMOJI_G = /[\p{Extended_Pictographic}←-⯿☀-➿️‍⃣\p{Emoji_Modifier}]/gu;
export const stripEmoji = (s: string) => s.replace(EMOJI_G, '').replace(/\s+/g, ' ').trim();

export interface DocState {
  vars: Map<string, Value>;
  funcs: Map<string, { params: string[]; body: string }>;
  lines: (Value | undefined)[];
  group: Value[];
  prev?: Value;
  sections: Map<string, Section>;
  /** títulos abertos por nível ("#", "##"…) para montar a hierarquia */
  heads?: { level: number; key: string }[];
  /** seção atual (chave) */
  section?: string;
  /** a linha anterior estava vazia */
  lastEmpty?: boolean;
}

export function newDocState(): DocState {
  return { vars: new Map(), funcs: new Map(), lines: [], group: [], sections: new Map() };
}

/** "#Receitas", "# Despesas do mês", "## Total:" → nome da seção */
const SECTION_RE = /^(?:#+(?:\s+|(?=[\p{Extended_Pictographic}\u2190-\u2BFF\u2600-\u27BF]))((?:[\p{Extended_Pictographic}←-⯿☀-➿][️‍\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)*[\p{L}_](?:[\p{L}\p{N}_ ]|-(?=\p{L}))*?(?:[\p{Extended_Pictographic}←-⯿☀-➿][️‍\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)*)|#([\p{L}_][\p{L}\p{N}_]*))\s*:?\s*$/u;
/** "Total #Receitas: R$ 6.000" ou "#Receitas - #Despesas = 5.700": conta à esquerda, valor esperado à direita */
const EXPECT_RE = /^(\s*)([^=:]*#[\p{L}_][^=:]*?)(\s*[=:]\s*)(.*)$/u;
/** "Sobra %", "Sobra % = xx %": percentual sobre as receitas */
const PCT_LINE_RE = /^(\s*)([\p{L}_][\p{L}\p{N}_ ]*?)(\s*%)(\s*(?:[=:].*)?)$/u;

/** "vence 10/12", "vencimento: 05/01/2027", "vence dia 5", "due 12/10", "vence el 10/12" */
const DUE_RE = /\s+(?:vence(?:\s+(?:em|no|dia|el))?|vencimento|venc\.?|vencimiento|vto\.?|due(?:\s+on)?)\s*:?\s*((?:dia\s+|day\s+|d[ií]a\s+)?\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?|\d{4}-\d{2}-\d{2})\s*$/i;

/** Data de vencimento a partir do texto (dd/mm, dd/mm/aaaa, aaaa-mm-dd ou "dia 5" = todo mês). */
export function parseDue(s: string, ctx: Pick<EvalContext, 'dateOrder' | 'now'>): { at: number; monthly: boolean } | null {
  const now = new Date(ctx.now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = s.trim().toLowerCase();
  const day = t.match(/^(?:dia|day|d[ií]a)?\s*(\d{1,2})$/);
  if (day) {
    const d = +day[1];
    if (d < 1 || d > 31) return null;
    let dt = new Date(now.getFullYear(), now.getMonth(), d);
    if (dt.getTime() < today) dt = new Date(now.getFullYear(), now.getMonth() + 1, d);
    return { at: dt.getTime(), monthly: true };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return { at: new Date(y, m - 1, d).getTime(), monthly: false };
  }
  const parts = t.split('/').map(Number);
  if (parts.length < 2) return null;
  let [a, b, y] = parts;
  const [d, m] = ctx.dateOrder === 'mdy' ? [b, a] : [a, b];
  if (!d || !m || d > 31 || m > 12) return null;
  if (y === undefined) {
    y = now.getFullYear();
    // "vence 05/01" em dezembro é do ano que vem
    if (new Date(y, m - 1, d).getTime() < today - 60 * 86400_000) y++;
  } else if (y < 100) y += 2000;
  return { at: new Date(y, m - 1, d).getTime(), monthly: false };
}

/** Soma de receitas e de despesas (todas as seções de cada tipo). */
function incomeExpense(st: DocState, ctx: EvalContext): { inc?: Value; exp?: Value; all?: Value } {
  let inc: Value | undefined;
  let exp: Value | undefined;
  let all: Value | undefined;
  const plus = (a: Value | undefined, b: Value) => (a ? add(a, b, 1, ctx) : b);
  for (const sec of st.sections.values()) {
    // subseções já estão somadas na seção-mãe
    if (!sec.values.length || (sec.parent && st.sections.has(sec.parent))) continue;
    try {
      const sum = aggregateValues(sectionValues(sec), 'sum', ctx);
      const abs = { ...sum, n: Math.abs(sum.n) };
      all = plus(all, abs);
      if (sec.tone === 'income') inc = plus(inc, abs);
      else if (sec.tone === 'expense') exp = plus(exp, abs);
    } catch {
      /* moedas sem cotação */
    }
  }
  return { inc, exp, all };
}

const BAL_RE = /^#?\s*(saldo|saldo final|total geral|resultado|balan[cç]o|balance|net|total)\s*:?\s*$/i;
const EXEC_RE = /^(%\s*(?:executad[oa]|exec\.?|executed|ejecutad[oa])|percentual\s+executad[oa]|executad[oa]\s*%|percent\s+executed)\s*:?\s*$/i;
const TODO_RE = /^(%\s*(?:a\s+executar|por\s+ejecutar|remaining|restante|to\s+execute)|percentual\s+a\s+executar|a\s+executar\s*%)\s*:?\s*$/i;

/** previsto e realizado somados (de uma seção, de um tipo ou de todas as seções com previsto) */
function plannedActual(st: DocState, ctx: EvalContext, pick: (s: Section, key: string) => boolean): { planned?: Value; actual?: Value } {
  let planned: Value | undefined;
  let actual: Value | undefined;
  for (const [key, sec] of st.sections) {
    if (!pick(sec, key) || !sec.planned?.length) continue;
    try {
      const p = aggregateValues(sec.planned.map((v) => ({ ...v, n: Math.abs(v.n) })), 'sum', ctx);
      const a = aggregateValues(sectionValues(sec), 'sum', ctx);
      planned = planned ? add(planned, p, 1, ctx) : p;
      actual = actual ? add(actual, a, 1, ctx) : a;
    } catch {
      /* moedas sem cotação */
    }
  }
  return { planned, actual };
}

const PVR_QUICK = /^(previsto|meta|or[cç]ado|planned|budget|presupuestado|realizado|executado|actual|spent|ejecutado|saldo a executar|a executar|remaining|por ejecutar|%\s*executad[oa]|%\s*a executar)\s+(?:d[aeo]s?\s+|of\s+|de\s+(?:l[ao]s\s+)?)?(#?[\p{L}_][\p{L}\p{N}_ ]*)\s*:?\s*$/iu;

/** Linhas prontas: "Saldo", "#Total", "% Executado", "% A executar". */
function quickLine(t: string, st: DocState, ctx: EvalContext, afterEmpty: boolean): Omit<LineResult, 'segments'> | null {
  // "Previsto #Equipe", "Realizado das despesas", "Saldo a executar #Equipe", "% Executado despesas"
  const pq = PVR_QUICK.exec(t);
  if (pq) {
    const what = fold(pq[2].replace(/^#/, '').trim());
    const kind = classifyTerm(what);
    const { planned, actual } = plannedActual(st, ctx, (sec, key) => key === what || (!st.sections.has(what) && !!kind && sec.tone === kind && !sec.parent));
    if (planned && actual) {
      const w = fold(pq[1]);
      const value: Value = /^(previsto|meta|orcado|planned|budget|presupuestado)$/.test(w)
        ? planned
        : /^(realizado|executado|actual|spent|ejecutado)$/.test(w)
          ? actual
          : w.startsWith('%') && /a executar/.test(w)
            ? { n: planned.n ? 1 - actual.n / planned.n : 0, pct: true }
            : w.startsWith('%')
              ? { n: planned.n ? actual.n / planned.n : 0, pct: true }
              : add(planned, actual, -1, ctx);
      return { kind: 'value', value, label: t.replace(/:$/, ''), aggregate: true };
    }
  }
  const isExec = EXEC_RE.test(t);
  const isTodo = TODO_RE.test(t);
  const bal = BAL_RE.exec(t);
  if (!isExec && !isTodo && !bal) return null;
  const { inc, exp, all } = incomeExpense(st, ctx);
  if (isExec || isTodo) {
    const pv = plannedActual(st, ctx, (sec) => sec.tone === 'expense' && !sec.parent);
    const pa = pv.planned ? pv : plannedActual(st, ctx, (sec) => !sec.parent);
    if (pa.planned && pa.actual && pa.planned.n) {
      const done = pa.actual.n / pa.planned.n;
      return { kind: 'value', value: { n: isExec ? done : 1 - done, pct: true }, label: t.replace(/:$/, ''), aggregate: true };
    }
    if (!inc || !exp || !inc.n) return null;
    const done = div(exp, inc, ctx).n;
    return { kind: 'value', value: { n: isExec ? done : 1 - done, pct: true }, label: t.replace(/:$/, ''), aggregate: true };
  }
  // "total" sozinho logo depois dos lançamentos é o total da seção (não o saldo)
  const word = bal![1].toLowerCase();
  if (word === 'total' && !t.startsWith('#') && !afterEmpty) return null;
  if (inc && exp) {
    const value = add(inc, exp, -1, ctx);
    return { kind: 'value', value, label: 'Saldo', aggregate: true, tone: value.n < 0 ? 'expense' : 'income' };
  }
  // sem receitas/despesas separadas: total geral de todas as seções
  if (t.startsWith('#') || word !== 'total' || st.sections.size > 1) {
    if (!all) return null;
    return { kind: 'value', value: all, label: 'Total', aggregate: true };
  }
  return null;
}

/** Moeda mais recente da seção atual (ou do bloco). */
function contextCurrency(st: DocState): string | undefined {
  const pool = [...(st.section ? st.sections.get(st.section)?.values ?? [] : []), ...st.group];
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].unit?.dim === 'money') return pool[i].unit!.currency;
  // seção de receitas/despesas ainda vazia: usa a moeda das outras seções
  const sec = st.section ? st.sections.get(st.section) : undefined;
  if (sec && sectionTone(sec.name)) {
    for (const other of [...st.sections.values()].reverse()) {
      const m = [...other.values].reverse().find((v) => v.unit?.dim === 'money');
      if (m) return m.unit!.currency;
    }
  }
  return undefined;
}

/** Base do percentual: a maior seção de receitas (ou a maior soma positiva). */
function incomeBase(st: DocState, ctx: EvalContext): Value | undefined {
  let best: Value | undefined;
  let bestIncome = false;
  for (const sec of st.sections.values()) {
    if (!sec.values.length) continue;
    const sum = aggregateValues(sectionValues(sec), 'sum', ctx);
    const income = (sectionTone(sec.name, sec.values) ?? sec.tone) === 'income';
    if (sum.n <= 0) continue;
    if (!best || (income && !bestIncome) || (income === bestIncome && sum.n > best.n)) {
      best = sum;
      bestIncome = income;
    }
  }
  return best;
}

/** Avalia uma linha mantendo o estado do documento (variáveis, grupo para totais etc.). */
export function evaluateLine(line: string, ctx: EvalContext, st: DocState): LineResult {
  const trimmed = line.trim();
  const push = (r: LineResult): LineResult => {
    st.lines.push(r.value);
    if (r.kind === 'empty' || r.kind === 'header') st.group = [];
    if (r.value && r.kind === 'value') {
      // quantidades ("pessoas: 2") não entram na soma de valores
      const qty = !r.value.unit && !!r.label && isQuantityLabel(r.label);
      if (!r.aggregate && !qty && !r.derived) {
        st.group.push(r.value);
        const sec = st.section ? st.sections.get(st.section) : undefined;
        // lançamentos com ":" ou com "=" contam na seção (percentuais e datas não)
        if (sec && !r.value.pct && !r.value.date) {
          // a seção e as seções-mãe ("## Equipe" soma também em "# Despesas")
          for (let s: Section | undefined = sec, guard = 0; s && guard < 8; s = s.parent ? st.sections.get(s.parent) : undefined, guard++) {
            s.values.push(r.value);
            if (r.planned) (s.planned ??= []).push(r.planned);
            s.tone = sectionTone(s.name, s.values) ?? s.inherit;
          }
        }
      }
      st.prev = r.value;
    }
    // cor: receitas em verde, despesas em vermelho
    if (r.kind === 'value' && r.value?.unit?.dim === 'money' && !r.tone) {
      const sec = st.section && !r.aggregate ? st.sections.get(st.section) : undefined;
      if (r.value.n < 0) r.tone = 'expense';
      else if (sec?.tone) r.tone = sec.tone;
    }
    return r;
  };
  if (!trimmed) {
    st.lastEmpty = true;
    return push({ kind: 'empty', segments: line ? [{ text: line, cls: 'text' }] : [] });
  }
  const afterEmpty = st.lastEmpty || st.lines.length === 0;
  st.lastEmpty = false;
  const quick = quickLine(trimmed, st, ctx, afterEmpty);
  if (quick) return push({ ...quick, segments: [{ text: line.match(/^\s*/)![0], cls: 'text' }, { text: trimmed, cls: 'label' }] });
  const smRaw = trimmed.match(SECTION_RE);
  // "#BRL" ou uma tag de moeda sozinha não é título
  const sm = smRaw && (smRaw[1] || !(findCurrency(smRaw[2]) || ctx.tags.some((t) => fold(t.name) === fold(smRaw[2])))) ? [smRaw[0], (smRaw[1] ?? smRaw[2]).trim()] : null;
  if (sm || /^#+(\s|$)/.test(trimmed)) {
    if (sm) {
      const name = stripEmoji(sm[1]);
      const key = fold(name);
      // título repetido continua a mesma seção
      const level = trimmed.match(/^#+/)![0].length;
      const heads = (st.heads ??= []);
      while (heads.length && heads[heads.length - 1].level >= level) heads.pop();
      const parentKey = heads.length && heads[heads.length - 1].key !== key ? heads[heads.length - 1].key : undefined;
      if (!st.sections.has(key)) {
        const inherit = parentKey ? st.sections.get(parentKey)?.tone : undefined;
        st.sections.set(key, { name, values: [], tone: sectionTone(name) ?? inherit, parent: parentKey, inherit });
      }
      heads.push({ level, key });
      st.section = key;
    } else st.section = undefined;
    const tone = sm ? st.sections.get(fold(stripEmoji(sm[1])))?.tone : undefined;
    return push({ kind: 'header', segments: [{ text: line, cls: 'hdr' }], section: sm?.[1].trim(), tone });
  }
  if (/^\/\//.test(trimmed)) return push({ kind: 'comment', segments: [{ text: line, cls: 'cmt' }] });
  const cmd = line.match(AI_COMMAND);
  if (cmd) {
    return push({ kind: 'command', segments: [{ text: cmd[1], cls: 'text' }, { text: cmd[2], cls: 'func' }, { text: cmd[3] ?? '', cls: 'kw' }] });
  }

  const scope: Scope = { vars: st.vars, funcs: st.funcs, group: st.group, prev: st.prev, lines: st.lines, sections: st.sections, section: st.section };

  // "Sobra %": percentual de um valor (ou da linha anterior) sobre as receitas
  const pm = line.match(PCT_LINE_RE);
  // só o atalho "Sobra %" (ou "Sobra % = 66%"); se depois do ":" vier uma conta, é rótulo comum
  if (pm && /^\s*(?:[=:]\s*[\d.,\sxX%?]*)?$/.test(pm[4]) && !findUnit(pm[2].trim()) && (st.vars.has(fold(pm[2].trim())) || st.prev)) {
    const v = st.vars.get(fold(pm[2].trim())) ?? st.prev!;
    const base = incomeBase(st, ctx);
    const segments: Segment[] = [
      { text: pm[1], cls: 'text' },
      { text: pm[2], cls: 'label' },
      { text: pm[3], cls: 'op' },
      { text: pm[4], cls: 'ghost' },
    ];
    if (!base) return push({ kind: 'text', segments });
    try {
      const value: Value = { n: div({ ...v, pct: false }, base, ctx).n, pct: true };
      const fill = pm[4].trim() ? pm[1].length + pm[2].length + pm[3].length + (pm[4].match(/^\s*[=:]\s*/)?.[0].length ?? 0) : undefined;
      return push({ kind: 'value', value, segments, label: pm[2].trim(), fill, aggregate: true });
    } catch {
      return push({ kind: 'error', error: 'incompatible', segments });
    }
  }

  const pre: Segment[] = [];
  let body = line;
  let label: string | undefined;
  let assign: string | undefined;

  const fm = line.match(FUNC_RE);
  if (fm && !findUnit(fm[2]) && !FUNCS.has(fold(fm[2]))) {
    const params = fm[3].split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    st.funcs.set(fold(fm[2]), { params, body: fm[5] });
    const local = new Map(st.vars);
    params.forEach((p) => local.set(fold(p), { n: 0 }));
    const { segs } = resolve(rawLex(fm[5], ctx), ctx, { ...scope, vars: local });
    return push({
      kind: 'def',
      segments: [{ text: fm[1], cls: 'text' }, { text: fm[2], cls: 'func' }, { text: `(${fm[3]})`, cls: 'var' }, { text: fm[4], cls: 'op' }, ...segs],
    });
  }

  let fill: number | undefined;
  const tp = line.match(/^(\s*)(#\s*(?:total|saldo|subtotal|resultado|balan[cç]o)\b\s*:?\s*)(\S.*)$/i);
  if (tp) {
    // "#Total (#Receitas - #Despesas)", "#Total #Receitas - #Despesas"
    label = tp[2].replace(/[#:]/g, '').trim();
    label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    pre.push({ text: tp[1], cls: 'text' }, { text: tp[2], cls: 'label' });
    body = tp[3];
  }
  const xm = tp ? null : line.match(EXPECT_RE);
  const refsSection = xm && [...xm[2].matchAll(/#([\p{L}\p{N}_]+)/gu)].some((m) => st.sections.has(fold(m[1])));
  const am = refsSection ? null : line.match(ASSIGN_RE);
  if (xm && refsSection) {
    // a conta está à esquerda; o que vem depois do "=" ou ":" é só o valor esperado
    body = xm[1] + xm[2];
    fill = xm[1].length + xm[2].length + xm[3].length;
  } else if (tp) {
    /* já tratado */
  } else if (am && !/^\s*\d/.test(am[2])) {
    assign = fold(stripEmoji(am[2]));
    pre.push({ text: am[1], cls: 'text' }, { text: am[2], cls: 'assign' }, { text: am[3], cls: 'op' });
    body = am[4];
  } else {
    const lm = line.match(LABEL_RE);
    if (lm && lm[4].trim()) {
      label = stripEmoji(lm[2]) || lm[2].trim();
      pre.push({ text: lm[1], cls: 'text' }, { text: lm[2] + lm[3], cls: 'label' });
      body = lm[4];
    }
  }

  // rótulo implícito: "incentivo de 100 mil reais", "Coordenador 10 mil reais vezes 6 meses"
  if (!label && !assign && !tp && !(xm && refsSection)) {
    const im = body.match(/^\s*((?:[\p{Extended_Pictographic}\u2600-\u27BF]\uFE0F?\s*)*[\p{L}][\p{L}'’ -]{0,48}?)\s+(?:(?:de|do|da|dos|das|no|na|of|for|por)\s+)?(?=R\$|US\$|€|£|\$|\d)/u);
    if (im) {
      const cand = stripEmoji(im[1]).trim();
      const first = fold(cand.split(/\s+/)[0]);
      const known = KW[first] || EXACT[cand.toLowerCase()] || FUNCS.has(first) || findUnit(cand) || findCurrency(cand) || st.vars.has(fold(cand)) || st.sections.has(fold(cand)) || /^(total|subtotal|soma|saldo|sobra|media|média|maior|menor|hoje|amanha|ontem)$/i.test(first);
      if (!known && cand.length >= 2) label = cand;
    }
  }
  // "Luz: R$ 150 vence 10/12", "Aluguel: R$ 1.800 vence dia 5": data de vencimento (vira lembrete)
  const bodyStart = line.length - body.length;
  let due: LineResult['due'];
  let dueText = '';
  if (!(xm && refsSection)) {
    const dm = body.match(DUE_RE);
    if (dm && dm.index && dm.index > 0) {
      const d = parseDue(dm[1], ctx);
      if (d) {
        due = d;
        dueText = dm[0];
        body = body.slice(0, dm.index);
      }
    }
  }
  // previsto × realizado: "Cachê: R$ 5.000 | R$ 4.200" ou "Cachê: previsto R$ 5.000 realizado R$ 4.200"
  let planned: Value | undefined;
  if ((label || assign) && !(xm && refsSection) && !tp) {
    const pw = body.match(/^(\s*(?:previsto|meta|or[cç]ado|planned|budget|presupuestado)\s*:?\s*)(.*?\S)(\s+(?:realizado|executado|gasto|actual|spent|real|ejecutado)\s*:?\s*)(\S.*)$/iu);
    const pp = pw ? null : body.match(/^(\s*)([^|]*?\S)(\s*\|\s*)([^|]*\S.*)$/);
    const parts = pw ?? pp;
    if (parts) {
      try {
        const left = resolve(rawLex(parts[2], ctx), ctx, scope);
        if (left.toks.length && left.toks.some((t) => ['num', 'var', 'const', 'cur'].includes(t.k))) {
          planned = new Parser(left.toks, ctx, scope).parse();
          pre.push({ text: parts[1], cls: pw ? 'kw' : 'text' }, ...left.segs, { text: parts[3], cls: pw ? 'kw' : 'op' });
          body = parts[4];
        }
      } catch {
        planned = undefined;
      }
    }
  }
  const { toks, segs } = resolve(rawLex(body, ctx), ctx, scope);
  const segments = [...pre, ...segs];
  if (dueText) segments.push({ text: dueText, cls: 'date' });
  if (xm && refsSection) segments.push({ text: xm[3], cls: 'op' }, { text: xm[4], cls: 'ghost' });
  if (!toks.length) return push({ kind: 'text', segments, label });
  // linha só de texto com palavras-chave soltas (sem número nem variável) não gera resultado
  if (!toks.some((t) => ['num', 'var', 'const', 'dateLit', 'date', 'agg', 'line', 'func', 'ufunc', 'cur', 'section'].includes(t.k))) {
    return push({ kind: 'text', segments, label });
  }
  try {
    const parser = new Parser(toks, ctx, scope);
    const value = parser.parse();
    if (!isFinite(value.n) && !Number.isNaN(value.n) && !value.date) {
      /* infinito é exibido */
    }
    if (Number.isNaN(value.n)) throw new CalcError('domain');
    // linha de lançamento só com número: a moeda vem do contexto ("Flora: 2.000" entre valores em R$),
    // mas quantidades ("pessoas: 2", "dias: 8") continuam números
    let inferred: string | undefined;
    const literal = toks.every((t) => t.k === 'num' || t.k === 'cur' || (t.k === 'op' && t.op === '-'));
    if (literal && label && !value.unit && !value.pct && !value.date && !value.fmt && !isQuantityLabel(label)) {
      const code = contextCurrency(st);
      if (code) {
        value.unit = currencyUnit(code);
        inferred = code;
      }
    }
    if (literal && toks.some((t) => t.k === 'num') && value.unit?.dim === 'money' && fill === undefined) {
      fill = bodyStart + (body.length - body.trimStart().length);
    }
    if (planned) {
      if (!planned.unit && value.unit) planned.unit = value.unit;
      if (value.unit && planned.unit && value.unit !== planned.unit && value.unit.dim !== planned.unit.dim) planned = undefined;
    }
    if (assign) st.vars.set(assign, value);
    // rótulos também viram variáveis ("Aluguel: 1.500" → "Aluguel * 12")
    else if (label && !findUnit(label) && !KW[fold(label)]) st.vars.set(fold(label), value);
    if (refsSection && !label) label = xm![2].trim();
    const secToks = toks.filter((t): t is { k: 'section'; name: string } => t.k === 'section');
    const tone = secToks.length === 1 && toks.filter((t) => t.k !== 'agg').length === 1 ? st.sections.get(secToks[0].name)?.tone : undefined;
    return push({ kind: 'value', value, segments, label: label ?? (assign ? stripEmoji(am![2]) : undefined), assigned: assign, tone, due, fillEnd: dueText ? line.length - dueText.length : undefined, derived: toks.some((t) => t.k === 'section' || t.k === 'line' || (t.k === 'var' && st.vars.get(t.name)?.unit?.dim === 'money')), aggregate: parser.usedAggregate || (!!label && /^(total|subtotal|soma|sum|m[eé]dia|average|promedio|saldo|sobra|resultado)\b/i.test(label)), inferred, fill: planned ? undefined : fill, planned, sectionTone: planned && st.section ? st.sections.get(st.section)?.tone : undefined });
  } catch (e) {
    const code = e instanceof CalcError ? e.code + (e.detail ? `:${e.detail}` : '') : 'syntax';
    return push({ kind: 'error', error: code, segments, label });
  }
}

/** Avalia um texto inteiro (várias linhas). */
export function evaluateDocument(text: string, ctx: EvalContext, st: DocState = newDocState()): DocResult {
  const lines = text.split('\n').map((l) => evaluateLine(l, ctx, st));
  return { lines, vars: st.vars };
}

/** Moedas usadas no texto (para buscar só as cotações necessárias). */
export function currenciesIn(text: string, ctx: EvalContext): Set<string> {
  const out = new Set<string>();
  const st = newDocState();
  for (const line of text.split('\n')) {
    const { toks } = resolve(rawLex(line, ctx), ctx, { vars: st.vars, funcs: st.funcs, group: [], lines: [], sections: st.sections });
    for (const t of toks) if (t.k === 'cur') out.add(t.code);
  }
  return out;
}

/** Total/média de uma lista de valores, somando na dimensão mais frequente. */
export function aggregateValues(values: Value[], name: 'sum' | 'avg', ctx: EvalContext): Value {
  const p = new Parser([], ctx, { vars: new Map(), funcs: new Map(), group: values, lines: [] });
  return p.aggregate(name);
}

/** Valores convertidos para a dimensão/unidade mais frequente (para gráficos). */
export function commonValues(items: { label: string; value: Value }[], ctx: EvalContext): { label: string; n: number; value: Value }[] {
  const vals = items.filter((x) => !x.value.date);
  if (!vals.length) return [];
  const dims = new Map<string, number>();
  for (const x of vals) dims.set(x.value.unit?.dim ?? '-', (dims.get(x.value.unit?.dim ?? '-') ?? 0) + 1);
  const dim = [...dims.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const base = vals.find((x) => (x.value.unit?.dim ?? '-') === dim)!.value.unit;
  const out: { label: string; n: number; value: Value }[] = [];
  for (const x of vals) {
    if ((x.value.unit?.dim ?? '-') !== dim) continue;
    try {
      const v = base && x.value.unit ? convert(x.value, base, ctx) : x.value;
      out.push({ label: x.label, n: v.pct ? v.n * 100 : v.n, value: v });
    } catch {
      /* sem cotação: fica fora do gráfico */
    }
  }
  return out;
}
