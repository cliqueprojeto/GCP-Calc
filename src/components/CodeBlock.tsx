/**
 * Bloco de código estilo playground: editor com cores (Prism), números de linha,
 * indentação automática e fechamento de parênteses/aspas; ▶ Rodar (Ctrl+Enter),
 * entrada (stdin) e terminal com a saída. Python, JS/TS, SQL, HTML e JSON rodam
 * embutidos (inclusive no celular); C, C++, Go, Rust, Java, Ruby, PHP e shell usam o
 * compilador instalado no computador.
 */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpen, Bug, Check, ChevronDown, Copy, Eraser, GraduationCap, Keyboard, Loader2, Play, Square, Target, TerminalSquare, Wand2, X } from 'lucide-react';
import { explainCode, fixCode, makeChallenge, reviewSolution, sameOutput } from '../code/tutor';
import { MiniMarkdown } from '../code/md';
import { isTransient, orderedProviders } from '../ai/assist';
import { useData } from '../store/data';
import { uid } from '../lib/platform';
import type { Block } from '../lib/types';
import { LANGS, langMeta, type CodeLang } from '../code/langs';
import { highlight } from '../code/highlight';
import { runCode, stopPython, type OutLine } from '../code/run';
import { copyText, isDesktop } from '../lib/platform';
import { toast } from '../store/ui';
import { useLang, useT } from '../i18n';

type CodeB = Extract<Block, { type: 'code' }>;
const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

