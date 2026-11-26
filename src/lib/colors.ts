/** Cores do tema atual, resolvidas para #rrggbb (para exportações que imitam a tela). */

/** Converte qualquer cor CSS (variáveis, color-mix, rgb, oklab…) para #rrggbb usando o navegador. */
export function resolveColor(css: string, fallback = '#888888'): string {
  if (/^#[0-9a-f]{6}$/i.test(css)) return css.toLowerCase();
  if (typeof document === 'undefined') return fallback;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const el = document.createElement('div');
    el.style.color = css;
    el.style.display = 'none';
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    el.remove();
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1, 1);
    g.fillStyle = computed;
    g.fillRect(0, 0, 1, 1);
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
    return '#' + [r, gg, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return fallback;
  }
}

/** Mistura duas cores #rrggbb: p = proporção de `a` (0–1). */
export function mix(a: string, b: string, p: number): string {
  const pa = a.replace('#', '').match(/.{2}/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  const pb = b.replace('#', '').match(/.{2}/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  return '#' + pa.map((v, i) => Math.round(v * p + pb[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
}

export interface ScreenPalette {
  dark: boolean;
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  syn: Record<string, string>;
  /** mesmas cores das séries dos gráficos na tela */
  chart: string[];
}

const SYN = ['num', 'unit', 'cur', 'op', 'var', 'func', 'kw', 'res', 'cmt', 'hdr', 'label', 'text', 'date', 'tag'];

export function screenPalette(): ScreenPalette {
  const v = (name: string, fb: string) => {
    const raw = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
    return raw ? resolveColor(raw, fb) : fb;
  };
  const accent = v('--accent', '#8b5cf6');
  const accent2 = v('--accent-2', '#22d3ee');
  const syn: Record<string, string> = {};
  for (const k of SYN) syn[k] = v(`--syn-${k}`, '#cccccc');
  syn.assign = syn.var;
  syn.paren = syn.op;
  return {
    dark: typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
    bg: v('--bg', '#0b0a1f'),
    panel: v('--panel', '#15133a'),
    panel2: v('--panel-2', '#1d1a4a'),
    border: v('--border', '#2b2766'),
    text: v('--text', '#f0eeff'),
    muted: v('--muted', '#9c97d6'),
    accent,
    accent2,
    syn,
    chart: [accent, accent2, '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316', '#a855f7', '#0ea5e9'],
  };
}
