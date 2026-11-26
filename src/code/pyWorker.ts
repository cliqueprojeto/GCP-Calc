/// <reference lib="webworker" />
/** Python de verdade (CPython em WebAssembly via Pyodide), embutido no app e offline. */
import { loadPyodide, type PyodideInterface } from 'pyodide';

let py: PyodideInterface | null = null;
self.onmessage = async (e: MessageEvent<{ code: string; stdin: string; base: string }>) => {
  const post = (t: string, s: string) => postMessage({ type: 'line', t, s });
  try {
    if (!py) {
      postMessage({ type: 'loading' });
      py = await loadPyodide({ indexURL: e.data.base });
    }
    py.setStdout({ batched: (s) => post('out', s) });
    py.setStderr({ batched: (s) => post('err', s) });
    const lines = e.data.stdin ? e.data.stdin.split('\n') : [];
    let i = 0;
    py.setStdin({ stdin: () => (i < lines.length ? lines[i++] : undefined) });
    const ns = py.globals.get('dict')();
    const r = await py.runPythonAsync(e.data.code, { globals: ns });
    if (r !== undefined && r !== null) post('ret', String(r));
    ns.destroy?.();
    postMessage({ type: 'done', ok: true });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    // traceback só do código do usuário: a partir do primeiro trecho em "<exec>"
    const lines = msg.split('\n');
    const at = lines.findIndex((l) => l.includes('File "<exec>"'));
    const mine = at >= 0 ? ['Traceback (most recent call last):', ...lines.slice(at)] : lines.slice(-3);
    post('err', mine.join('\n').replace(/File "<exec>", line (\d+)/g, 'linha $1').trim());
    postMessage({ type: 'done', ok: false });
  }
};
