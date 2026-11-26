/**
 * Moedas: códigos ISO, símbolos e nomes em PT/EN/ES.
 * As cotações (base USD) chegam de fora — veja src/lib/rates.ts.
 */
import { fold } from './units';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  names: string[];
  decimals?: number;
  crypto?: boolean;
  /** nome legível (PT, EN, ES) */
  label: [string, string, string];
}

const C = (code: string, symbol: string, label: [string, string, string], names: string[] = [], extra: Partial<CurrencyInfo> = {}): CurrencyInfo => ({
  code,
  symbol,
  label,
  names,
  ...extra,
});

export const CURRENCIES: CurrencyInfo[] = [
  C('BRL', 'R$', ['Real brasileiro', 'Brazilian real', 'Real brasileño'], ['real', 'reais', 'reales', 'real brasileiro', 'reais brasileiros']),
  C('USD', 'US$', ['Dólar americano', 'US dollar', 'Dólar estadounidense'], ['dolar', 'dolares', 'dollar', 'dollars', 'dólar', 'dólares', 'buck', 'bucks', 'dolar americano', 'dolares americanos']),
  C('EUR', '€', ['Euro', 'Euro', 'Euro'], ['euro', 'euros']),
  C('GBP', '£', ['Libra esterlina', 'British pound', 'Libra esterlina'], ['libra esterlina', 'libras esterlinas', 'pound sterling', 'british pound', 'british pounds', 'quid']),
  C('JPY', '¥', ['Iene', 'Japanese yen', 'Yen'], ['iene', 'ienes', 'yen', 'yens'], { decimals: 0 }),
  C('CNY', 'CN¥', ['Yuan chinês', 'Chinese yuan', 'Yuan chino'], ['yuan', 'yuans', 'renminbi', 'rmb']),
  C('ARS', 'AR$', ['Peso argentino', 'Argentine peso', 'Peso argentino'], ['peso argentino', 'pesos argentinos']),
  C('CLP', 'CLP$', ['Peso chileno', 'Chilean peso', 'Peso chileno'], ['peso chileno', 'pesos chilenos'], { decimals: 0 }),
  C('MXN', 'MX$', ['Peso mexicano', 'Mexican peso', 'Peso mexicano'], ['peso mexicano', 'pesos mexicanos']),
  C('COP', 'COL$', ['Peso colombiano', 'Colombian peso', 'Peso colombiano'], ['peso colombiano', 'pesos colombianos']),
  C('UYU', '$U', ['Peso uruguaio', 'Uruguayan peso', 'Peso uruguayo'], ['peso uruguaio', 'pesos uruguaios', 'peso uruguayo', 'pesos uruguayos']),
  C('PYG', '₲', ['Guarani', 'Paraguayan guaraní', 'Guaraní'], ['guarani', 'guaranis', 'guaraní', 'guaraníes'], { decimals: 0 }),
  C('PEN', 'S/', ['Sol peruano', 'Peruvian sol', 'Sol peruano'], ['sol peruano', 'soles']),
  C('BOB', 'Bs', ['Boliviano', 'Bolivian boliviano', 'Boliviano'], ['boliviano', 'bolivianos']),
  C('CAD', 'C$', ['Dólar canadense', 'Canadian dollar', 'Dólar canadiense'], ['dolar canadense', 'dolares canadenses', 'canadian dollar', 'canadian dollars', 'dolar canadiense']),
  C('AUD', 'A$', ['Dólar australiano', 'Australian dollar', 'Dólar australiano'], ['dolar australiano', 'dolares australianos', 'australian dollar', 'australian dollars']),
  C('NZD', 'NZ$', ['Dólar neozelandês', 'New Zealand dollar', 'Dólar neozelandés'], []),
  C('CHF', 'CHF', ['Franco suíço', 'Swiss franc', 'Franco suizo'], ['franco suico', 'francos suicos', 'franco suíço', 'francos suíços', 'swiss franc', 'swiss francs', 'franco suizo', 'francos suizos']),
  C('SEK', 'kr', ['Coroa sueca', 'Swedish krona', 'Corona sueca'], ['coroa sueca', 'coroas suecas']),
  C('NOK', 'kr', ['Coroa norueguesa', 'Norwegian krone', 'Corona noruega'], []),
  C('DKK', 'kr', ['Coroa dinamarquesa', 'Danish krone', 'Corona danesa'], []),
  C('PLN', 'zł', ['Zloty', 'Polish złoty', 'Esloti'], ['zloty', 'zlotys']),
  C('CZK', 'Kč', ['Coroa tcheca', 'Czech koruna', 'Corona checa'], []),
  C('HUF', 'Ft', ['Florim húngaro', 'Hungarian forint', 'Forinto'], ['forint', 'forints'], { decimals: 0 }),
  C('RUB', '₽', ['Rublo', 'Russian ruble', 'Rublo'], ['rublo', 'rublos', 'ruble', 'rubles']),
  C('TRY', '₺', ['Lira turca', 'Turkish lira', 'Lira turca'], ['lira turca', 'liras turcas', 'turkish lira']),
  C('INR', '₹', ['Rupia indiana', 'Indian rupee', 'Rupia india'], ['rupia', 'rupias', 'rupee', 'rupees']),
  C('KRW', '₩', ['Won sul-coreano', 'South Korean won', 'Won surcoreano'], ['won', 'wons'], { decimals: 0 }),
  C('HKD', 'HK$', ['Dólar de Hong Kong', 'Hong Kong dollar', 'Dólar de Hong Kong'], []),
  C('SGD', 'S$', ['Dólar de Singapura', 'Singapore dollar', 'Dólar de Singapur'], []),
  C('ZAR', 'R', ['Rand', 'South African rand', 'Rand'], ['rand', 'rands']),
  C('ILS', '₪', ['Shekel', 'Israeli shekel', 'Séquel'], ['shekel', 'shekels']),
  C('AED', 'AED', ['Dirham dos EAU', 'UAE dirham', 'Dírham de los EAU'], ['dirham', 'dirhams']),
  C('SAR', 'SAR', ['Rial saudita', 'Saudi riyal', 'Riyal saudí'], ['riyal', 'riyals']),
  C('EGP', 'E£', ['Libra egípcia', 'Egyptian pound', 'Libra egipcia'], []),
  C('NGN', '₦', ['Naira', 'Nigerian naira', 'Naira'], ['naira']),
  C('THB', '฿', ['Baht', 'Thai baht', 'Baht'], ['baht']),
  C('IDR', 'Rp', ['Rupia indonésia', 'Indonesian rupiah', 'Rupia indonesia'], ['rupiah'], { decimals: 0 }),
  C('MYR', 'RM', ['Ringgit', 'Malaysian ringgit', 'Ringgit'], ['ringgit']),
  C('PHP', '₱', ['Peso filipino', 'Philippine peso', 'Peso filipino'], ['peso filipino', 'pesos filipinos']),
  C('VND', '₫', ['Dong', 'Vietnamese đồng', 'Dong'], ['dong'], { decimals: 0 }),
  C('TWD', 'NT$', ['Dólar taiwanês', 'New Taiwan dollar', 'Nuevo dólar taiwanés'], []),
  C('UAH', '₴', ['Hryvnia', 'Ukrainian hryvnia', 'Grivna'], ['hryvnia', 'grivna']),
  C('AOA', 'Kz', ['Kwanza', 'Angolan kwanza', 'Kwanza'], ['kwanza', 'kwanzas']),
  C('MZN', 'MT', ['Metical', 'Mozambican metical', 'Metical'], ['metical', 'meticais']),
  C('CVE', 'Esc', ['Escudo cabo-verdiano', 'Cape Verdean escudo', 'Escudo caboverdiano'], ['escudo', 'escudos']),
  C('XAU', 'XAU', ['Onça de ouro', 'Gold ounce', 'Onza de oro'], ['ouro', 'gold', 'oro'], { decimals: 2 }),
  C('XAG', 'XAG', ['Onça de prata', 'Silver ounce', 'Onza de plata'], ['prata', 'silver', 'plata'], { decimals: 2 }),
  // criptomoedas
  C('BTC', '₿', ['Bitcoin', 'Bitcoin', 'Bitcoin'], ['bitcoin', 'bitcoins', 'xbt'], { crypto: true, decimals: 8 }),
  C('ETH', 'Ξ', ['Ethereum', 'Ethereum', 'Ethereum'], ['ethereum', 'ether'], { crypto: true, decimals: 6 }),
  C('SOL', 'SOL', ['Solana', 'Solana', 'Solana'], ['solana'], { crypto: true, decimals: 4 }),
  C('USDT', 'USDT', ['Tether', 'Tether', 'Tether'], ['tether'], { crypto: true }),
  C('BNB', 'BNB', ['BNB', 'BNB', 'BNB'], [], { crypto: true, decimals: 4 }),
  C('XRP', 'XRP', ['XRP', 'XRP', 'XRP'], ['ripple'], { crypto: true, decimals: 4 }),
  C('ADA', 'ADA', ['Cardano', 'Cardano', 'Cardano'], ['cardano'], { crypto: true, decimals: 4 }),
  C('DOGE', 'DOGE', ['Dogecoin', 'Dogecoin', 'Dogecoin'], ['dogecoin'], { crypto: true, decimals: 4 }),
];

