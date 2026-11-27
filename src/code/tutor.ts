/**
 * Tutor de programação com a IA configurada: explica o código na língua do app, ajuda a
 * corrigir erros, cria desafios no nível do aluno e confere a solução.
 */
import type { AiProvider, Lang } from '../lib/types';
import { LANG_NAME, resilientChat } from '../ai/assist';
import { langMeta } from './langs';

export interface Challenge {
  title: string;
  statement: string;
  starter: string;
  /** saída esperada no terminal (quando dá para conferir automaticamente) */
  expected?: string;
  hint?: string;
}

function json<T>(raw: string): T {
  let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t) as T;
}

const sys = (lang: Lang) =>
  `You are a friendly, precise programming tutor inside a notes app with a code playground. Always answer in ${LANG_NAME[lang]}. ` +
  `Explain simply, like a good teacher, using short paragraphs and bullet points; quote code with backticks. Never invent APIs.`;

export async function explainCode(providers: AiProvider[], lang: Lang, codeLang: string, code: string, output?: string): Promise<string> {
  const m = langMeta(codeLang);
  return (
    await resilientChat(providers, sys(lang), [
      {
        role: 'user',
        content: `Explique este código ${m.name} para um iniciante: o que ele faz, linha a linha (agrupe linhas simples), conceitos usados e uma dica para melhorar.${output ? `\n\nSaída ao rodar:\n${output.slice(0, 2000)}` : ''}\n\n\`\`\`${m.id}\n${code.slice(0, 8000)}\n\`\`\``,
      },
    ])
  ).trim();
}

export async function fixCode(providers: AiProvider[], lang: Lang, codeLang: string, code: string, output: string): Promise<{ explanation: string; code?: string }> {
  const m = langMeta(codeLang);
  const raw = await resilientChat(providers, sys(lang) + ' Reply with ONLY JSON: {"explanation":"...","code":"full corrected code or empty"}', [
    { role: 'user', content: `Este código ${m.name} deu erro ou não fez o esperado. Explique a causa em palavras simples e corrija (mantendo o estilo do aluno).\n\nErro/saída:\n${output.slice(0, 3000)}\n\nCódigo:\n\`\`\`${m.id}\n${code.slice(0, 8000)}\n\`\`\`` },
  ]);
  try {
    return json<{ explanation: string; code?: string }>(raw);
  } catch {
    return { explanation: raw };
  }
}

export async function makeChallenge(providers: AiProvider[], lang: Lang, codeLang: string, context: string): Promise<Challenge> {
  const m = langMeta(codeLang);
  const raw = await resilientChat(
    providers,
    sys(lang) +
      ' Reply with ONLY JSON: {"title":"...","statement":"what to build, with an example of input/output","starter":"starter code with TODO comments","expected":"exact terminal output of a correct solution, or empty if it varies","hint":"one short hint"}',
    [
      {
        role: 'user',
        content: `Crie um desafio curto e divertido de ${m.name} (5 a 15 minutos), no nível do aluno, que rode no playground (sem bibliotecas externas${m.runtime === 'python' ? ', sem input()' : ''}). Baseie-se no que ele está estudando:\n${context.slice(0, 4000)}`,
      },
    ],
  );
  const c = json<Challenge>(raw);
  return { title: String(c.title || ''), statement: String(c.statement || ''), starter: String(c.starter || ''), expected: c.expected ? String(c.expected) : undefined, hint: c.hint ? String(c.hint) : undefined };
}

export async function reviewSolution(providers: AiProvider[], lang: Lang, codeLang: string, challenge: string, code: string, output: string): Promise<{ ok: boolean; feedback: string }> {
  const m = langMeta(codeLang);
  const raw = await resilientChat(providers, sys(lang) + ' Reply with ONLY JSON: {"ok":true|false,"feedback":"..."}', [
    { role: 'user', content: `Desafio:\n${challenge}\n\nSolução do aluno (${m.name}):\n\`\`\`${m.id}\n${code.slice(0, 8000)}\n\`\`\`\n\nSaída ao rodar:\n${output.slice(0, 3000)}\n\nA solução resolve o desafio? Dê um retorno curto e encorajador; se não resolve, uma pista (sem entregar a resposta).` },
  ]);
  try {
    const r = json<{ ok: boolean; feedback: string }>(raw);
    return { ok: !!r.ok, feedback: String(r.feedback || '') };
  } catch {
    return { ok: false, feedback: raw };
  }
}

/** compara a saída do aluno com a esperada (ignorando espaços nas pontas e linhas vazias finais) */
export const sameOutput = (a: string, b: string) => a.trim().replace(/\s+\n/g, '\n').replace(/\r/g, '') === b.trim().replace(/\s+\n/g, '\n').replace(/\r/g, '');