export function CodeBlock({ block, onChange, onInsertAfter }: { block: CodeB; onChange(p: Partial<CodeB>): void; onInsertAfter?(blocks: Block[]): void }) {
  const t = useT();
  const lang = useLang();
  const [tutor, setTutor] = useState<{ kind: 'explain' | 'fix' | 'challenge' | 'check'; text: string; ok?: boolean; fixed?: string } | null>(null);
  const [tutorBusy, setTutorBusy] = useState<string | null>(null);
  const providers = () => {
    const st = useData.getState();
    return orderedProviders(st.settings.ai.providers, st.settings.ai.active);
  };
  const askTutor = async (kind: 'explain' | 'fix' | 'challenge' | 'check') => {
    const ps = providers();
    if (!ps.length) {
      toast(t('tutor.needAi'), 'error');
      return;
    }
    setTutorBusy(kind);
    const outText = (block.output ?? []).map((l) => l.s).join('\n');
    try {
      if (kind === 'explain') setTutor({ kind, text: await explainCode(ps, lang, block.lang, block.code, outText) });
      else if (kind === 'fix') {
        const r = await fixCode(ps, lang, block.lang, block.code, outText || '(sem saída)');
        setTutor({ kind, text: r.explanation, fixed: r.code && r.code.trim() !== block.code.trim() ? r.code : undefined });
      } else if (kind === 'challenge') {
        const c = await makeChallenge(ps, lang, block.lang, `${block.title ?? ''}\n${block.code}`);
        onInsertAfter?.([
          { id: uid(), type: 'callout', text: `🎯 ${c.title}\n${c.statement}${c.hint ? `\n💡 ${c.hint}` : ''}`, color: '#f59e0b', icon: 'Target' },
          { id: uid(), type: 'code', lang: block.lang, code: c.starter, title: c.title, challenge: { title: c.title, statement: c.statement, expected: c.expected, hint: c.hint } },
        ]);
        toast(t('tutor.challengeAdded'), 'ok');
      } else if (kind === 'check' && block.challenge) {
        // roda a solução e compara com a saída esperada; a IA dá o retorno
        const r = await runCode(block.lang as CodeLang, block.code, block.stdin ?? '', () => undefined);
        onChange({ output: r.lines.slice(-500), ok: r.ok, ms: r.ms });
        const out = r.lines.map((l) => l.s).join('\n');
        const exact = block.challenge.expected ? sameOutput(out, block.challenge.expected) : undefined;
        const rv = await reviewSolution(ps, lang, block.lang, block.challenge.statement + (block.challenge.expected ? `\nSaída esperada:\n${block.challenge.expected}` : ''), block.code, out);
        const ok = exact ?? rv.ok;
        setTutor({ kind, ok, text: rv.feedback });
        if (ok) onChange({ challenge: { ...block.challenge, solved: true } });
      }
    } catch (e) {
      toast(isTransient(e) ? t('assist.busy') : `${t('assist.error')}: ${String((e as Error)?.message || e).slice(0, 140)}`, 'error');
    } finally {
      setTutorBusy(null);
    }
  };
  const meta = langMeta(block.lang);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const caret = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<OutLine[] | null>(null);
  const [showIn, setShowIn] = useState(!!block.stdin);
  const [html, setHtml] = useState<string | null>(null);
  const [htmlLog, setHtmlLog] = useState<OutLine[]>([]);
  const lines = block.code.split('\n');
  const colored = useMemo(() => highlight(block.code + (block.code.endsWith('\n') ? ' ' : ''), meta.prism), [block.code, meta.prism]);

  useLayoutEffect(() => {
    if (caret.current !== null && taRef.current) {
      taRef.current.selectionStart = taRef.current.selectionEnd = caret.current;
      caret.current = null;
    }
  });

  const set = (code: string, pos?: number) => {
    if (pos !== undefined) caret.current = pos;
    onChange({ code });
  };

  const run = async () => {
    if (running) return;
    if (meta.runtime === 'html') {
      setHtmlLog([]);
      setHtml(block.code + '\n<!-- ' + Date.now() + ' -->');
      return;
    }
    setRunning(true);
    setLive([]);
    const acc: OutLine[] = [];
    const r = await runCode(block.lang as CodeLang, block.code, block.stdin ?? '', (l) => {
      acc.push(l);
      setLive([...acc]);
    }, () => setLoading(true));
    setLoading(false);
    setRunning(false);
    setLive(null);
    onChange({ output: r.lines.slice(-500), ok: r.ok, ms: r.ms });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const { selectionStart: s, selectionEnd: en, value: v } = ta;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void run();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '/' && meta.comment) {
      // comenta/descomenta as linhas selecionadas
      e.preventDefault();
      const a = v.lastIndexOf('\n', s - 1) + 1;
      let b = v.indexOf('\n', en);
      if (b < 0) b = v.length;
      const block_ = v.slice(a, b).split('\n');
      const c = meta.comment + ' ';
      const all = block_.every((l) => !l.trim() || l.trimStart().startsWith(meta.comment));
      const nb = block_.map((l) => (!l.trim() ? l : all ? l.replace(new RegExp('^(\\s*)' + meta.comment.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + ' ?'), '$1') : l.replace(/^(\s*)/, '$1' + c))).join('\n');
      set(v.slice(0, a) + nb + v.slice(b), a + nb.length);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const a = v.lastIndexOf('\n', s - 1) + 1;
      if (e.shiftKey) {
        const ind = v.slice(a).match(/^( {1,4}|\t)/)?.[0] ?? '';
        if (ind) set(v.slice(0, a) + v.slice(a + ind.length), Math.max(a, s - ind.length));
      } else set(v.slice(0, s) + meta.indent + v.slice(en), s + meta.indent.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // mantém a indentação; aumenta depois de ":" "{" "[" "(" (e fecha o par)
      e.preventDefault();
      const a = v.lastIndexOf('\n', s - 1) + 1;
      const cur = v.slice(a, s);
      const ind = cur.match(/^\s*/)![0];
      const opens = /[:{[(]\s*$/.test(cur) || /<[a-zA-Z][^/>]*>\s*$/.test(cur);
      const next = v[s];
      if (opens && next && ')]}'.includes(next) && PAIRS[cur.trimEnd().slice(-1)] === next) {
        const ins = '\n' + ind + meta.indent + '\n' + ind;
        set(v.slice(0, s) + ins + v.slice(en), s + 1 + ind.length + meta.indent.length);
      } else {
        const ins = '\n' + ind + (opens ? meta.indent : '');
        set(v.slice(0, s) + ins + v.slice(en), s + ins.length);
      }
      return;
    }
    if (PAIRS[e.key] && s === en) {
      // fecha parênteses/aspas (e pula o fechamento se já existir)
      const close = PAIRS[e.key];
      if ((e.key === '"' || e.key === "'" || e.key === '`') && v[s] === e.key) {
        e.preventDefault();
        ta.selectionStart = ta.selectionEnd = s + 1;
        return;
      }
      if (/[\w\p{L}]/u.test(v[s - 1] ?? '') && e.key === "'") return;
      e.preventDefault();
      set(v.slice(0, s) + e.key + close + v.slice(en), s + 1);
      return;
    }
    if (')]}'.includes(e.key) && v[s] === e.key && s === en) {
      e.preventDefault();
      ta.selectionStart = ta.selectionEnd = s + 1;
      return;
    }
    if (e.key === 'Backspace' && s === en && PAIRS[v[s - 1]] && v[s] === PAIRS[v[s - 1]]) {
      e.preventDefault();
      set(v.slice(0, s - 1) + v.slice(s + 1), s - 1);
    }
  };

  const out = live ?? (block.output as OutLine[] | undefined) ?? [];
  const nativeOnly = meta.runtime === 'native';

  return (
    <div className={`codeblk lang-${meta.id}`}>
      <div className="code-head">
        <div className="code-lang">
          <select value={meta.id} onChange={(e) => onChange({ lang: e.target.value, output: undefined })} aria-label={t('code.lang')}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.runtime === 'native' ? (isDesktop ? ' · ' + t('code.installed') : ' · ' + t('code.desktopOnly')) : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
        <input className="code-title" value={block.title ?? ''} placeholder={t('code.titlePh')} onChange={(e) => onChange({ title: e.target.value })} />
        {!block.code.trim() && (
          <button className="btn small" onClick={() => set(meta.hello)} title={t('code.example')}>
            <Wand2 size={13} /> <span className="hide-sm">{t('code.example')}</span>
          </button>
        )}
        <button className={`icon-btn ${showIn ? 'on' : ''}`} onClick={() => setShowIn(!showIn)} title={t('code.stdin')}>
          <Keyboard size={15} />
        </button>
        <button className="icon-btn" onClick={() => (copyText(block.code), toast(t('code.copied'), 'ok'))} title={t('code.copy')}>
          <Copy size={15} />
        </button>
        {running && meta.runtime === 'python' ? (
          <button className="btn small run stop" onClick={() => (stopPython(), setRunning(false), setLive(null))}>
            <Square size={12} /> {t('code.stop')}
          </button>
        ) : (
          <button className="btn small run" onClick={run} disabled={running} title="Ctrl+Enter">
            {running ? <Loader2 size={13} className="spin" /> : <Play size={13} />} {t('code.run')}
          </button>
        )}
      </div>
      <div className="code-editor">
        <div className="code-ln" aria-hidden>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="code-area">
          <pre ref={preRef} className={`code-pre language-${meta.prism}`} aria-hidden dangerouslySetInnerHTML={{ __html: colored }} />
          <textarea
            ref={taRef}
            className="code-input"
            value={block.code}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
            placeholder={t('code.placeholder', { lang: meta.name })}
            onChange={(e) => onChange({ code: e.target.value })}
            onKeyDown={onKey}
            onScroll={(e) => {
              if (preRef.current) {
                preRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
          />
        </div>
      </div>
      {showIn && (
        <div className="code-stdin">
          <label>{t('code.stdin')}</label>
          <textarea rows={2} value={block.stdin ?? ''} placeholder={t('code.stdinPh')} onChange={(e) => onChange({ stdin: e.target.value })} />
        </div>
      )}
      {meta.runtime === 'html' && html !== null && (
        <div className="code-preview">
          <iframe
            title="preview"
            sandbox="allow-scripts allow-modals"
            srcDoc={`<script>(function(){const p=(t,a)=>parent.postMessage({gcpConsole:1,t,s:a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')},'*');['log','info','warn','error'].forEach(k=>{const o=console[k];console[k]=(...a)=>{p(k==='error'?'err':k==='warn'?'warn':'out',a);o.apply(console,a)}});addEventListener('error',e=>p('err',[e.message]));})()</script>${html}`}
            ref={(f) => {
              if (!f) return;
              const h = (e: MessageEvent) => e.source === f.contentWindow && e.data?.gcpConsole && setHtmlLog((l) => [...l, { t: e.data.t, s: e.data.s }].slice(-200));
              window.addEventListener('message', h);
              (f as unknown as { _off?: () => void })._off?.();
              (f as unknown as { _off?: () => void })._off = () => window.removeEventListener('message', h);
            }}
          />
        </div>
      )}
      {(out.length > 0 || running || (meta.runtime === 'html' && htmlLog.length > 0)) && (
        <div className={`code-term ${block.ok === false && !running ? 'fail' : ''}`}>
          <div className="term-head">
            <TerminalSquare size={13} /> {t('code.terminal')}
            <span className="term-status">
              {running ? (loading ? t('code.loadingPy') : t('code.running')) : block.ms !== undefined && meta.runtime !== 'html' ? (block.ok ? <><Check size={12} /> {block.ms} ms</> : t('code.failed')) : ''}
            </span>
            <button className="icon-btn" onClick={() => (onChange({ output: undefined, ok: undefined, ms: undefined }), setHtmlLog([]))} title={t('code.clear')}>
              <Eraser size={13} />
            </button>
          </div>
          <pre className="term-body">
            {(meta.runtime === 'html' ? htmlLog : out).map((l, i) => (
              <span key={i} className={`t-${l.t}`}>
                {l.t === 'ret' ? '← ' : ''}
                {l.s}
                {'\n'}
              </span>
            ))}
            {running && <span className="t-cursor">▍</span>}
          </pre>
        </div>
      )}
      {nativeOnly && !isDesktop && <p className="code-note">{t('code.desktopOnlyHint')}</p>}
      <div className="tutor-bar">
        <span className="tutor-label">
          <GraduationCap size={14} /> {t('tutor.title')}
        </span>
        <button className="btn small" disabled={!!tutorBusy || !block.code.trim()} onClick={() => askTutor('explain')}>
          {tutorBusy === 'explain' ? <Loader2 size={13} className="spin" /> : <BookOpen size={13} />} {t('tutor.explain')}
        </button>
        {block.ok === false && (
          <button className="btn small" disabled={!!tutorBusy} onClick={() => askTutor('fix')}>
            {tutorBusy === 'fix' ? <Loader2 size={13} className="spin" /> : <Bug size={13} />} {t('tutor.fix')}
          </button>
        )}
        {block.challenge ? (
          <button className={`btn small ${block.challenge.solved ? 'solved' : ''}`} disabled={!!tutorBusy} onClick={() => askTutor('check')}>
            {tutorBusy === 'check' ? <Loader2 size={13} className="spin" /> : <Check size={13} />} {block.challenge.solved ? t('tutor.solved') : t('tutor.check')}
          </button>
        ) : null}
        <button className="btn small" disabled={!!tutorBusy} onClick={() => askTutor('challenge')}>
          {tutorBusy === 'challenge' ? <Loader2 size={13} className="spin" /> : <Target size={13} />} {t('tutor.challenge')}
        </button>
      </div>
      {tutor && (
        <div className={`tutor-panel k-${tutor.kind} ${tutor.ok === true ? 'pass' : tutor.ok === false ? 'fail' : ''}`}>
          <div className="tutor-head">
            {tutor.kind === 'check' ? (tutor.ok ? t('tutor.passed') : t('tutor.notYet')) : tutor.kind === 'fix' ? t('tutor.fixTitle') : t('tutor.explainTitle')}
            <button className="icon-btn" onClick={() => setTutor(null)} aria-label="fechar">
              <X size={14} />
            </button>
          </div>
          <MiniMarkdown text={tutor.text} />
          {tutor.fixed && (
            <button className="btn small primary" onClick={() => (onChange({ code: tutor.fixed!, output: undefined }), setTutor(null), toast(t('tutor.applied'), 'ok'))}>
              <Check size={13} /> {t('tutor.applyFix')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
