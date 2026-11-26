import { pt, type Dict } from './pt';
import { en } from './en';
import { es } from './es';
import { useData } from '../store/data';
import type { Lang } from '../lib/types';

export type TKey = keyof Dict;
const DICTS: Record<Lang, Dict> = { pt, en, es };

export function detectLang(): Lang {
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'pt').toLowerCase();
  if (l.startsWith('pt')) return 'pt';
  if (l.startsWith('es')) return 'es';
  return 'en';
}

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? pt[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function resolveLang(l: 'auto' | Lang): Lang {
  return l === 'auto' ? detectLang() : l;
}

export function useLang(): Lang {
  return resolveLang(useData((s) => s.settings.lang));
}

export function useT() {
  const lang = useLang();
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

/** Para uso fora de componentes React. */
export function t(key: TKey, vars?: Record<string, string | number>) {
  return translate(resolveLang(useData.getState().settings.lang), key, vars);
}

export const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
