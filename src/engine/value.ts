/**
 * Valores, operações aritméticas com unidades/moedas/porcentagens e formatação.
 */
import { combine, unitById, unitForFactor, type Unit } from './units';
import { currencyInfo } from './currencies';

export type NumFormat = 'hex' | 'bin' | 'oct' | 'sci' | 'words';

export interface Value {
  n: number;
  unit?: Unit;
  /** porcentagem: n é a fração (0,2 = 20%) */
  pct?: boolean;
  /** data: n é o instante em ms */
  date?: boolean;
  fmt?: NumFormat;
}

export class CalcError extends Error {
  constructor(
    public code: string,
    public detail = '',
  ) {
    super(code + (detail ? `:${detail}` : ''));
  }
}

/** Etiqueta personalizada de moeda: apelido de um código ou moeda própria com cotação manual. */
export interface CurrencyTag {
  id: string;
  name: string;
  /** apelido: aponta para um código ISO (ex.: "verdinha" → USD) */
  alias?: string;
  /** moeda própria: 1 tag = rate × of (ex.: 1 milha = 0,02 BRL) */
  rate?: number;
  of?: string;
  symbol?: string;
}

export interface EvalContext {
  decimal: 'comma' | 'dot';
  lang: 'pt' | 'en' | 'es';
  /** cotações: unidades da moeda por 1 USD */
  rates: Record<string, number>;
  tags: CurrencyTag[];
  /** moeda que o "$" representa */
  dollar: string;
  angle: 'deg' | 'rad';
  dateOrder: 'dmy' | 'mdy';
  now: number;
  precision: number;
  currencyPosition: 'before' | 'after';
  /** milhares agrupados na exibição */
  grouping: boolean;
}

export const defaultContext = (o: Partial<EvalContext> = {}): EvalContext => ({
  decimal: 'comma',
  lang: 'pt',
  rates: {},
  tags: [],
  dollar: 'USD',
  angle: 'deg',
  dateOrder: 'dmy',
  now: Date.now(),
  precision: 6,
  currencyPosition: 'before',
  grouping: true,
  ...o,
});

// ---------------------------------------------------------------- moedas

const curUnits = new Map<string, Unit>();

/** Unidade de moeda (código ISO ou tag). O fator é aplicado na hora, pelas cotações. */
export function currencyUnit(code: string): Unit {
  let u = curUnits.get(code);
  if (!u) {
    u = { id: 'cur:' + code, dim: 'money', factor: 1, symbol: code, names: [], currency: code };
    curUnits.set(code, u);
  }
  return u;
}

/** Quantos dólares vale 1 unidade da moeda (ou tag). */
export function usdPer(code: string, ctx: EvalContext, depth = 0): number {
  if (depth > 6) throw new CalcError('tag-loop', code);
  const tag = ctx.tags.find((t) => t.name.toLowerCase() === code.toLowerCase());
  if (tag) {
    if (tag.alias) return usdPer(tag.alias, ctx, depth + 1);
    if (tag.rate && tag.of) return tag.rate * usdPer(tag.of, ctx, depth + 1);
    throw new CalcError('norate', code);
  }
  if (code === 'USD') return 1;
  const r = ctx.rates[code];
  if (!r) throw new CalcError('norate', code);
  return 1 / r;
}

/** Converte entre moedas usando as cotações. */
export function convertMoney(n: number, from: string, to: string, ctx: EvalContext): number {
  if (from === to) return n;
  return (n * usdPer(from, ctx)) / usdPer(to, ctx);
}

// --------------------------------------------------------------- unidades

export function toBase(n: number, u: Unit) {
  return n * u.factor + (u.offset ?? 0);
}
export function fromBase(n: number, u: Unit) {
  return (n - (u.offset ?? 0)) / u.factor;
}

/** Converte o valor para a unidade/moeda `target` (mesma dimensão). */
export function convert(v: Value, target: Unit, ctx: EvalContext): Value {
  if (v.date) throw new CalcError('incompatible');
  if (!v.unit) return { ...v, unit: target, pct: false };
  if (v.unit.dim !== target.dim) throw new CalcError('incompatible', `${v.unit.symbol} → ${target.symbol}`);
  if (target.dim === 'money') return { n: convertMoney(v.n, v.unit.currency!, target.currency!, ctx), unit: target };
  return { n: fromBase(toBase(v.n, v.unit), target), unit: target };
}

const num = (n: number): Value => ({ n });

function sameDimAdd(a: Value, b: Value, sign: 1 | -1, ctx: EvalContext): Value {
  const ua = a.unit!;
  const ub = b.unit!;
  if (ua.dim !== ub.dim) throw new CalcError('incompatible', `${ua.symbol} ± ${ub.symbol}`);
  let bn: number;
  if (ua.dim === 'money') bn = convertMoney(b.n, ub.currency!, ua.currency!, ctx);
  else if (ua.dim === 'temp') bn = (b.n * ub.factor) / ua.factor; // diferença de temperatura
  else bn = (b.n * ub.factor) / ua.factor;
  return { n: a.n + sign * bn, unit: ua };
}

