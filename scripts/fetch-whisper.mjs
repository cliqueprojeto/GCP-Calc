// Baixa (uma vez, na hora de compilar) o modelo Whisper "base" multilíngue quantizado e o
// coloca em public/runtimes/whisper, para a transcrição funcionar offline dentro do app.
// Modelo: onnx-community/whisper-base (OpenAI Whisper, licença MIT). Se falhar, o build
// continua e o app usa a transcrição pela IA configurada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = 'onnx-community/whisper-base';
const DIR = path.join(ROOT, 'public/runtimes/whisper', REPO);
const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'normalizer.json',
  'special_tokens_map.json',
  'added_tokens.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];
let ok = true;
for (const f of FILES) {
  const dest = path.join(DIR, f);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let done = false;
  for (let attempt = 1; attempt <= 4 && !done; attempt++) {
    try {
      const res = await fetch(`https://huggingface.co/${REPO}/resolve/main/${f}`);
      if (res.status === 404 && !f.startsWith('onnx/')) {
        done = true; // arquivo opcional
        break;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log('✓', f, (fs.statSync(dest).size / 1e6).toFixed(1), 'MB');
      done = true;
    } catch (e) {
      console.warn(`tentativa ${attempt} falhou para ${f}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  if (!done) ok = false;
}
console.log(ok ? 'modelo Whisper pronto em public/runtimes/whisper' : '⚠ modelo Whisper incompleto: a transcrição offline ficará indisponível neste build');
