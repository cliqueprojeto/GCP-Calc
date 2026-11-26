/**
 * Modelo comum de exportação: a nota avaliada, com resultados formatados e
 * os elementos gráficos já prontos para PDF, Word, PowerPoint e Excel.
 */
import { useData } from '../store/data';
import { compareRows, noteFigures } from '../lib/compare';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons } from 'lucide-react';
import type { LineKind, Segment } from '../engine/evaluate';
import { convert, currencyUnit, formatValue, type EvalContext, type FormatOptions, type Value } from '../engine/value';
import { chartDataFor, evaluateNote } from '../lib/noteEval';
import type { ChartKind, Lang, Note } from '../lib/types';
import { LOCALES } from '../i18n';
import { mix, screenPalette, type ScreenPalette } from '../lib/colors';
import { aggregateValues } from '../engine/evaluate';

/** Paleta de impressão (fundo branco), estilo editor de código claro. */
export const PRINT = {
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  zebra: '#f8fafc',
  syn: {
    num: '#c2410c',
    unit: '#0369a1',
    cur: '#15803d',
    op: '#be185d',
    var: '#a16207',
    assign: '#a16207',
    func: '#6d28d9',
    kw: '#1d4ed8',
    cmt: '#94a3b8',
    hdr: '#0f172a',
    label: '#3730a3',
    text: '#475569',
    date: '#9d174d',
    tag: '#0f766e',
    paren: '#be185d',
  } as Record<string, string>,
  chart: ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'],
};

export interface XLine {
  text: string;
  segments: Segment[];
  kind: LineKind;
  result?: string;
  value?: Value;
  label?: string;
  assigned?: string;
  aggregate?: boolean;
}

export interface XChartDatum {
  label: string;
  n: number;
  text: string;
}

export type XBlock =
  | { type: 'calc'; lines: XLine[] }
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { type: 'chart'; kind: ChartKind; title: string; data: XChartDatum[]; png?: string; w: number; h: number }
  | { type: 'callout'; text: string; color: string; iconPng: string }
  | { type: 'progress'; label: string; valueText: string; goalText: string; value?: number; goal?: number; pct: number; color: string }
  | { type: 'sum'; sum: string; avg: string; count: number }
  | { type: 'ticker'; base: string; rows: { code: string; text: string }[] }
  | { type: 'image'; src: string; caption: string; width: number; w: number; h: number }
  | { type: 'divider' }
  | { type: 'sticker'; png: string; size: number; align: 'left' | 'center' | 'right' };

export interface XDoc {
  title: string;
  color: string;
  iconPng: string;
  date: string;
  lang: Lang;
  blocks: XBlock[];
  note: Note;
  pal: ScreenPalette;
}

// ------------------------------------------------------------------ imagens

export function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const g = c.getContext('2d')!;
      g.scale(scale, scale);
      g.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

const isEmoji = (s: string) => !/^[A-Za-z0-9]+$/.test(s);

