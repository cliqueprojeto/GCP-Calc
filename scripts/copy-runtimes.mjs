// Copia os motores offline (Python/Pyodide, SQLite/sql.js e o modelo de transcrição, se baixado)
// de node_modules para public/runtimes, para irem embutidos no app — nada é baixado em uso.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const out = path.join(ROOT, 'public/runtimes');
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const py = path.join(ROOT, 'node_modules/pyodide');
for (const f of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) copy(path.join(py, f), path.join(out, 'pyodide', f));
copy(path.join(ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm'), path.join(out, 'sql-wasm.wasm'));
// ONNX Runtime (WebAssembly, CPU) para o Whisper offline
const ort = path.join(ROOT, 'node_modules/onnxruntime-web/dist');
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) copy(path.join(ort, f), path.join(out, 'ort', f));
console.log('runtimes copiados para public/runtimes');
