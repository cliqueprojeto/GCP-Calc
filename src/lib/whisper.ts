/** Transcrição offline embutida (Whisper). */
import type { Lang } from './types';

let worker: Worker | null = null;
let available: boolean | null = null;
let ready = false;
let warming: Promise<void> | null = null;

const base = () => new URL('./', location.href).href;

const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const GUARD = 'gcp-calc:whisper-guard';
const FORCE_TINY = 'gcp-calc:whisper-tiny';
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
  const g = ls.get(GUARD);
  if (!isPhone || !g) return false;
  ls.set(GUARD, null);
  // caiu com o modelo "base": passa para o "tiny" (mais leve); caiu com o "tiny": desliga
  if (g.includes('whisper-base')) {
    ls.set(FORCE_TINY, '1');
    return false;
  }
  ls.set(OFF, '1');
  return true;
}
export const offlineDisabledHere = () => ls.get(OFF) === '1';
export function enableOfflineHere() {
  ls.set(OFF, null);
  ls.set(FORCE_TINY, '1');
  available = null;
}
/** celular com pouquíssima memória (navigator.deviceMemory em GB, quando o sistema informa) */
const lowMemory = () => {
  const m = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return isPhone && typeof m === 'number' && m < 2;
};
/**
 * Modelo: "base" (mais preciso) no computador e em celulares com 8 GB ou mais; "tiny" (leve na
 * memória) nos demais celulares ou depois que o "base" faltou memória neste aparelho.
 */
const bigPhone = () => ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0) >= 8 && ls.get(FORCE_TINY) !== '1';
const BUILTIN = !isPhone || bigPhone() ? ['onnx-community/whisper-base', 'onnx-community/whisper-tiny'] : ['onnx-community/whisper-tiny', 'onnx-community/whisper-base'];
/** modelo "preciso" (Whisper small, ~250 MB): baixado uma vez, sob demanda, e guardado no aparelho */
export const PRECISE = 'onnx-community/whisper-small';
const PRECISE_KEY = 'gcp-calc:whisper-precise';
export const preciseReady = () => ls.get(PRECISE_KEY) === 'ready';
export const preciseWanted = () => ls.get(PRECISE_KEY) === 'ready' || ls.get(PRECISE_KEY) === 'local';
/** aparelho aguenta o modelo preciso? (computador ou celular com 6 GB+) */
export const preciseSupported = () => !isPhone || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0) >= 6;
const MODELS = preciseWanted() && preciseSupported() ? [PRECISE, ...BUILTIN] : BUILTIN;
let model = MODELS[0];
export const currentModel = () => model;
/** No celular o modelo só carrega quando for mesmo transcrever (não ao abrir a tela de voz). */
export const preloadOffline = () => !isPhone;

/** O modelo foi embutido neste build (e pode ser usado neste aparelho)? */
export async function offlineAvailable(): Promise<boolean> {
  if (offlineDisabledHere() || lowMemory()) return false;
  if (available !== null) return available;
  available = false;
  for (const m of MODELS) {
    // o preciso vem da internet na primeira vez e fica no cache do aparelho
    if (m === PRECISE && preciseReady()) {
      model = m;
      available = true;
      break;
    }
    try {
      const r = await fetch(base() + `runtimes/whisper/${m}/config.json`);
      // alguns servidores devolvem a página do app (HTML) para arquivos que não existem
      if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) {
        model = m;
        available = true;
        break;
      }
    } catch {
      /* tenta o próximo */
    }
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
  if (isPhone) ls.set(GUARD, model);
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
    w.postMessage({ warm: true, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: 'transcribe', base: base(), model, remote: model === PRECISE });
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

/**
 * Limpa o áudio antes do Whisper: tira o zumbido grave (filtro passa-altas ~80 Hz), corta o
 * silêncio do começo e do fim e ajusta o volume. Ajuda bastante com microfone de celular.
 */
export function cleanAudio(x: Float32Array, sr = 16000): Float32Array {
  // passa-altas de 1ª ordem
  const rc = 1 / (2 * Math.PI * 80);
  const a = rc / (rc + 1 / sr);
  const y = new Float32Array(x.length);
  let px = 0;
  let py = 0;
  for (let i = 0; i < x.length; i++) {
    py = a * (py + x[i] - px);
    px = x[i];
    y[i] = py;
  }
  // corta silêncio nas pontas (janelas de 20 ms abaixo de -45 dB), deixando 0,3 s de folga
  const win = Math.round(sr * 0.02);
  const rms = (i: number) => {
    let s = 0;
    for (let j = i; j < Math.min(y.length, i + win); j++) s += y[j] * y[j];
    return Math.sqrt(s / win);
  };
  let peak = 0;
  for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak < 1e-4) return y;
  const thr = Math.max(0.0056 * peak, 0.003);
  let start = 0;
  while (start < y.length - win && rms(start) < thr) start += win;
  let end = y.length;
  while (end > start + win && rms(end - win) < thr) end -= win;
  const pad = Math.round(sr * 0.3);
  const cut = y.subarray(Math.max(0, start - pad), Math.min(y.length, end + pad));
  // volume: pico em -1 dB
  const g = 0.89 / peak;
  const out = new Float32Array(cut.length);
  for (let i = 0; i < cut.length; i++) out[i] = cut[i] * g;
  return out;
}

export async function transcribeOffline(input: Blob | Float32Array, lang: Lang, opts: { translate?: boolean; onStatus?: (s: 'loading' | 'working' | number) => void } = {}): Promise<string> {
  const audio = cleanAudio(input instanceof Float32Array ? input : await toPcm16k(input));
  if (audio.length < 1600) throw new Error('áudio vazio');
  const w = getWorker();
  if (isPhone && !ready) ls.set(GUARD, model);
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
    w.postMessage({ audio: copy, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: opts.translate ? 'translate' : 'transcribe', base: base(), model, remote: model === PRECISE }, [copy.buffer]);
  });
}

/**
 * Baixa o modelo preciso (Whisper small, ~250 MB) uma única vez. Depois funciona offline.
 * onProgress recebe 0–100.
 */
export async function downloadPrecise(lang: Lang, onProgress: (p: number) => void): Promise<void> {
  const w = new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' });
  await new Promise<void>((resolve, reject) => {
    w.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress(e.data.p);
      else if (e.data.type === 'ready') resolve();
      else if (e.data.type === 'error') reject(new Error(e.data.s));
    };
    w.onerror = (e) => reject(new Error(e.message || 'whisper'));
    w.postMessage({ warm: true, lang: { pt: 'portuguese', en: 'english', es: 'spanish' }[lang], task: 'transcribe', base: base(), model: PRECISE, remote: true });
  }).finally(() => w.terminate());
  ls.set(PRECISE_KEY, 'ready');
  // a próxima transcrição já usa o preciso
  worker?.terminate();
  worker = null;
  ready = false;
  warming = null;
  available = null;
  model = PRECISE;
}
export function removePrecise() {
  ls.set(PRECISE_KEY, null);
  worker?.terminate();
  worker = null;
  ready = false;
  warming = null;
  available = null;
  model = BUILTIN[0];
  void caches?.delete?.('transformers-cache');
}
