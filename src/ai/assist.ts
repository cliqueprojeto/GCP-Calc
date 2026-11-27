/**
 * Assistente guiado por IA: em vez de um chat paralelo, a IA conduz passo a passo
 * dentro da nota, devolvendo sempre UM passo em JSON — uma pergunta com escolhas,
 * campo numérico ou de texto — até chegar às linhas de cálculo que entram na nota.
 */
import { chat, type ChatMessage } from './providers';
import type { AiProvider, Lang } from '../lib/types';

export type StepInput = 'choice' | 'multi' | 'number' | 'text';

export interface AskStep {
  type: 'ask';
  question: string;
  input: StepInput;
  options?: string[];
  placeholder?: string;
  hint?: string;
}

export interface ResultStep {
  type: 'result';
  title?: string;
  explanation: string;
  lines: string[];
  /** sugestões de próximos passos (viram botões) */
  followups?: string[];
}

export type AssistStep = AskStep | ResultStep;

export interface Turn {
  step: AssistStep;
  answer?: string;
}

const LANG_NAME: Record<Lang, string> = { pt: 'português do Brasil', en: 'English', es: 'español' };

export function systemPrompt(lang: Lang, decimal: 'comma' | 'dot', baseCurrency: string) {
  const dec = decimal === 'comma' ? 'vírgula decimal (1.234,56) e ";" para separar argumentos de funções' : 'decimal point (1,234.56) and ";" or ", " between function arguments';
  return `You are the step-by-step assistant inside GCP-Calc, a notes calculator (like Soulver/Numi).
You guide the user with short, concrete questions, one at a time, until you can produce calculator lines.
Always reply in ${LANG_NAME[lang]}.

Reply with ONLY one JSON object, no markdown, no code fences, in one of these shapes:
{"type":"ask","question":"...","input":"choice"|"multi"|"number"|"text","options":["..."],"placeholder":"...","hint":"..."}
{"type":"result","title":"...","explanation":"...","lines":["..."],"followups":["..."]}

Rules for "ask": prefer "choice" with 2-6 short options whenever reasonable (the UI shows them as buttons; the user can still type).
Ask at most 5 questions in total; when you have enough, return "result". If the request is already clear, return "result" immediately.

Rules for "lines" (they are inserted into the note and evaluated live by the calculator engine):
- Use ${dec}.
- One calculation per line. Assign variables with "name = expression" (names may contain spaces, no accents needed) and reuse them below.
- Start with a heading line "# Title". Comments start with "//".
- Currencies: symbols (R$, US$, €, £) or ISO codes (100 USD). Default currency: ${baseCurrency}. Conversion: "100 USD em BRL" / "in" / "to".
- Percentages: "valor + 10%", "valor - 15%", "20% de valor", "x em % de y".
- Units: km, m, kg, L, h, min, °C, GB, m², km/h ... with conversion "5 km em milhas".
- Functions: sqrt(x), round(x; 2), pmt(rate; periods; present value) for fixed installments, fv(rate; periods; payment; initial), pv(...), min, max, avg.
- Dates: "hoje + 30 dias", "25/12/2026 - hoje".
- "total" alone sums the lines above in the same block; "média" averages them.
- Sections: a line "#Receitas" (no space after #) opens a named section; entries below it ("Salário: R$ 3.000") belong to it until the next "#Name".
  "#Receitas" inside an expression is the section's sum: "Total #Receitas", "Saldo: #Receitas - #Despesas" (expenses may be written as positive or negative; they are subtracted by absolute value), "Saldo %" = saldo as % of income.
  For budgets, always organize money into #Receitas / #Despesas (or the user's own names) with a total per section, a "Saldo" line and "Saldo %".
- Income vs expense: income = receitas, ganhos, recebimentos, vendas, lucro, faturamento, salário, honorários, prestação de serviços, cachê, entradas, "recebi/vendi/ganhei" (income, revenue, sales, earnings; ingresos, ventas, ganancias). Expenses = despesas, gastos, compras, dispêndios, débitos, pagamentos, custos, contas, boletos, saídas, cartão de crédito, "comprei/paguei/gastei" (expenses, costs, purchases, bills; gastos, egresos, compras, pagos).
- If the note already has sections (e.g. "#Despesas", "#Gastos", "#Receitas"), add new entries under the EXISTING section names — never create a duplicate section with a synonym.
- Entries use "Label: value". Write money with the currency symbol (R$ 1.500,00). Quantities (people, days, units) stay plain numbers without currency.
Keep "explanation" to 1-3 sentences. "followups": up to 3 short follow-up ideas.`;
}