/** IDs do CoinGecko das criptomoedas suportadas. */
export const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
};

/** Símbolos que aparecem colados ao número (R$ 10, 10€). Ordem: mais longos primeiro. */
export const SYMBOLS: [string, string][] = [
  ['US$', 'USD'],
  ['R$', 'BRL'],
  ['AR$', 'ARS'],
  ['MX$', 'MXN'],
  ['CA$', 'CAD'],
  ['C$', 'CAD'],
  ['A$', 'AUD'],
  ['AU$', 'AUD'],
  ['NZ$', 'NZD'],
  ['HK$', 'HKD'],
  ['S$', 'SGD'],
  ['NT$', 'TWD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
  ['₩', 'KRW'],
  ['₽', 'RUB'],
  ['₺', 'TRY'],
  ['₪', 'ILS'],
  ['₦', 'NGN'],
  ['₱', 'PHP'],
  ['₫', 'VND'],
  ['₴', 'UAH'],
  ['₲', 'PYG'],
  ['₿', 'BTC'],
  ['Ξ', 'ETH'],
];

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]));
const byName = new Map<string, string>();
for (const c of CURRENCIES) for (const n of c.names) byName.set(fold(n), c.code);

export const currencyInfo = (code: string) => byCode.get(code);

/** Reconhece código ISO (usd, BRL) ou nome (dólares, euros). */
export function findCurrency(word: string): string | undefined {
  const up = word.toUpperCase();
  if (byCode.has(up)) return up;
  return byName.get(fold(word));
}

export const MAX_CURRENCY_WORDS = Math.max(...CURRENCIES.flatMap((c) => c.names.map((n) => n.split(' ').length)));
