/**
 * Ditado → linhas de cálculo, sem IA: "comprei arroz por 27,90, feijão 8 reais e 49 centavos
 * e paguei a luz 150" vira "Arroz: R$ 27,90", "Feijão: R$ 8,49", "Luz: R$ 150,00".
 * Com IA configurada, o app pede a ela a mesma conversão (mais esperta) e usa esta como reserva.
 */
import type { Lang } from './types';
import { classifyTerm, type Kind } from '../engine/vocab';
import { buildFormula, type KnownNames } from './voiceFormulas';

const VERBS: Record<Lang, RegExp> = {
  pt: /^(?:eu\s+)?(?:comprei|paguei|gastei|recebi|ganhei|vendi|coloquei|botei|anota(?:r)?|lança(?:r)?|lancei|mais|também|tambem|e|depois|aí|ai|então|entao)(?![\p{L}\p{N}])\s*/iu,
  en: /^(?:i\s+)?(?:bought|paid|spent|got|received|earned|sold|add|log|plus|also|and|then)(?![\p{L}\p{N}])\s*/iu,
  es: /^(?:yo\s+)?(?:compré|compre|pagué|pague|gasté|gaste|recibí|recibi|gané|gane|vendí|vendi|anota(?:r)?|más|mas|también|tambien|y|luego|después|despues)(?![\p{L}\p{N}])\s*/iu,
};
const FILLERS: Record<Lang, RegExp> = {
  pt: /(?<![\p{L}\p{N}])(?:o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|por|pelo|pela|com|no|na|nos|nas|que|foi|custou|deu|saiu|valor|reais?|r\$)(?![\p{L}\p{N}])/giu,
  en: /(?<![\p{L}\p{N}])(?:the|a|an|of|for|at|on|in|with|which|was|cost|costs|came to|dollars?|bucks|\$)(?![\p{L}\p{N}])/giu,
  es: /(?<![\p{L}\p{N}])(?:el|la|los|las|un|una|unos|unas|de|del|por|con|en|que|fue|costó|costo|salió|salio|pesos?|euros?)(?![\p{L}\p{N}])/giu,
};
const INCOME: Record<Lang, RegExp> = {
  pt: /(?<![\p{L}\p{N}])(?:recebi|ganhei|vendi|entrou|salário|salario|receita)(?![\p{L}\p{N}])/iu,
  en: /(?<![\p{L}\p{N}])(?:received|earned|got paid|sold|income|salary)(?![\p{L}\p{N}])/iu,
  es: /(?<![\p{L}\p{N}])(?:recibí|recibi|gané|gane|vendí|vendi|ingreso|sueldo)(?![\p{L}\p{N}])/iu,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// números por extenso (pt, es, en) → algarismos: "vinte e sete" → 27, "mil e duzentos" → 1200
const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
  uno: 1, dos: 2, cuatro: 4, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, sesenta: 60, ochenta: 80,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { mil: 1000, thousand: 1000, hundred: 100, milhao: 1e6, milhoes: 1e6, millon: 1e6, millones: 1e6, million: 1e6 };
const fold = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function wordsToNumbers(text: string, lang?: Lang): string {
  // "dos" é "dois" só em espanhol (em português é "de os")
  const skip = lang === 'es' ? new Set<string>() : new Set(['dos']);
  const parts = text.split(/(\s+|[,.;!?-])/);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const w = fold(parts[i]);
    if (skip.has(w) || (!(w in UNITS) && !(w in SCALES && w !== 'hundred'))) {
      out.push(parts[i++]);
      continue;
    }
    // "10 mil", "2,5 milhões": algarismos seguidos de escala
    if (w in SCALES && w !== 'hundred') {
      let k = out.length - 1;
      while (k >= 0 && /^\s+$/.test(out[k])) k--;
      const prevNum = k >= 0 ? out[k].replace(/\./g, '').replace(',', '.') : '';
      if (k >= 0 && /^\d+(\.\d+)?$/.test(prevNum)) {
        out.splice(k, out.length - k, String(Math.round(parseFloat(prevNum) * SCALES[w])));
        i++;
        continue;
      }
    }
    // junta "vinte e sete", "mil e duzentos", "twenty-seven", "one hundred and five"
    let total = 0;
    let cur = 0;
    let j = i;
    let last = i;
    while (j < parts.length) {
      const t = fold(parts[j]);
      if (t in UNITS && !skip.has(t)) {
        cur += UNITS[t];
        last = j;
      } else if (t in SCALES) {
        const k = SCALES[t];
        if (k === 100) cur = (cur || 1) * 100;
        else {
          total += (cur || 1) * k;
          cur = 0;
        }
        last = j;
      } else if (!/^\s+$|^-$/.test(parts[j]) && !['e', 'y', 'and'].includes(t)) break;
      j++;
    }
    // "um/uma" sozinho é artigo ("um freela"), a não ser antes de moeda/escala ("um real", "um mil")
    if (last === i && ['um', 'uma', 'uno', 'una', 'one', 'a'].includes(w)) {
      const nextWord = fold(parts.slice(i + 1).find((x) => x.trim() && !/^[,.;!?-]$/.test(x)) ?? '');
      if (!/^(real|reais|dolar|dolares|dollar|dollars|euro|euros|peso|pesos|mil|milhao|thousand|hundred|million)$/.test(nextWord)) {
        out.push(parts[i++]);
        continue;
      }
    }
    out.push(String(total + cur));
    // conector final ("e") que não liga números fica no texto
    i = last + 1;
  }
  return out.join('');
}