/** Extrai o primeiro objeto JSON da resposta (tolera cercas de código e texto em volta). */
export function parseStep(text: string): AssistStep {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  const o = JSON.parse(t);
  if (o.type === 'ask' && typeof o.question === 'string') {
    const input: StepInput = ['choice', 'multi', 'number', 'text'].includes(o.input) ? o.input : o.options?.length ? 'choice' : 'text';
    return { type: 'ask', question: o.question, input, options: Array.isArray(o.options) ? o.options.map(String).slice(0, 8) : undefined, placeholder: o.placeholder, hint: o.hint };
  }
  if (o.type === 'result' && Array.isArray(o.lines)) {
    return { type: 'result', title: o.title, explanation: String(o.explanation || ''), lines: o.lines.map(String), followups: Array.isArray(o.followups) ? o.followups.map(String).slice(0, 3) : [] };
  }
  throw new Error('bad-step');
}

// ------------------------------------------------------------ resiliência

/** Erros passageiros do provedor (sobrecarga, limite de uso, rede): vale tentar de novo. */
export function isTransient(e: unknown): boolean {
  const err = e as { status?: number; message?: string };
  const status = err?.status;
  if (status && [408, 409, 425, 429, 500, 502, 503, 504, 529].includes(status)) return true;
  return /\b(408|429|500|502|503|504|529)\b|overload|high demand|rate.?limit|too many requests|temporar|unavailable|timed? ?out|network|fetch failed|ECONN/i.test(String(err?.message ?? e));
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('aborted', 'AbortError'))), { once: true });
  });

/**
 * Conversa com tolerância a falhas: tenta de novo em erros passageiros (503 "high demand",
 * 429, rede) e, se o modelo continuar indisponível, passa para outros modelos do mesmo
 * provedor e depois para os outros provedores configurados.
 */
export async function resilientChat(
  providers: AiProvider[],
  system: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
  onFallback?: (label: string) => void,
): Promise<string> {
  const plan: AiProvider[] = [];
  for (const p of providers) {
    plan.push(p);
    // até 2 modelos alternativos do mesmo provedor (os mais capazes da lista já ordenada)
    for (const m of (p.models ?? []).filter((m) => m !== p.model).slice(0, 2)) plan.push({ ...p, model: m });
  }
  let lastErr: unknown = new Error('no-provider');
  const dead = new Set<string>();
  for (let k = 0; k < plan.length; k++) {
    const p = plan[k];
    if (dead.has(p.id)) continue;
    if (k > 0) onFallback?.(`${p.name}${p.model ? ' · ' + p.model : ''}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await chat(p, system, messages, signal);
      } catch (e) {
        if (signal?.aborted) throw e;
        lastErr = e;
        if (!isTransient(e)) {
          // chave inválida, modelo inexistente etc.: não adianta insistir neste provedor
          if (/\b(401|403)\b|api key|unauthor|forbidden|permission/i.test(String((e as Error)?.message ?? e))) dead.add(p.id);
          break;
        }
        if (attempt < 2) await sleep(1500 * (attempt + 1) ** 2, signal);
      }
    }
  }
  throw lastErr;
}

/** Pede o próximo passo à IA a partir do objetivo, do contexto da nota e das respostas já dadas. */
export async function nextStep(
  providers: AiProvider[],
  opts: { lang: Lang; decimal: 'comma' | 'dot'; baseCurrency: string; goal: string; noteContext: string; turns: Turn[]; inline?: boolean },
  signal?: AbortSignal,
  onFallback?: (label: string) => void,
): Promise<AssistStep> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Current note (lines with computed results after "→"):\n${opts.noteContext || '(empty)'}\n\nWhat I want: ${opts.goal}`,
    },
  ];
  for (const t of opts.turns) {
    messages.push({ role: 'assistant', content: JSON.stringify(t.step) });
    if (t.answer !== undefined) messages.push({ role: 'user', content: t.answer });
  }
  let sys = systemPrompt(opts.lang, opts.decimal, opts.baseCurrency);
  if (opts.inline) {
    sys += `\n\nThe user typed this request directly inside the note (command "/ia"). Reply with "result" right away whenever possible: make reasonable assumptions and state them in a "//" comment line. Use "ask" only if an essential number is truly missing and cannot be assumed.`;
  }
  const raw = await resilientChat(providers, sys, messages, signal, onFallback);
  try {
    return parseStep(raw);
  } catch {
    // uma nova tentativa pedindo o formato
    const retry = await resilientChat(providers, sys, [...messages, { role: 'assistant', content: raw }, { role: 'user', content: 'Reply again with ONLY the JSON object.' }], signal, onFallback);
    return parseStep(retry);
  }
}

/** Provedores na ordem de uso: o ativo primeiro, depois os demais (como reserva). */
export function orderedProviders(list: AiProvider[], activeId?: string): AiProvider[] {
  const active = list.find((p) => p.id === activeId) ?? list[0];
  return active ? [active, ...list.filter((p) => p.id !== active.id)] : [];
}
