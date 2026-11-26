/** Transcrição offline embutida (Whisper). */
import type { Lang } from './types';

let worker: Worker | null = null;
let available: boolean | null = null;

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

export async function transcribeOffline(blob: Blob, lang: Lang, opts: { translate?: boolean; onStatus?: (s: 'loading' | 'working' | number) => void } = {}): Promise<string> {
  const audio = await toPcm16k(blob);
  worker ??= new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'status') opts.onStatus?.(m.s);
      else if (m.type === 'progress') opts.onStatus?.(m.p);
      else if (m.type === 'done') resolve(m.text);
      else if (m.type === 'error') {
        worker?.terminate();
        worker = null;
        reject(new Error(m.s));
      }
    };
    w.onerror = (e) => {
      worker?.terminate();
      worker = null;
      reject(new Error(e.message || 'whisper'));
    };
    w.postMessage({ audio, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: opts.translate ? 'translate' : 'transcribe', base: base() }, [audio.buffer]);
  });
}
