/** Transcrição offline embutida (Whisper). */
import type { Lang } from './types';

let worker: Worker | null = null;
let available: boolean | null = null;
let ready = false;
let warming: Promise<void> | null = null;

const base = () => new URL('./', location.href).href;

/** O modelo foi embutido neste build? */
export async function offlineAvailable(): Promise<boolean> {
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
  warming = new Promise<void>((resolve, reject) => {
    const h = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        ready = true;
        w.removeEventListener('message', h);
        resolve();
      } else if (e.data.type === 'error') {
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
  return new Promise((resolve, reject) => {
    const h = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'status') opts.onStatus?.(m.s);
      else if (m.type === 'progress') opts.onStatus?.(m.p);
      else if (m.type === 'done') {
        w.removeEventListener('message', h);
        ready = true;
        resolve(m.text);
      } else if (m.type === 'error') {
        w.removeEventListener('message', h);
        worker?.terminate();
        worker = null;
        ready = false;
        warming = null;
        reject(new Error(m.s));
      }
    };
    w.addEventListener('message', h);
    w.onerror = (e) => {
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
