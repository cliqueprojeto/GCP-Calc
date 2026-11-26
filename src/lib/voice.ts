/**
 * Anotações por voz: gravação (MediaRecorder), ditado ao vivo quando a WebView oferece
 * reconhecimento de fala, transcrição pela IA configurada (OpenAI, Groq, Mistral ou Gemini)
 * e conversão do que foi dito em linhas de cálculo.
 */
import type { AiProvider, Lang } from './types';
import { base, json } from '../ai/providers';
import { netFetch } from './platform';

export const MAX_RECORD_MS = 5 * 60_000;

const SPEECH_LANG: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac']) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return '';
}

export const canRecord = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};
const SpeechCtor = (): (new () => SR) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
export const canLiveDictate = () => typeof window !== 'undefined' && !!SpeechCtor();

export interface Recording {
  blob: Blob;
  mime: string;
  ms: number;
  /** texto do ditado ao vivo (quando houve) */
  live: string;
}

/** Gravador com medidor de nível e ditado ao vivo opcional. */
export class Recorder {
  private stream?: MediaStream;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private started = 0;
  private ctx?: AudioContext;
  private raf = 0;
  private sr?: SR;
  private finalText = '';
  private interim = '';
  private stopping = false;

  constructor(
    private lang: Lang,
    private onLevel: (v: number) => void,
    private onLive: (text: string) => void,
  ) {}

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
    this.started = Date.now();
    // medidor de nível
    try {
      this.ctx = new AudioContext();
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        this.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      /* sem medidor */
    }
    // ditado ao vivo (Chrome/Android no navegador); no app instalado normalmente não existe
    const Ctor = SpeechCtor();
    if (Ctor) {
      try {
        const sr = new Ctor();
        sr.lang = SPEECH_LANG[this.lang];
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) this.finalText += r[0].transcript + ' ';
            else interim += r[0].transcript;
          }
          this.interim = interim;
          this.onLive((this.finalText + interim).trim());
        };
        sr.onerror = () => undefined;
        sr.onend = () => {
          // o reconhecimento para sozinho em pausas longas: retoma enquanto grava
          if (!this.stopping) {
            try {
              sr.start();
            } catch {
              /* já parado */
            }
          }
        };
        sr.start();
        this.sr = sr;
      } catch {
        this.sr = undefined;
      }
    }
  }

  get elapsed() {
    return this.started ? Date.now() - this.started : 0;
  }

  async stop(): Promise<Recording> {
    this.stopping = true;
    cancelAnimationFrame(this.raf);
    try {
      this.sr?.stop();
    } catch {
      /* ok */
    }
    const ms = this.elapsed;
    const rec = this.rec;
    const done = new Promise<void>((r) => {
      if (!rec || rec.state === 'inactive') return r();
      rec.onstop = () => r();
    });
    rec?.state !== 'inactive' && rec?.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    const mime = rec?.mimeType || 'audio/webm';
    return { blob: new Blob(this.chunks, { type: mime }), mime, ms, live: (this.finalText + this.interim).trim() };
  }

  cancel() {
    void this.stop();
  }
}

// ------------------------------------------------------------------ transcrição

/** Provedores que transcrevem áudio (nessa ordem de preferência). */
const AUDIO_KINDS = ['groq', 'openai', 'gemini', 'mistral'] as const;
export const audioProviders = (ps: AiProvider[]) =>
  [...ps].filter((p) => (AUDIO_KINDS as readonly string[]).includes(p.kind) && (p.apiKey || p.kind === 'custom')).sort((a, b) => AUDIO_KINDS.indexOf(a.kind as never) - AUDIO_KINDS.indexOf(b.kind as never));

const TRANSCRIBE_MODEL: Record<string, string[]> = {
  openai: ['gpt-4o-mini-transcribe', 'whisper-1'],
  groq: ['whisper-large-v3-turbo', 'whisper-large-v3'],
  mistral: ['voxtral-mini-latest'],
};

const extFor = (mime: string) => (mime.includes('mp4') || mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

function multipart(fields: Record<string, string>, file: { name: string; type: string; data: Uint8Array }) {
  const boundary = '----gcpcalc' + Math.random().toString(16).slice(2);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
  parts.push(file.data);
  parts.push(enc.encode(`\r\n--${boundary}--\r\n`));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const body = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    body.set(p, o);
    o += p.length;
  }
  return { body, type: `multipart/form-data; boundary=${boundary}` };
}

const toB64 = (u8: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function transcribeWith(p: AiProvider, audio: Uint8Array, mime: string, lang: Lang): Promise<string> {
  const cleanMime = mime.split(';')[0];
  if (p.kind === 'gemini') {
    const model = p.model && /gemini/.test(p.model) ? p.model : 'gemini-2.5-flash';
    const data = await json(
      await netFetch(`${base(p)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `Transcribe this audio verbatim in ${SPEECH_LANG[lang]}. Keep numbers as digits and currency as spoken. Reply with the transcript only.` },
                { inline_data: { mime_type: cleanMime, data: toB64(audio) } },
              ],
            },
          ],
        }),
      }),
    );
    return (data.candidates?.[0]?.content?.parts || []).map((x: { text?: string }) => x.text || '').join('').trim();
  }
  let lastErr: unknown;
  for (const model of TRANSCRIBE_MODEL[p.kind] ?? ['whisper-1']) {
    try {
      const mp = multipart({ model, language: lang, response_format: 'json' }, { name: `nota.${extFor(cleanMime)}`, type: cleanMime, data: audio });
      const headers: Record<string, string> = { 'Content-Type': mp.type };
      if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;
      const data = await json(await netFetch(`${base(p)}/audio/transcriptions`, { method: 'POST', headers, body: mp.body }));
      return String(data.text ?? '').trim();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Transcreve com o primeiro provedor que funcionar. */
export async function transcribe(providers: AiProvider[], blob: Blob, lang: Lang): Promise<string> {
  const list = audioProviders(providers);
  if (!list.length) throw new Error('no-audio-provider');
  const audio = new Uint8Array(await blob.arrayBuffer());
  let lastErr: unknown;
  for (const p of list) {
    try {
      const text = await transcribeWith(p, audio, blob.type || 'audio/webm', lang);
      if (text) return text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('empty');
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

export async function dataUrlToBlob(url: string): Promise<Blob> {
  const [head, data] = url.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'audio/webm';
  const bin = atob(data);
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: mime });
}
