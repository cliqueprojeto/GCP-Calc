/**
 * Números por extenso na linha digitada: "seis dividido por 2", "vinte e sete mais 3",
 * "cento e vinte vezes dois", "one hundred and five", "veintitrés menos uno".
 * Devolve o trecho reconhecido (para o destaque continuar alinhado com o texto) e o valor.
 */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

type Dict = { units: Record<string, number>; hundredWord?: string[]; scales: Record<string, number>; and: string[]; article: string[]; fractions?: Record<string, number> };

const PT: Dict = {
  units: {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17,
    dezoito: 18, dezenove: 19, dezanove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
    oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
    quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
    setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
  },
  scales: { mil: 1e3, milhao: 1e6, milhoes: 1e6, bilhao: 1e9, bilhoes: 1e9 },
  and: ['e'],
  article: ['um', 'uma'],
  // "dois terços", "três quintos", "meio"
  fractions: { meio: 2, meia: 2, metade: 2, terco: 3, tercos: 3, quinto: 5, quintos: 5, decimo: 10, decimos: 10, centesimo: 100, centesimos: 100 },
};
const EN: Dict = {
  units: {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  },
  hundredWord: ['hundred'],
  scales: { thousand: 1e3, million: 1e6, millions: 1e6, billion: 1e9 },
  and: ['and'],
  article: ['one'],
  fractions: { half: 2, halves: 2, third: 3, thirds: 3, fifth: 5, fifths: 5, tenth: 10, tenths: 10 },
};
const ES: Dict = {
  units: {
    cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
    ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
    cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
  },
  scales: { mil: 1e3, millon: 1e6, millones: 1e6 },
  and: ['y'],
  article: ['un', 'una', 'uno'],
  fractions: { medio: 2, media: 2, mitad: 2, tercio: 3, tercios: 3, quinto: 5, quintos: 5, decimo: 10, decimos: 10 },
};
const DICTS: Record<string, Dict> = { pt: PT, en: EN, es: ES };

/** o que vem depois indica conta ("um mais um", "uma vez", "um /")? */
const OP_AFTER = /^\s*(?:[+\-−*×x/÷^%=]|\d|mais|menos|vez(?:es)?\b|dividid[oa]s?|multiplicad[oa]s?|plus|minus|times|divided|multiplied|over|por|entre|veces|sobre|mil\b|thousand|million)/i;
/** ...ou antes ("um mais um", "10 dividido por um") */
const OP_BEFORE = /(?:[+\-−*×x/÷^%=(]|mais|menos|vezes|por|plus|minus|times|by|over|entre|sobre|veces|de)\s*$/i;

/**
 * Reconhece um número por extenso no começo de `rest`.
 * `afterNumber`: o token anterior já era um número ("10 mil" é tratado em outro lugar).
 */
export function matchNumberWords(rest: string, lang: string, afterNumber = false, before = ''): { text: string; value: number } | null {
  const d = DICTS[lang] ?? PT;
  // "por cento"/"por ciento" é porcentagem, não 100
  if (/\bpor\s*$/i.test(before) && /^(cento|ciento)\b/i.test(rest)) return null;
  const re = /^[\p{L}]+/u;
  let pos = 0;
  let total = 0;
  let current = 0;
  let words = 0;
  let lastEnd = 0;
  let pendingAnd = false;
  for (;;) {
    const ws = rest.slice(pos).match(/^\s*/)![0];
    const m = rest.slice(pos + ws.length).match(re);
    if (!m) break;
    const w = fold(m[0]);
    const start = pos + ws.length;
    const end = start + m[0].length;
    if (words > 0 && d.and.includes(w)) {
      // "vinte e sete": o "e" só vale entre números
      pendingAnd = true;
      pos = end;
      continue;
    }
    let ok = false;
    if (d.fractions && w in d.fractions && (words > 0 || /^(meio|meia|metade|half|medio|media|mitad)$/.test(w))) {
      // "dois terços" = 2/3 · "meio" = 0,5
      current = words > 0 ? (current || 1) / d.fractions[w] : 1 / d.fractions[w];
      ok = true;
    } else if (w in d.units) {
      current += d.units[w];
      ok = true;
    } else if (d.hundredWord?.includes(w) && words > 0) {
      current = (current || 1) * 100;
      ok = true;
    } else if (w in d.scales && !(words === 0 && afterNumber)) {
      total += (current || 1) * d.scales[w];
      current = 0;
      ok = true;
    }
    if (!ok) break;
    words++;
    pendingAnd = false;
    pos = end;
    lastEnd = end;
  }
  void pendingAnd;
  if (!words) return null;
  const text = rest.slice(0, lastEnd);
  // a palavra precisa terminar ali (não é começo de outra palavra)
  if (/[\p{L}\p{N}]/u.test(rest[lastEnd] ?? '')) return null;
  // "um", "uma", "one" sozinhos são artigo ("um café"), a não ser que venha uma conta depois
  if (words === 1 && d.article.includes(fold(text.trim())) && !OP_AFTER.test(rest.slice(lastEnd)) && !OP_BEFORE.test(before)) return null;
  return { text, value: total + current };
}
