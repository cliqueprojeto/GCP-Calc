/**
 * Temas: cores da interface e da sintaxe dos cálculos.
 * "premium" ganha fundo com brilho em gradiente e painéis de vidro.
 */
import type { CustomTheme } from './types';

export type ThemeGroup = 'premium-dark' | 'premium-light' | 'editor' | 'dark' | 'light';

/** Tipos de trecho coloridos no editor (estilo editor de código). */
export const SYN_KEYS = ['num', 'unit', 'cur', 'op', 'var', 'func', 'kw', 'res', 'cmt', 'hdr', 'label', 'text', 'date', 'tag'] as const;
export type SynKey = (typeof SYN_KEYS)[number];

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  premium?: boolean;
  group: ThemeGroup;
  vars: Record<string, string>;
  syn: Record<SynKey, string>;
}

interface Base {
  bg: string;
  side: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  /** cores da sintaxe: número, unidade, moeda, operador, variável, função, palavra-chave, resultado */
  syn?: Partial<Record<SynKey, string>>;
  glow?: string;
}

function theme(id: string, name: string, dark: boolean, group: Theme['group'], c: Base): Theme {
  const syn: Record<SynKey, string> = {
    num: dark ? '#ffb86c' : '#c2410c',
    unit: dark ? '#7dd3fc' : '#0369a1',
    cur: dark ? '#86efac' : '#15803d',
    op: dark ? '#f472b6' : '#be185d',
    var: dark ? '#fcd34d' : '#a16207',
    func: dark ? '#c4b5fd' : '#6d28d9',
    kw: dark ? '#93c5fd' : '#1d4ed8',
    res: c.accent2,
    cmt: dark ? '#6b7394' : '#8a8fa3',
    hdr: c.accent,
    label: dark ? '#a5b4fc' : '#4338ca',
    text: `color-mix(in srgb, ${c.muted} 80%, ${c.text})`,
    date: dark ? '#f9a8d4' : '#9d174d',
    tag: dark ? '#5eead4' : '#0f766e',
    ...c.syn,
  };
  return {
    id,
    name,
    dark,
    group,
    premium: group.startsWith('premium'),
    vars: {
      '--bg': c.bg,
      '--sidebar': c.side,
      '--panel': c.panel,
      '--panel-2': c.panel2,
      '--border': c.border,
      '--text': c.text,
      '--muted': `color-mix(in srgb, ${c.muted} ${dark ? 75 : 65}%, ${c.text})`,
      '--accent': c.accent,
      '--accent-2': c.accent2,
      '--accent-soft': `color-mix(in srgb, ${c.accent} 16%, transparent)`,
      '--accent-grad': `linear-gradient(135deg, ${c.accent}, ${c.accent2})`,
      '--danger': dark ? '#f87171' : '#c81e1e',
      '--ok': dark ? '#4ade80' : '#15803d',
      '--hover': dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,20,40,0.05)',
      '--shadow': dark ? '0 18px 50px rgba(0,0,0,0.45)' : '0 18px 50px rgba(30,30,70,0.14)',
      '--glow': c.glow ?? `radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, ${c.accent} 22%, transparent), transparent 60%), radial-gradient(900px 500px at -10% 110%, color-mix(in srgb, ${c.accent2} 16%, transparent), transparent 60%)`,
    },
    syn,
  };
}

