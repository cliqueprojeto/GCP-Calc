/// <reference lib="webworker" />
/**
 * Transcrição offline com Whisper (OpenAI, MIT) via transformers.js + ONNX Runtime em
 * WebAssembly. O modelo vem embutido no app (public/runtimes/whisper): nada é baixado.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

self.onmessage = async (e: MessageEvent<{ audio?: Float32Array; lang: string; task: 'transcribe' | 'translate'; base: string; warm?: boolean }>) => {
  const { audio, lang, task, base, warm } = e.data;
  try {
    if (!asr) {
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      // caminho relativo ao site (não URL completa): é o que a biblioteca trata como "modelo local"
      env.localModelPath = new URL(base).pathname + 'runtimes/whisper/';
      // arquivos opcionais que não existem: alguns servidores devolvem a página do app (HTML)
      // em vez de 404 — trata como "não encontrado"
      const realFetch = env.fetch ?? fetch;
      env.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await realFetch(input as never, init as never);
        const url = String((input as Request).url ?? input);
        if (res.ok && !url.endsWith('.html') && (res.headers.get('content-type') || '').includes('text/html')) return new Response(null, { status: 404 });
        return res;
      }) as typeof env.fetch;
      const wasm = env.backends.onnx.wasm!;
      wasm.wasmPaths = base + 'runtimes/ort/';
      wasm.numThreads = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      postMessage({ type: 'status', s: 'loading' });
      asr = pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
        device: 'wasm',
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === 'progress' && p.progress !== undefined) postMessage({ type: 'progress', p: Math.round(p.progress) });
        },
      }) as Promise<AutomaticSpeechRecognitionPipeline>;
    }
    const run = await asr;
    if (warm || !audio) {
      postMessage({ type: 'ready' });
      return;
    }
    postMessage({ type: 'status', s: 'working' });
    const out = (await run(audio, { language: lang, task, chunk_length_s: 30, stride_length_s: 5 } as never)) as { text: string } | { text: string }[];
    const text = (Array.isArray(out) ? out.map((x) => x.text).join(' ') : out.text).trim();
    postMessage({ type: 'done', text });
  } catch (err) {
    asr = null;
    postMessage({ type: 'error', s: String((err as Error)?.message ?? err) });
  }
};