/** Ícone Lucide (ou emoji) como PNG transparente. */
export async function iconPng(name: string, color: string, size = 64): Promise<string> {
  if (isEmoji(name)) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const g = c.getContext('2d')!;
    g.font = `${size * 1.5}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, size, size * 1.08);
    return c.toDataURL('image/png');
  }
  const C = icons[name as keyof typeof icons] ?? icons.Calculator;
  let svg = renderToStaticMarkup(createElement(C, { size, color, strokeWidth: 2 }));
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return svgToPng(svg, size, size, 2);
}

export function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = src;
  });
}

/** Cor clara a partir de uma cor (mistura com branco). */
export function tint(hex: string, amount = 0.88): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '#f1f5f9';
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return '#' + [mix(r), mix(g), mix(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ----------------------------------------------------------------- gráficos

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Estilo de documento igual à tela: fundo, cartões, textos e sintaxe do tema atual. */
export interface DocStyle {
  dark: boolean;
  bg: string;
  card: string;
  card2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  res: string;
  zebra: string;
  syn: Record<string, string>;
  chart: string[];
}

export function docStyle(pal: ScreenPalette): DocStyle {
  return {
    dark: pal.dark,
    bg: pal.bg,
    card: pal.panel,
    card2: pal.panel2,
    border: pal.border,
    text: pal.text,
    muted: pal.muted,
    accent: pal.accent,
    res: pal.syn.res,
    zebra: mix(pal.text, pal.panel, 0.035),
    syn: { ...pal.syn, hdr: pal.syn.hdr, cmt: pal.syn.cmt },
    chart: pal.chart,
  };
}

export interface ChartStyle {
  bg: string;
  text: string;
  muted: string;
  border: string;
  colors: string[];
}

/** Estilo de gráfico: igual à tela (tema atual) ou em fundo branco (Word/PowerPoint) com as cores da tela. */
export function chartStyle(pal: ScreenPalette, mode: 'screen' | 'print'): ChartStyle {
  return mode === 'screen'
    ? { bg: pal.panel, text: pal.text, muted: pal.muted, border: pal.border, colors: pal.chart }
    : { bg: '#ffffff', text: PRINT.text, muted: PRINT.muted, border: PRINT.border, colors: pal.chart };
}

/** Gráfico em SVG desenhado como na tela (barras arredondadas, valores em cima, legenda com %). */
export function chartSvg(kind: ChartKind, data: XChartDatum[], W: number, H: number, st: ChartStyle): string {
  const P = st.colors;
  const font = `font-family="Inter, Arial, sans-serif"`;
  const mono = `font-family="JetBrains Mono, Consolas, monospace"`;
  const parts: string[] = [];
  if (kind === 'pie' || kind === 'donut') {
    const pos = data.filter((d) => d.n > 0);
    const total = pos.reduce((a, d) => a + d.n, 0) || 1;
    const R = Math.min(H / 2 - 12, 150);
    const cx = R + 20;
    const cy = H / 2;
    const r = kind === 'donut' ? R * 0.6 : 0;
    let a0 = -Math.PI / 2;
    pos.forEach((d, i) => {
      const a1 = a0 + (d.n / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, ang: number) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
      const path =
        pos.length === 1
          ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} Z`
          : r
            ? `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`
            : `M ${cx} ${cy} L ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} Z`;
      parts.push(`<path d="${path}" fill="${P[i % P.length]}" stroke="${st.bg}" stroke-width="3"/>`);
      a0 = a1;
    });
    if (kind === 'donut') parts.push(`<text x="${cx}" y="${cy + 10}" ${mono} font-size="28" font-weight="800" text-anchor="middle" fill="${st.text}">${pos.length}</text>`);
    const lx = cx + R + 40;
    const rowH = Math.min(34, (H - 20) / Math.max(1, pos.length));
    pos.forEach((d, i) => {
      const y = cy - (pos.length * rowH) / 2 + i * rowH + rowH / 2;
      parts.push(`<rect x="${lx}" y="${y - 8}" width="16" height="16" rx="5" fill="${P[i % P.length]}"/>`);
      parts.push(`<text x="${lx + 28}" y="${y + 5}" ${font} font-size="17" fill="${st.text}">${esc(d.label.slice(0, 30))}</text>`);
      parts.push(`<text x="${W - 80}" y="${y + 5}" ${mono} font-size="16" font-weight="600" text-anchor="end" fill="${st.text}">${esc(d.text)}</text>`);
      parts.push(`<text x="${W - 12}" y="${y + 5}" ${mono} font-size="15" text-anchor="end" fill="${st.muted}">${Math.round((d.n / total) * 100)}%</text>`);
    });
  } else if (kind === 'hbar') {
    const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.n)));
    const rowH = Math.min(40, (H - 10) / Math.max(1, data.length));
    const lw = 190;
    const vw = 150;
    data.forEach((d, i) => {
      const y = 6 + i * rowH;
      const tw = W - lw - vw - 24;
      const bw = (tw * Math.abs(d.n)) / max;
      const bh = Math.min(16, rowH * 0.5);
      parts.push(`<text x="${lw - 14}" y="${y + rowH / 2 + 5}" ${font} font-size="16" text-anchor="end" fill="${st.text}">${esc(d.label.slice(0, 22))}</text>`);
      parts.push(`<rect x="${lw}" y="${y + rowH / 2 - bh / 2}" width="${tw}" height="${bh}" rx="${bh / 2}" fill="${st.border}"/>`);
      parts.push(`<rect x="${lw}" y="${y + rowH / 2 - bh / 2}" width="${Math.max(bh, bw)}" height="${bh}" rx="${bh / 2}" fill="${P[i % P.length]}"/>`);
      parts.push(`<text x="${W - 8}" y="${y + rowH / 2 + 5}" ${mono} font-size="16" font-weight="600" text-anchor="end" fill="${st.text}">${esc(d.text)}</text>`);
    });
  } else {
    const pad = 40;
    const max = Math.max(1e-9, ...data.map((d) => d.n));
    const bw = (W - pad * 2) / Math.max(1, data.length);
    const top = 30;
    const base = H - pad;
    const y = (n: number) => base - (Math.max(0, n) / max) * (base - top);
    parts.push(`<line x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}" stroke="${st.border}" stroke-width="1.5"/>`);
    if (kind === 'line') parts.push(`<polyline fill="none" stroke="${P[0]}" stroke-width="4" stroke-linejoin="round" points="${data.map((d, i) => `${pad + i * bw + bw / 2},${y(d.n)}`).join(' ')}"/>`);
    data.forEach((d, i) => {
      const x = pad + i * bw + bw / 2;
      if (kind === 'bar') {
        const h = Math.max(3, base - y(d.n));
        parts.push(`<rect x="${x - bw * 0.35}" y="${base - h}" width="${bw * 0.7}" height="${h}" rx="8" fill="${P[i % P.length]}"/>`);
      } else parts.push(`<circle cx="${x}" cy="${y(d.n)}" r="7" fill="${P[1]}"/>`);
      parts.push(`<text x="${x}" y="${base + 24}" ${font} font-size="15" text-anchor="middle" fill="${st.muted}">${esc(d.label.slice(0, 16))}</text>`);
      parts.push(`<text x="${x}" y="${y(d.n) - 10}" ${mono} font-size="16" font-weight="700" text-anchor="middle" fill="${st.text}">${esc(d.text)}</text>`);
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${st.bg}"/>${parts.join('')}</svg>`;
}

// -------------------------------------------------------------------- modelo

export async function buildExport(
  note: Note,
  ctx: EvalContext,
  fmt: FormatOptions,
  opts: { base: string; withImages?: boolean; pal?: ScreenPalette; chartMode?: 'screen' | 'print' } = { base: 'USD' },
): Promise<XDoc> {
  const ev = evaluateNote(note, ctx, fmt);
  const pal = opts.pal ?? screenPalette();
  const cstyle = chartStyle(pal, opts.chartMode ?? 'screen');
  const withImages = opts.withImages !== false;
  const blocks: XBlock[] = [];
  for (const b of note.blocks) {
    switch (b.type) {
      case 'calc': {
        const res = ev.perBlock.get(b.id)?.results ?? [];
        const lines = b.text.split('\n').map((text, i): XLine => {
          const r = res[i];
          return {
            text,
            segments: r?.segments.length ? r.segments : [{ text, cls: 'text' }],
            kind: r?.kind ?? 'empty',
            value: r?.kind === 'value' ? r.value : undefined,
            result: r?.kind === 'value' && r.value ? formatValue(r.value, fmt) : undefined,
            label: r?.label,
            assigned: r?.assigned,
            aggregate: r?.aggregate,
          };
        });
        // remove linhas vazias do começo e do fim
        while (lines.length && lines[0].kind === 'empty') lines.shift();
        while (lines.length && lines[lines.length - 1].kind === 'empty') lines.pop();
        if (lines.length) blocks.push({ type: 'calc', lines });
        // rodapé Σ (soma · média · linhas) quando o bloco é um grupo só, como na tela
        const first = res.findIndex((x) => x.kind === 'value');
        let last = -1;
        res.forEach((x, i) => x.kind === 'value' && (last = i));
        if (first >= 0 && !res.slice(first, last + 1).some((x) => x.kind === 'empty' || x.kind === 'header' || x.aggregate)) {
          const vals = res.filter((x) => x.kind === 'value' && x.value && !x.aggregate && !x.value.date && !x.value.pct).map((x) => x.value!);
          if (vals.length >= 2) {
            try {
              blocks.push({ type: 'sum', sum: formatValue(aggregateValues(vals, 'sum', ctx), fmt), avg: formatValue(aggregateValues(vals, 'avg', ctx), fmt), count: vals.length });
            } catch {
              /* valores incompatíveis */
            }
          }
        }
        break;
      }
      case 'heading':
        if (b.text.trim()) blocks.push({ type: 'heading', text: b.text, level: b.level });
        break;
      case 'chart': {
        const data = chartDataFor(note, b, ev, ctx).map((d) => ({ label: d.label, n: d.n, text: formatValue(d.value, fmt) }));
        if (!data.length) break;
        const W = 900;
        const H = b.kind === 'pie' || b.kind === 'donut' ? 340 : b.kind === 'hbar' ? Math.min(460, 20 + data.length * 40) : 380;
        const png = withImages ? await svgToPng(chartSvg(b.kind, data, W, H, cstyle), W, H, 2) : undefined;
        blocks.push({ type: 'chart', kind: b.kind, title: b.title ?? '', data, png, w: W, h: H });
        break;
      }
      case 'callout':
        if (b.text.trim()) blocks.push({ type: 'callout', text: b.text, color: b.color, iconPng: withImages ? await iconPng(b.icon, b.color, 48) : '' });
        break;
      case 'progress': {
        const p = ev.progress.get(b.id);
        const v = p?.value?.value;
        const g = p?.goal?.value;
        const pct = v && g && g.n ? Math.max(0, Math.min(1, v.n / g.n)) : 0;
        blocks.push({ type: 'progress', label: b.label, valueText: v ? formatValue(v, fmt) : '—', goalText: g ? formatValue(g, fmt) : '—', value: v?.n, goal: g?.n, pct, color: b.color });
        break;
      }
      case 'ticker': {
        const rows = b.codes.map((code) => {
          let text = '—';
          try {
            text = formatValue(convert({ n: 1, unit: currencyUnit(code) }, currencyUnit(opts.base), ctx), fmt);
          } catch {
            /* sem cotação */
          }
          return { code, text };
        });
        if (rows.length) blocks.push({ type: 'ticker', base: opts.base, rows });
        break;
      }
      case 'image':
        if (b.src) {
          const { w, h } = await imageSize(b.src);
          blocks.push({ type: 'image', src: b.src, caption: b.caption ?? '', width: b.width ?? 100, w, h });
        }
        break;
      case 'divider':
        blocks.push({ type: 'divider' });
        break;
      case 'sticker':
        if (withImages) blocks.push({ type: 'sticker', png: await iconPng(b.emoji, note.color, Math.max(32, b.size)), size: b.size, align: b.align });
        break;
      case 'audio':
        // a gravação não vai para o documento; a transcrição vai como destaque
        if (b.transcript) blocks.push({ type: 'callout', text: `“${b.transcript}”`, color: note.color, iconPng: withImages ? await iconPng('AudioLines', note.color, 48) : '' });
        break;
      case 'compare': {
        // relatório comparativo: título + uma linha por item ("Receitas: A → B", variação no resultado)
        const all = useData.getState().notes;
        const cols = b.sources.map((id) => (id === 'self' ? note : all.find((n) => n.id === id && !n.deleted))).filter((n): n is Note => !!n);
        if (cols.length < 2) break;
        const rows = compareRows(cols.map((n) => noteFigures(n, ctx, fmt, n.id === note.id ? ev : undefined)), ctx, b.only ?? 'all');
        if (!rows.length) break;
        blocks.push({ type: 'heading', text: b.title || cols.map((c) => c.title || '—').join(' × '), level: 3 });
        const lines = rows.map((r): XLine => {
          const text = `${r.kind === 'section' ? '#' : ''}${r.label}: ${r.values.map((v) => (v ? formatValue(v, fmt) : '—')).join(' → ')}`;
          const result = r.delta ? `${r.delta.n > 0 ? '+' : ''}${formatValue(r.delta, fmt)}${r.pct !== undefined ? ` (${r.pct > 0 ? '+' : ''}${(r.pct * 100).toFixed(1).replace('.', ctx.decimal === 'comma' ? ',' : '.')}%)` : ''}` : undefined;
          return {
            text,
            segments: [
              { text: `${r.kind === 'section' ? '#' : ''}${r.label}: `, cls: r.kind === 'section' ? 'section' : 'label' },
              { text: r.values.map((v) => (v ? formatValue(v, fmt) : '—')).join(' → '), cls: 'num' },
            ],
            kind: r.delta ? 'value' : 'text',
            value: r.delta,
            result,
            label: r.label,
            aggregate: r.kind !== 'item',
          };
        });
        blocks.push({ type: 'calc', lines });
        break;
      }
    }
  }
  return {
    title: note.title || 'GCP-Calc',
    color: note.color || '#2563eb',
    iconPng: withImages ? await iconPng(note.icon, note.color, 96) : '',
    date: new Date().toLocaleString(LOCALES[ctx.lang]),
    lang: ctx.lang,
    blocks,
    note,
    pal,
  };
}

/** Nome de arquivo seguro a partir do título. */
export const fileBase = (title: string) => (title || 'GCP-Calc').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'GCP-Calc';

export function dataUrlToBytes(src: string): Uint8Array {
  const b64 = src.slice(src.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const imageType = (src: string): 'png' | 'jpg' | 'gif' => (/^data:image\/jpe?g/.test(src) ? 'jpg' : /^data:image\/gif/.test(src) ? 'gif' : 'png');

/** Textos fixos dos documentos exportados, por idioma. */
export const XT: Record<Lang, Record<string, string>> = {
  pt: { avg: 'média', lines: 'linhas', exported: 'Exportado em', page: 'Página', of: 'de', value: 'Valor atual', goal: 'Meta', rates: 'Cotações', cont: 'continuação', section: 'Seção', description: 'Descrição', expression: 'Expressão', result: 'Valor', unit: 'Unidade', kind: 'Tipo', notes: 'Notas', summary: 'Resumo', chartData: 'Dados do gráfico', label: 'Rótulo', made: 'Gerado com GCP-Calc', general: 'Geral', observations: 'Observações', progress: 'Progresso' },
  en: { avg: 'avg', lines: 'lines', exported: 'Exported on', page: 'Page', of: 'of', value: 'Current value', goal: 'Goal', rates: 'Rates', cont: 'continued', section: 'Section', description: 'Description', expression: 'Expression', result: 'Value', unit: 'Unit', kind: 'Type', notes: 'Notes', summary: 'Summary', chartData: 'Chart data', label: 'Label', made: 'Made with GCP-Calc', general: 'General', observations: 'Notes', progress: 'Progress' },
  es: { avg: 'promedio', lines: 'líneas', exported: 'Exportado el', page: 'Página', of: 'de', value: 'Valor actual', goal: 'Meta', rates: 'Cotizaciones', cont: 'continuación', section: 'Sección', description: 'Descripción', expression: 'Expresión', result: 'Valor', unit: 'Unidad', kind: 'Tipo', notes: 'Notas', summary: 'Resumen', chartData: 'Datos del gráfico', label: 'Etiqueta', made: 'Hecho con GCP-Calc', general: 'General', observations: 'Observaciones', progress: 'Progreso' },
};
