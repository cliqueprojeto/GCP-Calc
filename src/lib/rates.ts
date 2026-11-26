/**
 * Cotações de moedas e criptomoedas (base USD).
 *
 * Fontes, em ordem: open.er-api.com (160+ moedas) → frankfurter.dev (BCE).
 * BRL é refinado pela AwesomeAPI (cotação comercial ao vivo) e as criptos vêm do CoinGecko.
 * O resultado fica guardado; o app atualiza ao abrir (se configurado) e quando pedido.
 */
import { create } from 'zustand';
import { CRYPTO_IDS } from '../engine/currencies';
import { loadDoc, netFetch, saveDoc } from './platform';
import type { RatesDoc } from './types';

interface RatesState extends RatesDoc {
  status: 'idle' | 'loading' | 'ok' | 'error';
  error?: string;
  load(): Promise<void>;
  refresh(force?: boolean, maxAgeHours?: number): Promise<boolean>;
}

async function getJson(url: string) {
  const res = await netFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fiat(): Promise<{ rates: Record<string, number>; source: string }> {
  try {
    const d = await getJson('https://open.er-api.com/v6/latest/USD');
    if (d.result === 'success' && d.rates) return { rates: d.rates, source: 'open.er-api.com' };
    throw new Error('er-api');
  } catch {
    const d = await getJson('https://api.frankfurter.dev/v1/latest?base=USD');
    return { rates: { USD: 1, ...d.rates }, source: 'frankfurter.dev (BCE)' };
  }
}

async function brlLive(): Promise<number | null> {
  try {
    const d = await getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const bid = parseFloat(d?.USDBRL?.bid);
    return bid > 0 ? bid : null;
  } catch {
    return null;
  }
}

async function crypto(): Promise<Record<string, number>> {
  const ids = Object.values(CRYPTO_IDS).join(',');
  const d = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  const out: Record<string, number> = {};
  for (const [code, id] of Object.entries(CRYPTO_IDS)) {
    const usd = d?.[id]?.usd;
    if (usd > 0) out[code] = 1 / usd;
  }
  return out;
}

export const useRates = create<RatesState>((set, get) => ({
  rates: {},
  fetched: 0,
  source: '',
  status: 'idle',

  async load() {
    const doc = await loadDoc<RatesDoc>('rates');
    if (doc) set({ rates: doc.rates, fetched: doc.fetched, source: doc.source, cryptoFetched: doc.cryptoFetched });
  },

  async refresh(force = false, maxAgeHours = 6) {
    const s = get();
    if (s.status === 'loading') return false;
    if (!force && s.fetched && Date.now() - s.fetched < maxAgeHours * 3600_000) return true;
    set({ status: 'loading', error: undefined });
    try {
      const [f, brl, cr] = await Promise.all([fiat(), brlLive(), crypto().catch(() => ({}) as Record<string, number>)]);
      const rates = { ...get().rates, ...f.rates, ...cr };
      if (brl) rates.BRL = brl;
      const doc: RatesDoc = {
        rates,
        fetched: Date.now(),
        source: f.source + (brl ? ' + AwesomeAPI' : '') + (Object.keys(cr).length ? ' + CoinGecko' : ''),
        cryptoFetched: Object.keys(cr).length ? Date.now() : get().cryptoFetched,
      };
      set({ ...doc, status: 'ok' });
      await saveDoc('rates', doc);
      return true;
    } catch (e) {
      set({ status: 'error', error: String(e) });
      return false;
    }
  },
}));
