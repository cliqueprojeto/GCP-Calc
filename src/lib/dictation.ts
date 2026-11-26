/**
 * Ditado → linhas de cálculo, sem IA: "comprei arroz por 27,90, feijão 8 reais e 49 centavos
 * e paguei a luz 150" vira "Arroz: R$ 27,90", "Feijão: R$ 8,49", "Luz: R$ 150,00".
 * Com IA configurada, o app pede a ela a mesma conversão (mais esperta) e usa esta como reserva.
 */
import type { Lang } from './types';

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

/** "8 reais e 49 centavos" → "8,49 reais"; "1 mil e 200" → "1200" */
function normalizeMoney(t: string, lang: Lang, dec: string): string {
  let s = t.replace(/(\d+)\s*(?:reais|real|dólares|dolares|dollars?|euros?|pesos?)\s*(?:e|and|y|con)\s*(\d{1,2})\s*(?:centavos?|cents?|céntimos?|centimos?)/gi, (_, a, b) => `${a}${dec}${b.padStart(2, '0')} ${lang === 'en' ? 'dollars' : lang === 'es' ? 'euros' : 'reais'}`);
  s = s.replace(/(\d+)\s*mil\s*(?:e|y)?\s*(\d{1,3})(?![\p{L}\p{N}])/giu, (_, a, b) => String(+a * 1000 + +b));
  s = s.replace(/(\d+)\s*(?:mil|thousand)(?![\p{L}\p{N}])/giu, (_, a) => String(+a * 1000));
  return s;
}

export function dictationToLines(text: string, lang: Lang, opts: { decimal: 'comma' | 'dot'; symbol: string }): string[] {
  const dec = opts.decimal === 'comma' ? ',' : '.';
  const src = normalizeMoney(text.replace(/\s+/g, ' ').trim(), lang, dec);
  // separa itens: pontuação, quebras e " e " / " and " / " y " antes de uma palavra
  const parts = src
    .split(/[;\n]|[.!?](?=\s|$)|,(?=\s*\D)|\s+(?:e|and|y|mais|plus)\s+(?=[\p{L}])/u)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let p of parts) {
    const income = INCOME[lang].test(p);
    for (let i = 0; i < 3; i++) p = p.replace(VERBS[lang], '');
    // último número do trecho é o valor (aceita 1.234,56 / 1,234.56 / 27,90)
    const nums = [...p.matchAll(/\d[\d.,]*/g)];
    if (!nums.length) {
      if (p.length > 2) out.push(`// ${cap(p)}`);
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
    value = `${opts.symbol} ${value}`;
    const sign = income ? '' : '';
    out.push(`${cap(label)}: ${sign}${qty && qty !== '1' ? `${qty} * ` : ''}${value}`);
  }
  return out;
}

/** Instrução para a IA converter o ditado (usada com o comando inline). */
export const dictationGoal = (transcript: string, lang: Lang) =>
  ({
    pt: `Transforme este ditado em linhas de cálculo para a nota, uma por item, no formato "Item: valor" (com moeda; quantidade × preço quando houver). Separe em #Receitas e #Despesas só se houver os dois tipos. Não invente valores; o que não tiver número vira comentário "//". Ditado: "${transcript}"`,
    en: `Turn this dictation into calculator lines for the note, one per item, as "Item: value" (with currency; quantity × price when given). Split into #Income and #Expenses only if both kinds appear. Don't invent values; anything without a number becomes a "//" comment. Dictation: "${transcript}"`,
    es: `Convierte este dictado en líneas de cálculo para la nota, una por ítem, como "Ítem: valor" (con moneda; cantidad × precio cuando haya). Separa en #Ingresos y #Gastos solo si aparecen ambos. No inventes valores; lo que no tenga número va como comentario "//". Dictado: "${transcript}"`,
  })[lang];
