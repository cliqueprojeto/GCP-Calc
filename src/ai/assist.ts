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

/** Pede o próximo passo à IA a partir do objetivo, do contexto da nota e das respostas já dadas. */
export async function nextStep(
  provider: AiProvider,
  opts: { lang: Lang; decimal: 'comma' | 'dot'; baseCurrency: string; goal: string; noteContext: string; turns: Turn[] },
  signal?: AbortSignal,
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
  const sys = systemPrompt(opts.lang, opts.decimal, opts.baseCurrency);
  const raw = await chat(provider, sys, messages, signal);
  try {
    return parseStep(raw);
  } catch {
    // uma nova tentativa pedindo o formato
    const retry = await chat(provider, sys, [...messages, { role: 'assistant', content: raw }, { role: 'user', content: 'Reply again with ONLY the JSON object.' }], signal);
    return parseStep(retry);
  }
}
