/// <reference lib="webworker" />
/** Executa JavaScript isolado (sem acesso à nota nem ao app), capturando o console. */
const fmt = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.stack || v.message;
  if (typeof v === 'function') return `[Function ${v.name || 'anônima'}]`;
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x instanceof Map ? Object.fromEntries(x) : x instanceof Set ? [...x] : x), 2) ?? String(v);
  } catch {
    return String(v);
  }
};
const post = (t: string, args: unknown[]) => postMessage({ type: 'line', t, s: args.map(fmt).join(' ') });
self.onmessage = async (e: MessageEvent<{ code: string; stdin: string }>) => {
  const lines = e.data.stdin ? e.data.stdin.split('\n') : [];
  let li = 0;
  const input = (q?: string) => {
    if (q) post('out', [q]);
    return lines[li++] ?? null;
  };
  const con = {
    log: (...a: unknown[]) => post('out', a),
    info: (...a: unknown[]) => post('out', a),
    debug: (...a: unknown[]) => post('out', a),
    warn: (...a: unknown[]) => post('warn', a),
    error: (...a: unknown[]) => post('err', a),
    table: (d: unknown) => post('out', [d]),
    clear: () => postMessage({ type: 'clear' }),
  };
  try {
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...x: unknown[]) => Promise<unknown>;
    const fn = new AsyncFn('console', 'prompt', 'input', 'readline', `"use strict";\n${e.data.code}`);
    const r = await fn(con, input, input, input);
    if (r !== undefined) post('ret', [r]);
    postMessage({ type: 'done', ok: true });
  } catch (err) {
    post('err', [err]);
    postMessage({ type: 'done', ok: false });
  }
};