export const THEMES: Theme[] = [
  // premium escuros
  theme('nebula', 'Nebula', true, 'premium-dark', {
    bg: '#0b0a1f', side: '#090819', panel: '#15133a', panel2: '#1d1a4a', border: '#2b2766', text: '#f0eeff', muted: '#9c97d6', accent: '#8b5cf6', accent2: '#22d3ee',
  }),
  theme('carbon', 'Carbon', true, 'premium-dark', {
    bg: '#0c0c0d', side: '#08080a', panel: '#161618', panel2: '#1f1f22', border: '#2c2c31', text: '#f4f4f5', muted: '#a1a1aa', accent: '#f97316', accent2: '#facc15', syn: { res: '#fb923c' },
  }),
  theme('emerald', 'Emerald', true, 'premium-dark', {
    bg: '#06130f', side: '#040e0b', panel: '#0c2019', panel2: '#122c23', border: '#1d4236', text: '#ecfdf5', muted: '#8fc7b0', accent: '#10b981', accent2: '#a3e635', syn: { res: '#34d399' },
  }),
  theme('noir', 'Noir Edition', true, 'premium-dark', {
    bg: '#0a0a0a', side: '#060606', panel: '#141414', panel2: '#1c1c1c', border: '#2a2a2a', text: '#fafaf9', muted: '#a8a29e', accent: '#d4af37', accent2: '#f5e6b3', syn: { res: '#e9c46a', num: '#fafaf9' },
  }),
  theme('cyber', 'Cyber', true, 'premium-dark', {
    bg: '#0a0620', side: '#070417', panel: '#140c36', panel2: '#1c1148', border: '#34206e', text: '#f5f0ff', muted: '#a99bd8', accent: '#ec4899', accent2: '#06b6d4', syn: { res: '#22d3ee', op: '#f472b6' },
  }),
  // premium claros
  theme('cloud', 'Cloud', false, 'premium-light', {
    bg: '#f3f7fd', side: '#eaf1fb', panel: '#ffffff', panel2: '#f2f6fc', border: '#dbe5f3', text: '#0f1b3d', muted: '#5d6b8a', accent: '#2563eb', accent2: '#06b6d4', syn: { res: '#0369a1' },
  }),
  theme('swiss', 'Swiss Finance', false, 'premium-light', {
    bg: '#fafafa', side: '#f2f2f2', panel: '#ffffff', panel2: '#f6f6f6', border: '#e4e4e7', text: '#111111', muted: '#5f5f66', accent: '#dc2626', accent2: '#111111', syn: { res: '#b91c1c' },
  }),
  theme('porcelain', 'Porcelain', false, 'premium-light', {
    bg: '#f6f5f1', side: '#efede6', panel: '#fffefb', panel2: '#f5f3ec', border: '#e3ded1', text: '#23211c', muted: '#6e695d', accent: '#4d7c0f', accent2: '#0f766e', syn: { res: '#3f6212' },
  }),
  theme('paper-ed', 'Paper Edition', false, 'premium-light', {
    bg: '#f7f1e3', side: '#f0e8d4', panel: '#fffaf0', panel2: '#f7efdc', border: '#e6dabd', text: '#2b2418', muted: '#76684d', accent: '#7c2d12', accent2: '#b45309', syn: { res: '#9a3412' },
  }),
  theme('peach', 'Peach', false, 'premium-light', {
    bg: '#fff5f0', side: '#ffece3', panel: '#ffffff', panel2: '#fff2eb', border: '#fbd9c9', text: '#3b1d14', muted: '#8a5a48', accent: '#f43f5e', accent2: '#fb923c', syn: { res: '#e11d48' },
  }),
  // paletas de editores de código (inspiradas nos temas do Omarchy)
  theme('tokyo-night', 'Tokyo Night', true, 'editor', {
    bg: '#1a1b26', side: '#16161e', panel: '#1f2335', panel2: '#24283b', border: '#2f3549', text: '#c0caf5', muted: '#7982a9', accent: '#7aa2f7', accent2: '#bb9af7',
    syn: { num: '#ff9e64', unit: '#7dcfff', cur: '#9ece6a', op: '#89ddff', var: '#e0af68', func: '#bb9af7', kw: '#7aa2f7', res: '#73daca', cmt: '#565f89', hdr: '#7aa2f7', label: '#c0caf5', text: '#a9b1d6', date: '#f7768e', tag: '#2ac3de' },
  }),
  theme('catppuccin', 'Catppuccin Mocha', true, 'editor', {
    bg: '#1e1e2e', side: '#181825', panel: '#24273a', panel2: '#313244', border: '#45475a', text: '#cdd6f4', muted: '#9399b2', accent: '#cba6f7', accent2: '#89b4fa',
    syn: { num: '#fab387', unit: '#89dceb', cur: '#a6e3a1', op: '#89dceb', var: '#f9e2af', func: '#cba6f7', kw: '#89b4fa', res: '#94e2d5', cmt: '#6c7086', hdr: '#f5c2e7', label: '#b4befe', text: '#bac2de', date: '#f38ba8', tag: '#94e2d5' },
  }),
  theme('catppuccin-latte', 'Catppuccin Latte', false, 'editor', {
    bg: '#eff1f5', side: '#e6e9ef', panel: '#ffffff', panel2: '#e6e9ef', border: '#ccd0da', text: '#4c4f69', muted: '#7c7f93', accent: '#8839ef', accent2: '#1e66f5',
    syn: { num: '#fe640b', unit: '#04a5e5', cur: '#40a02b', op: '#179299', var: '#df8e1d', func: '#8839ef', kw: '#1e66f5', res: '#179299', cmt: '#9ca0b0', hdr: '#ea76cb', label: '#7287fd', text: '#5c5f77', date: '#d20f39', tag: '#209fb5' },
  }),
  theme('gruvbox', 'Gruvbox', true, 'editor', {
    bg: '#282828', side: '#1d2021', panel: '#32302f', panel2: '#3c3836', border: '#504945', text: '#ebdbb2', muted: '#a89984', accent: '#fe8019', accent2: '#b8bb26',
    syn: { num: '#d3869b', unit: '#83a598', cur: '#b8bb26', op: '#fe8019', var: '#fabd2f', func: '#8ec07c', kw: '#fb4934', res: '#fabd2f', cmt: '#928374', hdr: '#fe8019', label: '#83a598', text: '#d5c4a1', date: '#d3869b', tag: '#8ec07c' },
  }),
  theme('nord', 'Nord', true, 'editor', {
    bg: '#2e3440', side: '#272c36', panel: '#343b49', panel2: '#3b4252', border: '#4c566a', text: '#eceff4', muted: '#a3abbd', accent: '#88c0d0', accent2: '#81a1c1',
    syn: { num: '#b48ead', unit: '#8fbcbb', cur: '#a3be8c', op: '#81a1c1', var: '#ebcb8b', func: '#88c0d0', kw: '#81a1c1', res: '#8fbcbb', cmt: '#616e88', hdr: '#88c0d0', label: '#d8dee9', text: '#d8dee9', date: '#d08770', tag: '#8fbcbb' },
  }),
  theme('everforest', 'Everforest', true, 'editor', {
    bg: '#2d353b', side: '#272e33', panel: '#343f44', panel2: '#3d484d', border: '#475258', text: '#d3c6aa', muted: '#9da9a0', accent: '#a7c080', accent2: '#83c092',
    syn: { num: '#d699b6', unit: '#7fbbb3', cur: '#a7c080', op: '#e69875', var: '#dbbc7f', func: '#83c092', kw: '#7fbbb3', res: '#a7c080', cmt: '#859289', hdr: '#e69875', label: '#d3c6aa', text: '#c5b9a0', date: '#e67e80', tag: '#83c092' },
  }),
  theme('kanagawa', 'Kanagawa', true, 'editor', {
    bg: '#1f1f28', side: '#16161d', panel: '#2a2a37', panel2: '#363646', border: '#54546d', text: '#dcd7ba', muted: '#a6a69c', accent: '#7e9cd8', accent2: '#957fb8',
    syn: { num: '#d27e99', unit: '#7fb4ca', cur: '#98bb6c', op: '#c0a36e', var: '#e6c384', func: '#957fb8', kw: '#7e9cd8', res: '#7aa89f', cmt: '#727169', hdr: '#ffa066', label: '#dcd7ba', text: '#c8c093', date: '#e46876', tag: '#6a9589' },
  }),
  theme('rose-pine', 'Rosé Pine', true, 'editor', {
    bg: '#191724', side: '#14121f', panel: '#1f1d2e', panel2: '#26233a', border: '#403d52', text: '#e0def4', muted: '#908caa', accent: '#ebbcba', accent2: '#c4a7e7',
    syn: { num: '#f6c177', unit: '#9ccfd8', cur: '#31c48d', op: '#eb6f92', var: '#f6c177', func: '#c4a7e7', kw: '#31748f', res: '#ebbcba', cmt: '#6e6a86', hdr: '#ebbcba', label: '#e0def4', text: '#c9c6e0', date: '#eb6f92', tag: '#9ccfd8' },
  }),
  theme('matte-black', 'Matte Black', true, 'editor', {
    bg: '#121212', side: '#0e0e0e', panel: '#1a1a1a', panel2: '#222222', border: '#333333', text: '#bebebe', muted: '#8a8a8d', accent: '#f59e0b', accent2: '#d35f5f',
    syn: { num: '#f59e0b', unit: '#8a8a8d', cur: '#e68e0d', op: '#d35f5f', var: '#eaeaea', func: '#b91c1c', kw: '#bebebe', res: '#f59e0b', cmt: '#5c5c5c', hdr: '#eaeaea', label: '#bebebe', text: '#9a9a9a', date: '#d35f5f', tag: '#e68e0d' },
  }),
  theme('osaka-jade', 'Osaka Jade', true, 'editor', {
    bg: '#111c18', side: '#0d1613', panel: '#16241f', panel2: '#1d2f28', border: '#2d4a3f', text: '#c1c497', muted: '#8a9a7b', accent: '#2dd5b7', accent2: '#e5c736',
    syn: { num: '#e5c736', unit: '#2dd5b7', cur: '#549e6a', op: '#ff5345', var: '#e5c736', func: '#d2689c', kw: '#509475', res: '#2dd5b7', cmt: '#53685b', hdr: '#2dd5b7', label: '#c1c497', text: '#a9ad84', date: '#d2689c', tag: '#45a67e' },
  }),
  theme('ristretto', 'Ristretto', true, 'editor', {
    bg: '#2c2525', side: '#231d1d', panel: '#352d2d', panel2: '#403535', border: '#5b4a45', text: '#e6d9db', muted: '#a8999b', accent: '#f9cc6c', accent2: '#fd6883',
    syn: { num: '#ab9df2', unit: '#85dacc', cur: '#adda78', op: '#fd6883', var: '#f9cc6c', func: '#f38d70', kw: '#85dacc', res: '#f9cc6c', cmt: '#72696a', hdr: '#f38d70', label: '#e6d9db', text: '#c3b7b8', date: '#fd6883', tag: '#85dacc' },
  }),
  theme('dracula', 'Dracula', true, 'editor', {
    bg: '#282a36', side: '#21222c', panel: '#2f3142', panel2: '#383a4c', border: '#44475a', text: '#f8f8f2', muted: '#a4a8c4', accent: '#bd93f9', accent2: '#ff79c6',
    syn: { num: '#bd93f9', unit: '#8be9fd', cur: '#50fa7b', op: '#ff79c6', var: '#f1fa8c', func: '#50fa7b', kw: '#8be9fd', res: '#ffb86c', cmt: '#6272a4', hdr: '#ff79c6', label: '#f8f8f2', text: '#d6d6e6', date: '#ff5555', tag: '#8be9fd' },
  }),
  theme('rose-pine-dawn', 'Rosé Pine Dawn', false, 'editor', {
    bg: '#faf4ed', side: '#f2e9e1', panel: '#fffaf3', panel2: '#f2e9e1', border: '#dfdad9', text: '#575279', muted: '#797593', accent: '#d7827e', accent2: '#907aa9',
    syn: { num: '#ea9d34', unit: '#56949f', cur: '#286983', op: '#b4637a', var: '#ea9d34', func: '#907aa9', kw: '#286983', res: '#d7827e', cmt: '#9893a5', hdr: '#d7827e', label: '#575279', text: '#6e6a86', date: '#b4637a', tag: '#56949f' },
  }),
  theme('flexoki-light', 'Flexoki Light', false, 'editor', {
    bg: '#fffcf0', side: '#f2f0e5', panel: '#fffefa', panel2: '#f2f0e5', border: '#e6e4d9', text: '#100f0f', muted: '#6f6e69', accent: '#205ea6', accent2: '#24837b',
    syn: { num: '#bc5215', unit: '#24837b', cur: '#66800b', op: '#af3029', var: '#ad8301', func: '#5e409d', kw: '#205ea6', res: '#205ea6', cmt: '#b7b5ac', hdr: '#a02f6f', label: '#100f0f', text: '#403e3c', date: '#a02f6f', tag: '#24837b' },
  }),
  theme('solarized-light', 'Solarized Light', false, 'editor', {
    bg: '#fdf6e3', side: '#f5eedb', panel: '#fffbef', panel2: '#eee8d5', border: '#e0d8bf', text: '#586e75', muted: '#839496', accent: '#268bd2', accent2: '#2aa198',
    syn: { num: '#d33682', unit: '#2aa198', cur: '#859900', op: '#cb4b16', var: '#b58900', func: '#6c71c4', kw: '#268bd2', res: '#268bd2', cmt: '#93a1a1', hdr: '#cb4b16', label: '#586e75', text: '#657b83', date: '#dc322f', tag: '#2aa198' },
  }),
  // escuros
  theme('neuro', 'Neuro', true, 'dark', {
    bg: '#0b0a24', side: '#080719', panel: '#13113a', panel2: '#1b1848', border: '#2a2663', text: '#efedff', muted: '#9a95d1', accent: '#8b5cf6', accent2: '#22d3ee',
  }),
  theme('midnight', 'Midnight', true, 'dark', {
    bg: '#0d0f1f', side: '#0a0c1a', panel: '#141733', panel2: '#1b1f42', border: '#272b55', text: '#eceefd', muted: '#9298c4', accent: '#6366f1', accent2: '#38bdf8',
  }),
  theme('obsidian', 'Obsidian', true, 'dark', {
    bg: '#16151c', side: '#121117', panel: '#1e1c26', panel2: '#26232f', border: '#34303f', text: '#ebe8f2', muted: '#9a94aa', accent: '#a78bfa', accent2: '#f472b6',
  }),
  theme('aurora', 'Aurora', true, 'dark', {
    bg: '#071a1c', side: '#051415', panel: '#0d2629', panel2: '#133235', border: '#1f4a4e', text: '#e6fffb', muted: '#8cc2bc', accent: '#14b8a6', accent2: '#a78bfa',
  }),
  theme('graphite', 'Graphite', true, 'dark', {
    bg: '#18191b', side: '#141517', panel: '#202124', panel2: '#28292d', border: '#35373c', text: '#e8eaed', muted: '#9aa0a6', accent: '#f59e0b', accent2: '#fb923c',
  }),
  theme('ocean', 'Deep Ocean', true, 'dark', {
    bg: '#061425', side: '#04101d', panel: '#0b1f38', panel2: '#102848', border: '#1b3a63', text: '#e3f0ff', muted: '#87a6cc', accent: '#0ea5e9', accent2: '#22d3ee',
  }),
  theme('rose-noir', 'Rosé Noir', true, 'dark', {
    bg: '#1a0f14', side: '#150b10', panel: '#24151c', panel2: '#2e1b24', border: '#432735', text: '#fde8ef', muted: '#c595a8', accent: '#f43f5e', accent2: '#fda4af',
  }),
  theme('terminal', 'Terminal', true, 'dark', {
    bg: '#030803', side: '#020602', panel: '#081108', panel2: '#0c180c', border: '#163016', text: '#c8facc', muted: '#6ea873', accent: '#22c55e', accent2: '#84cc16', syn: { num: '#bbf7d0', res: '#4ade80', op: '#86efac', unit: '#a3e635', cur: '#fde047' },
  }),
  // claros
  theme('neuro-light', 'Neuro Light', false, 'light', {
    bg: '#f7f6ff', side: '#efedfd', panel: '#ffffff', panel2: '#f2f0ff', border: '#e1ddf7', text: '#1c1840', muted: '#6b6596', accent: '#7c3aed', accent2: '#0891b2',
  }),
  theme('paper', 'Paper', false, 'light', {
    bg: '#fbfaf7', side: '#f4f2ec', panel: '#ffffff', panel2: '#f7f5ef', border: '#e7e3d8', text: '#1f1d18', muted: '#6f6a5c', accent: '#c026d3', accent2: '#7c3aed',
  }),
  theme('snow', 'Snow', false, 'light', {
    bg: '#f8fafc', side: '#f1f5f9', panel: '#ffffff', panel2: '#f4f7fb', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', accent: '#2563eb', accent2: '#0ea5e9',
  }),
  theme('sakura', 'Sakura', false, 'light', {
    bg: '#fff7fa', side: '#ffeef4', panel: '#ffffff', panel2: '#fff2f7', border: '#fbd5e3', text: '#3a1426', muted: '#8f5a72', accent: '#db2777', accent2: '#a855f7',
  }),
  theme('mint', 'Mint', false, 'light', {
    bg: '#f3fbf7', side: '#e9f7f0', panel: '#ffffff', panel2: '#f0faf5', border: '#cfeadc', text: '#0f2e22', muted: '#4f7a68', accent: '#059669', accent2: '#0d9488',
  }),
  theme('sand', 'Sand', false, 'light', {
    bg: '#fbf7f0', side: '#f5eee2', panel: '#fffdf9', panel2: '#f8f2e7', border: '#eadfcb', text: '#2e2416', muted: '#7d6c52', accent: '#d97706', accent2: '#b45309',
  }),
  theme('lavender', 'Lavender', false, 'light', {
    bg: '#f8f6ff', side: '#f0ecff', panel: '#ffffff', panel2: '#f4f1ff', border: '#e2dbfb', text: '#221b42', muted: '#6d6496', accent: '#6d28d9', accent2: '#4f46e5',
  }),
];