// ------------------------------------------------------------- calendário

function addCalendar(ms: number, amount: number, unit: Unit): number {
  const d = new Date(ms);
  if ((unit.id === 'month' || unit.id === 'year') && Number.isInteger(amount)) {
    const months = unit.id === 'year' ? amount * 12 : amount;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.getTime();
  }
  return ms + amount * unit.factor * 1000;
}

// --------------------------------------------------------------- operações

export function add(a: Value, b: Value, sign: 1 | -1, ctx: EvalContext): Value {
  if (a.date && b.date) {
    if (sign === 1) throw new CalcError('incompatible');
    return { n: Math.round((a.n - b.n) / 86400000), unit: unitById('day') };
  }
  if (a.date) {
    if (!b.unit || b.unit.dim !== 'time') throw new CalcError('incompatible');
    return { n: addCalendar(a.n, sign * b.n, b.unit), date: true };
  }
  if (b.date) {
    if (sign === -1 || !a.unit || a.unit.dim !== 'time') throw new CalcError('incompatible');
    return { n: addCalendar(b.n, a.n, a.unit), date: true };
  }
  if (b.pct && !a.pct) return { ...a, n: a.n * (1 + sign * b.n), fmt: a.fmt };
  if (a.pct && b.pct) return { n: a.n + sign * b.n, pct: true };
  if (a.pct && !b.pct) return { ...b, n: sign === 1 ? b.n * (1 + a.n) : a.n - b.n };
  if (a.unit && b.unit) return { ...sameDimAdd(a, b, sign, ctx), fmt: a.fmt };
  if (a.unit) return { n: a.n + sign * b.n, unit: a.unit, fmt: a.fmt };
  if (b.unit) return { n: a.n + sign * b.n, unit: b.unit, fmt: a.fmt };
  return { n: a.n + sign * b.n, fmt: a.fmt ?? b.fmt };
}

export function mul(a: Value, b: Value, ctx: EvalContext): Value {
  if (a.date || b.date) throw new CalcError('incompatible');
  if (a.pct && b.pct) return { n: a.n * b.n, pct: true };
  if (a.pct) return { ...b, n: a.n * b.n };
  if (b.pct) return { ...a, n: a.n * b.n };
  if (a.unit && b.unit) {
    if (a.unit.dim === 'money' && b.unit.dim === 'money') throw new CalcError('incompatible');
    if (a.unit.dim === 'money') return { n: a.n * b.n, unit: a.unit };
    if (b.unit.dim === 'money') return { n: a.n * b.n, unit: b.unit };
    const c = combine('*', a.unit, b.unit);
    if (!c) throw new CalcError('incompatible', `${a.unit.symbol} × ${b.unit.symbol}`);
    const u = unitForFactor(c.dim, c.factor);
    return { n: (a.n * b.n * c.factor) / u.factor, unit: u };
  }
  return { n: a.n * b.n, unit: a.unit ?? b.unit, fmt: a.fmt ?? b.fmt };
}

export function div(a: Value, b: Value, ctx: EvalContext): Value {
  if (a.date || b.date) throw new CalcError('incompatible');
  if (b.n === 0) throw new CalcError('div0');
  if (a.pct && b.pct) return { n: a.n / b.n };
  if (b.pct) return { ...a, n: a.n / b.n };
  if (a.unit && b.unit) {
    if (a.unit.dim === b.unit.dim) {
      const bb = convert(b, a.unit, ctx);
      return num(a.n / bb.n);
    }
    if (a.unit.dim === 'money') return { n: a.n / b.n, unit: a.unit };
    const c = combine('/', a.unit, b.unit);
    if (!c) throw new CalcError('incompatible', `${a.unit.symbol} ÷ ${b.unit.symbol}`);
    const u = unitForFactor(c.dim, c.factor);
    return { n: ((a.n / b.n) * c.factor) / u.factor, unit: u };
  }
  if (b.unit) throw new CalcError('incompatible');
  return { n: a.n / b.n, unit: a.unit, pct: a.pct, fmt: a.fmt };
}

export function pow(a: Value, b: Value): Value {
  if (b.unit || b.date || a.date) throw new CalcError('incompatible');
  const n = Math.pow(a.n, b.n);
  if (a.unit && a.unit.dim === 'length' && (b.n === 2 || b.n === 3)) {
    const f = Math.pow(a.unit.factor, b.n);
    const u = unitForFactor(b.n === 2 ? 'area' : 'volume', f);
    return { n: (n * f) / u.factor, unit: u };
  }
  if (a.unit && b.n !== 1) return { n };
  return { n, unit: a.unit, fmt: a.fmt };
}

