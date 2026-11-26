/** Roda o código de um bloco e devolve as linhas do terminal. */
import { transform } from 'sucrase';
import type { CodeLang } from './langs';
import { langMeta } from './langs';
import { isDesktop } from '../lib/platform';

export interface OutLine {
  t: 'out' | 'err' | 'warn' | 'ret' | 'info';
  s: string;
}
export interface RunResult {
  lines: OutLine[];
  ok: boolean;
  ms: number;
  /** HTML do preview (bloco HTML) */
  html?: string;
}

const TIMEOUT = 15_000;
let pyWorker: Worker | null = null;
/** um Python por vez (o interpretador é compartilhado entre os blocos) */
let pyQueue: Promise<unknown> = Promise.resolve();

const runtimeUrl = (p: string) => new URL(p, location.href).href;

function viaWorker(make: () => Worker, keep: boolean, data: Record<string, unknown>, onLine: (l: OutLine) => void, onLoading?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    const w = keep ? (pyWorker ??= make()) : make();
    const timer = setTimeout(() => {
      onLine({ t: 'err', s: `⏱ Tempo esgotado (${TIMEOUT / 1000}s): a execução foi interrompida.` });
      w.terminate();
      if (keep) pyWorker = null;
      resolve(false);
    }, TIMEOUT + (keep && !pyWorker ? 30_000 : 0));
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'line') onLine({ t: m.t, s: m.s });
      else if (m.type === 'loading') onLoading?.();
      else if (m.type === 'done') {
        clearTimeout(timer);
        if (!keep) w.terminate();
        resolve(m.ok);
      }
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      onLine({ t: 'err', s: e.message || 'erro' });
      w.terminate();
      if (keep) pyWorker = null;
      resolve(false);
    };
    w.postMessage(data);
  });
}

/** interrompe o Python (recarrega na próxima execução) */
export function stopPython() {
  pyWorker?.terminate();
  pyWorker = null;
}

function table(columns: string[], values: unknown[][]): string {
  const cells = [columns, ...values.map((r) => r.map((v) => (v === null ? 'NULL' : String(v))))];
  const w = columns.map((_, i) => Math.min(40, Math.max(...cells.map((r) => (r[i] as string).length))));
  const line = '+' + w.map((n) => '-'.repeat(n + 2)).join('+') + '+';
  const row = (r: string[]) => '| ' + r.map((c, i) => c.slice(0, 40).padEnd(w[i])).join(' | ') + ' |';
  return [line, row(cells[0] as string[]), line, ...cells.slice(1).map((r) => row(r as string[])), line].join('\n');
}

export async function runCode(lang: CodeLang, code: string, stdin: string, onLine: (l: OutLine) => void, onLoading?: () => void): Promise<RunResult> {
  const t0 = performance.now();
  const lines: OutLine[] = [];
  const push = (l: OutLine) => {
    lines.push(l);
    onLine(l);
  };
  let ok = true;
  let html: string | undefined;
  const meta = langMeta(lang);
  try {
    if (meta.runtime === 'js') {
      let js = code;
      if (lang === 'typescript') js = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
      ok = await viaWorker(() => new Worker(new URL('./jsWorker.ts', import.meta.url), { type: 'module' }), false, { code: js, stdin }, push);
    } else if (meta.runtime === 'python') {
      const job = pyQueue.then(() => viaWorker(() => new Worker(new URL('./pyWorker.ts', import.meta.url), { type: 'module' }), true, { code, stdin, base: runtimeUrl('runtimes/pyodide/') }, push, onLoading));
      pyQueue = job.catch(() => undefined);
      ok = await job;
    } else if (meta.runtime === 'sql') {
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({ locateFile: () => runtimeUrl('runtimes/sql-wasm.wasm') });
      const db = new SQL.Database();
      try {
        const res = db.exec(code);
        if (!res.length) push({ t: 'info', s: `OK · ${db.getRowsModified()} linha(s) alterada(s)` });
        for (const r of res) push({ t: 'out', s: table(r.columns, r.values) + `\n(${r.values.length} linha${r.values.length === 1 ? '' : 's'})` });
      } finally {
        db.close();
      }
    } else if (meta.runtime === 'json') {
      try {
        push({ t: 'out', s: JSON.stringify(JSON.parse(code), null, 2) });
        push({ t: 'info', s: '✓ JSON válido' });
      } catch (e) {
        ok = false;
        push({ t: 'err', s: String((e as Error).message) });
      }
    } else if (meta.runtime === 'html') {
      html = code;
    } else {
      if (!isDesktop) {
        ok = false;
        push({ t: 'err', s: `${meta.name} precisa do compilador instalado no computador. No celular rodam Python, JavaScript, TypeScript, SQL, HTML e JSON.` });
      } else {
        const { invoke } = await import('@tauri-apps/api/core');
        const r = await invoke<{ stdout: string; stderr: string; code: number | null; missing?: string; timeout: boolean }>('code_run', { lang, code, stdin });
        if (r.missing) {
          ok = false;
          push({ t: 'err', s: `Não encontrei "${r.missing}" neste computador. Instale ${meta.name} para rodar aqui.` });
        } else {
          if (r.stdout) push({ t: 'out', s: r.stdout.replace(/\n$/, '') });
          if (r.stderr) push({ t: 'err', s: r.stderr.replace(/\n$/, '') });
          if (r.timeout) push({ t: 'err', s: '⏱ Tempo esgotado: a execução foi interrompida.' });
          ok = r.code === 0 && !r.timeout;
          if (r.code !== 0 && r.code !== null) push({ t: 'info', s: `código de saída ${r.code}` });
        }
      }
    }
  } catch (e) {
    ok = false;
    push({ t: 'err', s: String((e as Error)?.message ?? e) });
  }
  return { lines, ok, ms: Math.round(performance.now() - t0), html };
}