export function customTheme(c: CustomTheme): Theme {
  const mix = (a: string, b: string, p: number) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
  return theme('custom', 'Custom', c.dark, c.dark ? 'premium-dark' : 'premium-light', {
    bg: c.bg,
    side: mix(c.bg, '#000', 85),
    panel: c.panel,
    panel2: mix(c.panel, c.text, 94),
    border: mix(c.panel, c.text, 82),
    text: c.text,
    muted: mix(c.text, c.bg, 60),
    accent: c.accent,
    accent2: c.accent2,
  });
}

export function resolveTheme(id: string, custom: CustomTheme): Theme {
  if (id === 'custom') return customTheme(custom);
  if (id === 'system') {
    const dark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
    return THEMES.find((t) => t.id === (dark ? 'nebula' : 'cloud'))!;
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(t: Theme, synOverrides: Partial<Record<SynKey, string>> = {}) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  for (const k of SYN_KEYS) root.style.setProperty(`--syn-${k}`, synOverrides[k] || t.syn[k]);
  root.dataset.theme = t.dark ? 'dark' : 'light';
  root.classList.toggle('premium', !!t.premium);
  // paletas de editor: visual "tiling" do Omarchy (blocos com espaçamento, bordas finas e nítidas)
  root.classList.toggle('tiling', t.group === 'editor');
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]') ?? Object.assign(document.head.appendChild(document.createElement('meta')), { name: 'theme-color' });
  meta.setAttribute('content', t.vars['--bg']);
  // Android: cor dos ícones das barras do sistema
  (window as any).GcpNative?.setLightBars?.(!t.dark);
}

export const FONTS: { id: string; name: string; css: string }[] = [
  { id: 'jetbrains', name: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'plex', name: 'IBM Plex Mono', css: "'IBM Plex Mono', ui-monospace, monospace" },
  { id: 'fira', name: 'Fira Code', css: "'Fira Code', ui-monospace, monospace" },
  { id: 'inter', name: 'Inter', css: "'Inter', system-ui, sans-serif" },
  { id: 'roboto', name: 'Roboto', css: "'Roboto', system-ui, sans-serif" },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', css: "'Atkinson Hyperlegible', system-ui, sans-serif" },
  { id: 'system', name: 'System', css: 'system-ui, sans-serif' },
];