/** "8 reais e 49 centavos" → "8,49 reais"; "1 mil e 200" → "1200" */
function normalizeMoney(t: string, lang: Lang, dec: string): string {
  let s = t.replace(/(\d+)\s*(?:reais|real|dólares|dolares|dollars?|euros?|pesos?)\s*(?:e|and|y|con)\s*(\d{1,2})\s*(?:centavos?|cents?|céntimos?|centimos?)/gi, (_, a, b) => `${a}${dec}${b.padStart(2, '0')} ${lang === 'en' ? 'dollars' : lang === 'es' ? 'euros' : 'reais'}`);
  s = s.replace(/(\d+)\s*mil\s*(?:e|y)?\s*(\d{1,3})(?![\p{L}\p{N}])/giu, (_, a, b) => String(+a * 1000 + +b));
  s = s.replace(/(\d+)\s*(?:mil|thousand)(?![\p{L}\p{N}])/giu, (_, a) => String(+a * 1000));
  return s;
}

export function dictationToLines(text: string, lang: Lang, opts: { decimal: 'comma' | 'dot'; symbol: string; known?: KnownNames }): string[] {
  return dictationItems(text, lang, opts).map((x) => x.line);
}

/** Itens do ditado com a classificação (receita/despesa) vinda do que foi dito ("comprei", "recebi"…). */
export function dictationItems(text: string, lang: Lang, opts: { decimal: 'comma' | 'dot'; symbol: string; known?: KnownNames }): { line: string; tone?: Kind; formula?: boolean }[] {
  // frases que pedem cálculo viram fórmulas (com as seções e variáveis da nota); o resto, lançamentos
  const formulas: { line: string; formula: true }[] = [];
  const entries: string[] = [];
  for (const sentence of text.split(/[.!?;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const f = buildFormula(sentence, opts.known ?? { sections: [], vars: [] }, lang);
    if (f) formulas.push({ line: f, formula: true });
    else entries.push(sentence);
  }
  return [...entryItems(entries.join('. '), lang, opts), ...formulas];
}

function entryItems(text: string, lang: Lang, opts: { decimal: 'comma' | 'dot'; symbol: string }): { line: string; tone?: Kind }[] {
  const dec = opts.decimal === 'comma' ? ',' : '.';
  const src = normalizeMoney(wordsToNumbers(text.replace(/\s+/g, ' ').trim(), lang), lang, dec);
  // separa itens: pontuação, quebras e " e " / " and " / " y " antes de uma palavra
  const parts = src
    .split(/[;\n]|[.!?](?=\s|$)|,(?=\s*\D)|\s+(?:e|and|y|mais|plus)\s+(?=[\p{L}])/u)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: { line: string; tone?: Kind }[] = [];
  const overall = classifyTerm(text);
  for (let p of parts) {
    const income = INCOME[lang].test(p);
    const said = classifyTerm(p);
    for (let i = 0; i < 3; i++) p = p.replace(VERBS[lang], '');
    // "em 10 meses", "por 3 vezes", "durante 6 meses", "em 12 parcelas", "para 4 pessoas": multiplica
    let mult = '';
    const mm = p.match(/(?:^|\s)(?:em|por|durante|para|x|vezes|for|during|in|over|en)\s+(\d+)\s*(meses|m[eê]s|vezes|parcelas?|presta[cç][oõ]es|semanas?|anos?|dias?|horas?|pessoas?|unidades?|turmas?|encontros?|edi[cç][oõ]es|months?|times|installments?|weeks?|years?|days?|hours?|people|persons?|units?|cuotas?|veces|a[nñ]os|d[ií]as|personas?)(?=\s|$|[,.;])/iu) ?? p.match(/(?:^|\s)(?:x|vezes|times|veces)\s*(\d+)(?=\s|$)/iu);
    if (mm) {
      mult = ` * ${mm[1]}${mm[2] ? ' ' + mm[2].toLowerCase() : ''}`;
      p = (p.slice(0, mm.index) + ' ' + p.slice(mm.index! + mm[0].length)).replace(/\s+/g, ' ').trim();
    }
    // último número do trecho é o valor (aceita 1.234,56 / 1,234.56 / 27,90)
    const nums = [...p.matchAll(/\d[\d.,]*/g)];
    if (!nums.length) {
      if (p.length > 2) out.push({ line: `// ${cap(p)}` });
      continue;
    }
    const last = nums[nums.length - 1];
    let value = last[0].replace(/[.,]$/, '');
    // quantidade antes do item: "2 pacotes de arroz 27,90" → 2 * 27,90
    const qty = nums.length >= 2 && /^\d{1,3}$/.test(nums[0][0]) ? nums[0][0] : '';
    let label = p
      .slice(0, last.index)
      .replace(qty ? new RegExp(`^\\s*${qty}\\b`) : /^$/, '')
      .replace(FILLERS[lang], ' ')
      .replace(/[\d.,]+/g, ' ')
      .replace(/(?<![\p{L}\p{N}])(?:x|vezes|times|veces|unidades?|units?|pacotes?|packs?|paquetes?)(?![\p{L}\p{N}])/giu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!label) label = p.slice(last.index! + last[0].length).replace(FILLERS[lang], ' ').replace(/\s+/g, ' ').trim();
    if (!label) label = lang === 'en' ? 'Item' : 'Item';
    // milhares com separador ("10000" → "10.000")
    if (/^\d{4,}$/.test(value)) value = value.replace(/\B(?=(\d{3})+(?!\d))/g, opts.decimal === 'comma' ? '.' : ',');
    value = `${opts.symbol} ${value}${mult}`;
    const sign = income ? '' : '';
    const tone = income ? 'income' : said ?? classifyTerm(label) ?? overall;
    out.push({ line: `${cap(label)}: ${sign}${qty && qty !== '1' ? `${qty} * ` : ''}${value}`, tone });
  }
  return out;
}

/** Instrução para a IA converter o ditado (usada com o comando inline). */
export const dictationGoal = (transcript: string, lang: Lang) =>
  ({
    pt: `Transforme este ditado em linhas de cálculo para a nota, uma por item, no formato "Item: valor" (com moeda; quantidade × preço quando houver). Se a nota já tiver seções (#Despesas, #Gastos, #Receitas…), use os nomes que já existem; senão, separe em #Receitas e #Despesas só se houver os dois tipos. Responda SOMENTE com os itens novos deste ditado: NÃO repita linhas, itens, títulos ou totais que já estão na nota. Não invente valores; o que não tiver número vira comentário "//". Ditado: "${transcript}"`,
    en: `Turn this dictation into calculator lines for the note, one per item, as "Item: value" (with currency; quantity × price when given). If the note already has sections, reuse their names; otherwise split into #Income and #Expenses only if both kinds appear. Reply ONLY with the new items from this dictation: do NOT repeat lines, items, headings or totals already in the note. Don't invent values; anything without a number becomes a "//" comment. Dictation: "${transcript}"`,
    es: `Convierte este dictado en líneas de cálculo para la nota, una por ítem, como "Ítem: valor" (con moneda; cantidad × precio cuando haya). Si la nota ya tiene secciones, usa sus nombres; si no, separa en #Ingresos y #Gastos solo si aparecen ambos. Responde SOLO con los ítems nuevos de este dictado: NO repitas líneas, ítems, títulos ni totales que ya están en la nota. No inventes valores; lo que no tenga número va como comentario "//". Dictado: "${transcript}"`,
  })[lang];
