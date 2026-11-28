/** Transcrição offline embutida (Whisper). */
import type { Lang } from './types';

let worker: Worker | null = null;
let available: boolean | null = null;
let ready = false;
let warming: Promise<void> | null = null;

const base = () => new URL('./', location.href).href;

const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const GUARD = 'gcp-calc:whisper-guard';
const OFF = 'gcp-calc:whisper-off';
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* sem armazenamento */
    }
  },
};

/**
 * Proteção do celular: carregar o modelo usa bastante memória e, em aparelhos mais modestos,
 * o Android pode fechar o app. Se a última carga não terminou (o app fechou no meio), a
 * transcrição offline fica desligada neste aparelho. Devolve true quando isso acabou de acontecer.
 */
export function checkWhisperCrash(): boolean {
  if (!isPhone || !ls.get(GUARD)) return false;
  ls.set(GUARD, null);
  ls.set(OFF, '1');
  return true;
}
export const offlineDisabledHere = () => ls.get(OFF) === '1';
export function enableOfflineHere() {
  ls.set(OFF, null);
  available = null;
}
/** celular com pouca memória (navigator.deviceMemory em GB, quando o sistema informa) */
const lowMemory = () => {
  const m = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return isPhone && typeof m === 'number' && m < 4;
};
/** No celular o modelo só carrega quando for mesmo transcrever (não ao abrir a tela de voz). */
export const preloadOffline = () => !isPhone;

/** O modelo foi embutido neste build (e pode ser usado neste aparelho)? */
export async function offlineAvailable(): Promise<boolean> {
  if (offlineDisabledHere() || lowMemory()) return false;
  if (available !== null) return available;
  try {
    const r = await fetch(base() + 'runtimes/whisper/onnx-community/whisper-base/config.json');
    available = r.ok;
  } catch {
    available = false;
  }
  return available;
}

export const offlineReady = () => ready;

const getWorker = () => (worker ??= new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' }));

/** Começa a carregar o modelo já (a primeira carga pode levar mais de um minuto em alguns aparelhos). */
export function warmUp(lang: Lang): Promise<void> {
  if (ready) return Promise.resolve();
  if (warming) return warming;
  const w = getWorker();
  if (isPhone) ls.set(GUARD, String(Date.now()));
  warming = new Promise<void>((resolve, reject) => {
    const h = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        ready = true;
        ls.set(GUARD, null);
        w.removeEventListener('message', h);
        resolve();
      } else if (e.data.type === 'error') {
        ls.set(GUARD, null);
        w.removeEventListener('message', h);
        warming = null;
        reject(new Error(e.data.s));
      }
    };
    w.addEventListener('message', h);
    w.postMessage({ warm: true, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: 'transcribe', base: base() });
  });
  return warming;
}

/** Áudio gravado → PCM mono 16 kHz (o que o Whisper espera). */
async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const decoded = await ctx.decodeAudioData(buf.slice(0));
  await ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

export async function transcribeOffline(input: Blob | Float32Array, lang: Lang, opts: { translate?: boolean; onStatus?: (s: 'loading' | 'working' | number) => void } = {}): Promise<string> {
  const audio = input instanceof Float32Array ? input : await toPcm16k(input);
  if (audio.length < 1600) throw new Error('áudio vazio');
  const w = getWorker();
  if (isPhone && !ready) ls.set(GUARD, String(Date.now()));
  return new Promise((resolve, reject) => {
    const h = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'status') opts.onStatus?.(m.s);
      else if (m.type === 'progress') opts.onStatus?.(m.p);
      else if (m.type === 'done') {
        w.removeEventListener('message', h);
        ls.set(GUARD, null);
        ready = true;
        resolve(m.text);
      } else if (m.type === 'error') {
        w.removeEventListener('message', h);
        ls.set(GUARD, null);
        worker?.terminate();
        worker = null;
        ready = false;
        warming = null;
        reject(new Error(m.s));
      }
    };
    w.addEventListener('message', h);
    w.onerror = (e) => {
      ls.set(GUARD, null);
      worker?.terminate();
      worker = null;
      ready = false;
      warming = null;
      reject(new Error(e.message || 'whisper'));
    };
    const copy = new Float32Array(audio);
    w.postMessage({ audio: copy, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: opts.translate ? 'translate' : 'transcribe', base: base() }, [copy.buffer]);
  });
}
