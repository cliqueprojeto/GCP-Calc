/**
 * Provedores de IA: Anthropic, OpenAI, Google Gemini, Mistral, Groq, DeepSeek,
 * xAI, OpenRouter, Ollama (local) e qualquer servidor compatível com a API da OpenAI.
 */
import Anthropic from '@anthropic-ai/sdk';
import { netFetch } from '../lib/platform';
import type { AiProvider, AiProviderId } from '../lib/types';

export interface ProviderMeta {
  kind: AiProviderId;
  name: string;
  baseUrl: string;
  keyUrl: string;
  needsKey: boolean;
  hint: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { kind: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys', needsKey: true, hint: 'sk-ant-…' },
  { kind: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true, hint: 'sk-…' },
  { kind: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/app/apikey', needsKey: true, hint: 'AIza…' },
  { kind: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true, hint: '' },
  { kind: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', needsKey: true, hint: 'gsk_…' },
  { kind: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', needsKey: true, hint: 'sk-…' },
  { kind: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai', needsKey: true, hint: 'xai-…' },
  { kind: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', needsKey: true, hint: 'sk-or-…' },
  { kind: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434', keyUrl: 'https://ollama.com/download', needsKey: false, hint: '' },
  { kind: 'custom', name: 'OpenAI-compatible', baseUrl: 'http://localhost:1234/v1', keyUrl: '', needsKey: false, hint: '' },
];

export const providerMeta = (k: AiProviderId) => PROVIDERS.find((p) => p.kind === k)!;

/** Reconhece o provedor pelo formato da chave colada. */
export function guessProvider(key: string): AiProviderId | null {
  const k = key.trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

export const base = (p: AiProvider) => (p.baseUrl || providerMeta(p.kind).baseUrl).replace(/\/+$/, '');

function anthropicClient(p: AiProvider) {
  return new Anthropic({
    apiKey: p.apiKey,
    baseURL: p.baseUrl || undefined,
    dangerouslyAllowBrowser: true,
    fetch: netFetch as unknown as typeof fetch,
    maxRetries: 2,
  });
}

export async function json(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* resposta não JSON */
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

export async function listModels(p: AiProvider): Promise<string[]> {
  switch (p.kind) {
    case 'anthropic': {
      const client = anthropicClient(p);
      const ids: string[] = [];
      for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
      return ids;
    }
    case 'gemini': {
      const data = await json(await netFetch(`${base(p)}/models?pageSize=200&key=${encodeURIComponent(p.apiKey)}`));
      return (data.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m: any) => String(m.name).replace(/^models\//, ''));
    }
    case 'ollama': {
      const data = await json(await netFetch(`${base(p)}/api/tags`));
      return (data.models || []).map((m: any) => m.name);
    }
    default: {
      const headers: Record<string, string> = {};
      if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;
      const data = await json(await netFetch(`${base(p)}/models`, { headers }));
      return (data.data || data.models || []).map((m: any) => m.id || m.name).filter(Boolean);
    }
  }
}

const EXCLUDE = /(embed|whisper|tts|audio|speech|transcri|dall-e|image|imagen|veo|moderation|realtime|rerank|guard|computer-use|aqa|babbage|davinci|instruct|ocr|sora|gpt-3\.5)/i;

function versionOf(id: string): number {
  const m = id.match(/(\d+(?:[.-]\d)?)/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace('-', '.'));
  return v > 100 ? 0 : v;
}

/** Pontuação heurística de capacidade para escolher o modelo padrão. */
export function scoreModel(kind: AiProviderId, raw: string): number {
  const id = raw.toLowerCase();
  if (EXCLUDE.test(id)) return -1;
  const name = id.includes('/') ? id.split('/').pop()! : id;
  let s: number;
  if (/claude/.test(name)) {
    const m = name.match(/(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d))?(?!\d)/);
    const ver = m ? parseFloat(m[1] + (m[2] ? '.' + m[2] : '')) : 0;
    const tier = /opus/.test(name) ? 400 : /fable|mythos/.test(name) ? 390 : /sonnet/.test(name) ? 300 : /haiku/.test(name) ? 150 : 100;
    s = tier + ver * 10;
  } else if (/^(gpt|o\d)/.test(name)) s = 200 + versionOf(name) * 30;
  else if (/gemini/.test(name)) s = 200 + versionOf(name.replace('gemini-', '')) * 30 + (/pro/.test(name) ? 40 : /flash/.test(name) ? 20 : 0);
  else s = 150 + versionOf(name) * 3;
  if (/(^|[-_.])(nano|tiny)([-_.]|$)/.test(name)) s -= 70;
  else if (/(^|[-_.])(mini|lite|small)([-_.]|$)/.test(name)) s -= 40;
  if (/preview/.test(name)) s -= 4;
  if (/\d{8}/.test(name)) s -= 2;
  return s;
}

export function rankModels(kind: AiProviderId, ids: string[]): string[] {
  return [...new Set(ids)]
    .map((id) => ({ id, s: scoreModel(kind, id) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    .map((x) => x.id);
}

export const FALLBACK_MODEL: Partial<Record<AiProviderId, string>> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  xai: 'grok-4',
  openrouter: 'anthropic/claude-opus-5-5',
};

/** Testa a chave: lista e ordena os modelos e devolve o provedor atualizado. */
export async function testProvider(p: AiProvider): Promise<AiProvider> {
  const ids = await listModels(p);
  const ranked = rankModels(p.kind, ids);
  const best = p.model && ids.includes(p.model) ? p.model : ranked[0] || FALLBACK_MODEL[p.kind] || ids[0];
  return { ...p, models: ranked.length ? ranked : ids, model: best, checkedAt: Date.now() };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(p: AiProvider, system: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const model = p.model || FALLBACK_MODEL[p.kind] || '';
  switch (p.kind) {
    case 'anthropic': {
      const client = anthropicClient(p);
      const res = await client.messages.create({ model, max_tokens: 16000, system, messages }, { signal });
      if (res.stop_reason === 'refusal') throw new Error('refusal');
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }
    case 'gemini': {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { responseMimeType: 'application/json' },
      };
      const data = await json(
        await netFetch(`${base(p)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        }),
      );
      return (data.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
    }
    case 'ollama': {
      const data = await json(
        await netFetch(`${base(p)}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'system', content: system }, ...messages] }),
          signal,
        }),
      );
      return String(data.message?.content || '').trim();
    }
    default: {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;
      if (p.kind === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/cliqueprojeto/GCP-Calc';
        headers['X-Title'] = 'GCP-Calc';
      }
      const data = await json(
        await netFetch(`${base(p)}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages] }),
          signal,
        }),
      );
      const c = data.choices?.[0]?.message?.content;
      return (Array.isArray(c) ? c.map((x: any) => x.text || '').join('') : String(c || '')).trim();
    }
  }
}