export function neg(a: Value): Value {
  return { ...a, n: -a.n };
}

// ---------------------------------------------------------------- formato

export interface FormatOptions {
  decimal: 'comma' | 'dot';
  grouping: boolean;
  precision: number;
  lang: 'pt' | 'en' | 'es';
  currencyPosition: 'before' | 'after';
  tags?: CurrencyTag[];
}

export function formatNumber(n: number, o: Pick<FormatOptions, 'decimal' | 'grouping'>, maxDec: number, minDec = 0): string {
  if (!isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  const dec = o.decimal === 'comma' ? ',' : '.';
  const grp = o.decimal === 'comma' ? '.' : ',';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < Math.pow(10, -Math.max(maxDec, 1)) * 0.5)) {
    return n.toExponential(Math.min(maxDec, 6)).replace('.', dec).replace(/\.?0+e/, 'e').replace(/,?0+e/, 'e');
  }
  let s = abs.toFixed(Math.max(0, Math.min(maxDec, 20)));
  if (s.includes('.')) {
    s = s.replace(/0+$/, '');
    const [i, f = ''] = s.split('.');
    const frac = f.padEnd(minDec, '0');
    s = frac ? `${i}.${frac}` : i;
  } else if (minDec > 0) s = `${s}.${'0'.repeat(minDec)}`;
  let [int, frac] = s.split('.');
  if (o.grouping && int.length > 3) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, grp);
  const out = frac ? `${int}${dec}${frac}` : int;
  return (n < 0 && out !== '0' ? '-' : '') + out;
}

const DATE_LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;

/** Exibe símbolo da moeda: R$, US$, €, ou o nome da tag. */
export function currencySymbol(code: string, o: Pick<FormatOptions, 'lang' | 'tags'>): string {
  const tag = o.tags?.find((t) => t.name === code);
  if (tag) return tag.symbol || tag.name;
  const info = currencyInfo(code);
  if (!info) return code;
  if (code === 'USD' && o.lang === 'en') return '$';
  return info.symbol;
}

export function formatValue(v: Value, o: FormatOptions): string {
  if (v.date) {
    const d = new Date(v.n);
    const hasTime = d.getHours() || d.getMinutes();
    return d.toLocaleDateString(DATE_LOCALE[o.lang], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
  }
  if (v.fmt === 'hex' || v.fmt === 'bin' || v.fmt === 'oct') {
    const n = Math.round(v.n);
    const p = v.fmt === 'hex' ? '0x' : v.fmt === 'bin' ? '0b' : '0o';
    const s = Math.abs(n).toString(v.fmt === 'hex' ? 16 : v.fmt === 'bin' ? 2 : 8).toUpperCase();
    return (n < 0 ? '-' : '') + p + s;
  }
  if (v.fmt === 'sci') return v.n.toExponential(Math.min(o.precision, 8)).replace('.', o.decimal === 'comma' ? ',' : '.');
  if (v.pct) return formatNumber(v.n * 100, o, Math.min(o.precision, 4)) + '%';
  if (v.unit?.dim === 'money') {
    const code = v.unit.currency!;
    const info = currencyInfo(code);
    const decimals = info?.decimals ?? 2;
    const isTag = !!o.tags?.find((t) => t.name === code);
    const small = Math.abs(v.n) > 0 && Math.abs(v.n) < 0.01;
    const s = formatNumber(v.n, o, small ? Math.max(decimals, 6) : decimals, info?.crypto || isTag ? 0 : decimals);
    const sym = currencySymbol(code, o);
    const letters = /^[A-Za-z]{2,}$/.test(sym) || info?.crypto || isTag;
    if (letters) return `${s} ${sym}`;
    if (o.currencyPosition === 'after') return `${s} ${sym}`;
    if (sym === '$' || sym === '£' || sym === '€') return o.lang === 'en' ? `${s.startsWith('-') ? '-' : ''}${sym}${s.replace(/^-/, '')}` : `${sym} ${s}`;
    return `${sym} ${s}`;
  }
  const s = formatNumber(v.n, o, o.precision);
  if (v.unit) return `${s} ${v.unit.symbol}`;
  return s;
}

/** Valor numérico simples, para copiar (sem separador de milhar). */
export function plainNumber(v: Value, o: Pick<FormatOptions, 'decimal' | 'precision'>): string {
  if (v.date) return new Date(v.n).toISOString().slice(0, 10);
  const n = v.pct ? v.n * 100 : v.n;
  return formatNumber(n, { decimal: o.decimal, grouping: false }, v.unit?.dim === 'money' ? 2 : o.precision);
}
