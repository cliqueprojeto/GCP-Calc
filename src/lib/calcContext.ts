/** Monta o contexto do motor de cálculo a partir das configurações do usuário. */
import { useMemo } from 'react';
import { defaultContext, type EvalContext, type FormatOptions } from '../engine/value';
import { activeTags, useData } from '../store/data';
import { resolveLang } from '../i18n';
import { useRates } from './rates';
import type { Lang, Settings, Tag } from './types';

export function decimalFor(s: Settings, lang: Lang): 'comma' | 'dot' {
  if (s.decimal !== 'auto') return s.decimal;
  return lang === 'en' ? 'dot' : 'comma';
}

export function buildContext(s: Settings, tags: Tag[], rates: Record<string, number>): EvalContext {
  const lang = resolveLang(s.lang);
  return defaultContext({
    decimal: decimalFor(s, lang),
    lang,
    rates,
    tags: activeTags(tags),
    dollar: s.dollar,
    angle: s.angle,
    dateOrder: s.dateOrder === 'auto' ? (lang === 'en' && s.decimal !== 'comma' ? 'mdy' : 'dmy') : s.dateOrder,
    now: Date.now(),
    precision: s.precision,
    currencyPosition: s.currencyPosition === 'auto' ? (lang === 'es' ? 'after' : 'before') : s.currencyPosition,
    grouping: s.grouping,
  });
}

export function formatOptions(ctx: EvalContext): FormatOptions {
  return { decimal: ctx.decimal, grouping: ctx.grouping, precision: ctx.precision, lang: ctx.lang, currencyPosition: ctx.currencyPosition, tags: ctx.tags };
}

export function useEvalContext(): EvalContext {
  const settings = useData((s) => s.settings);
  const tags = useData((s) => s.tags);
  const rates = useRates((s) => s.rates);
  return useMemo(() => buildContext(settings, tags, rates), [settings, tags, rates]);
}

export function currentContext(): EvalContext {
  const d = useData.getState();
  return buildContext(d.settings, d.tags, useRates.getState().rates);
}
