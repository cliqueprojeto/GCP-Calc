/**
 * Editor de cálculo: um textarea transparente sobre o texto colorido (estilo editor
 * de código) e, à direita, a coluna de resultados alinhada linha a linha.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { canonicalLine, isMoneyLine, regroupAtCaret } from '../lib/autoformat';
import { Bell, BellRing, Copy, Paperclip, RefreshCw } from 'lucide-react';
import { AI_COMMAND, FUNCS, type LineResult } from '../engine/evaluate';
import { fold } from '../engine/units';
import { searchEmoji } from '../lib/emojiIndex';
import { formatValue, plainNumber, type FormatOptions, type Value } from '../engine/value';
import { copyText } from '../lib/platform';
import { useRates } from '../lib/rates';
import { useData } from '../store/data';
import { toast, useUi } from '../store/ui';
import { useT } from '../i18n';

/** Último editor focado: o teclado numérico e o assistente inserem texto nele. */
let lastInput: HTMLTextAreaElement | null = null;
let lastChange: ((text: string) => void) | null = null;

export function insertAtCaret(text: string) {
  const ta = lastInput;
  if (!ta || !lastChange) return false;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const next = ta.value.slice(0, start) + text + ta.value.slice(end);
  lastChange(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
  });
  return true;
}

export function keypadAction(action: 'back' | 'enter' | 'left' | 'right') {
  const ta = lastInput;
  if (!ta || !lastChange) return;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  if (action === 'enter') return insertAtCaret('\n');
  if (action === 'left' || action === 'right') {
    const p = Math.max(0, Math.min(ta.value.length, s + (action === 'left' ? -1 : 1)));
    ta.focus();
    ta.selectionStart = ta.selectionEnd = p;
    return;
  }
  const from = s === e ? Math.max(0, s - 1) : s;
  lastChange(ta.value.slice(0, from) + ta.value.slice(e));
  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = from;
  });
}

export interface CalcEditorProps {
  blockId: string;
  text: string;
  results: LineResult[];
  fmt: FormatOptions;
  firstLine: number;
  onChange(text: string): void;
  autoFocus?: boolean;
  /** "/ia pergunta" + Enter */
  onAiCommand?(lineIndex: number, question: string): void;
  /** linha com vencimento ("vence 10/12"): cria o lembrete */
  onReminder?(lineIndex: number): void;
  /** linhas que já têm lembrete */
  hasReminder?(lineIndex: number): boolean;
  /** comprovantes por linha */
  attachCount?(lineIndex: number): number;
  onAttach?(lineIndex: number): void;
  onShowAttach?(lineIndex: number): void;
  /** nomes conhecidos na nota (variáveis e seções) para o autocompletar */
  known?: Suggestion[];
}

export interface Suggestion {
  kind: 'var' | 'section' | 'func' | 'kw' | 'emoji' | 'cmd';
  /** texto inserido */
  insert: string;
  value?: Value;
  tone?: 'income' | 'expense';
  detail?: string;
}

interface AcState {
  items: Suggestion[];
  sel: number;
  start: number;
  end: number;
  top: number;
  left: number;
  /** menu "/" (grade de emojis) */
  grid?: boolean;
}

const KEYWORDS = ['total', 'média', 'subtotal', 'anterior', 'em', 'de', 'hoje', 'average', 'previous', 'today', 'promedio', 'hoy'];
const FUNC_NAMES = [...FUNCS].filter((f) => f.length > 2);

/** Palavra (ou #seção) que termina no cursor. */
function wordAt(text: string, caret: number): { start: number; word: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/#?[\p{L}_][\p{L}\p{N}_]*$/u) ?? before.match(/#$/);
  if (!m) return null;
  // não sugere no meio de uma palavra
  if (/[\p{L}\p{N}_]/u.test(text[caret] ?? '')) return null;
  return { start: caret - m[0].length, word: m[0] };
}

function measure(ta: HTMLTextAreaElement, s: string): number {
  const c = (measure as unknown as { c?: CanvasRenderingContext2D }).c ?? document.createElement('canvas').getContext('2d')!;
  (measure as unknown as { c?: CanvasRenderingContext2D }).c = c;
  const cs = getComputedStyle(ta);
  c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return c.measureText(s).width;
}

export function CalcEditor({ blockId, text, results, fmt, firstLine, onChange, autoFocus, onAiCommand, onReminder, hasReminder, attachCount, onAttach, onShowAttach, known = [] }: CalcEditorProps) {
  const t = useT();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const srcRef = useRef<HTMLDivElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const lineNumbers = useData((s) => s.settings.lineNumbers);
  const autoFormat = useData((s) => s.settings.autoFormat !== false);
  const autocomplete = useData((s) => s.settings.autocomplete !== false);
  const [ac, setAc] = useState<AcState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // posição do cursor aplicada logo após o React gravar o novo texto (antes da próxima tecla)
  const pendingCaret = useRef<number | null>(null);
  const setCaret = (pos: number) => {
    pendingCaret.current = pos;
  };
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (ta && pendingCaret.current !== null) {
      ta.selectionStart = ta.selectionEnd = pendingCaret.current;
      pendingCaret.current = null;
    }
  });

  /** abre/atualiza as sugestões para a palavra no cursor */
  const suggest = (value: string, caret: number) => {
    const ta = taRef.current;
    // "/" no começo da linha ou depois de espaço: emojis, símbolos e o comando /ia
    const slash = ta ? value.slice(0, caret).match(/(^|[\s])\/([\p{L}]*)$/u) : null;
    // depois de número ou ")" o "/" é divisão
    const beforeSlash = slash ? value.slice(value.lastIndexOf('\n', caret - 1) + 1, caret - slash[2].length - 1).trimEnd() : '';
    if (slash && ta && !/[\p{L}\p{N}_]/u.test(value[caret] ?? '') && !/[\d)%]$/.test(beforeSlash)) {
      const q = slash[2];
      const start = caret - q.length - 1;
      const items: Suggestion[] = [];
      if ('ia'.startsWith(q.toLowerCase()) || 'ai'.startsWith(q.toLowerCase())) items.push({ kind: 'cmd', insert: '/ia ' });
      for (const e of searchEmoji(q, 30)) items.push({ kind: 'emoji', insert: e.e, detail: e.k.split(' ').slice(0, 2).join(' ') });
      if (!items.length) return setAc(null);
      const lineIdx = value.slice(0, caret).split('\n').length - 1;
      const row = srcRef.current?.children[lineIdx] as HTMLElement | undefined;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const wrapW = wrapRef.current?.clientWidth ?? 300;
      const left = Math.max(0, Math.min(wrapW - 270, ta.offsetLeft + measure(ta, value.slice(lineStart, start))));
      setAc({ items, sel: 0, start, end: caret, top: (row?.offsetTop ?? 0) + (row?.offsetHeight ?? 24), left, grid: true });
      return;
    }
    const w = autocomplete && ta ? wordAt(value, caret) : null;
    if (!w || !ta || (!w.word.startsWith('#') && w.word.length < 2)) return setAc(null);
    const isTag = w.word.startsWith('#');
    const q = fold(w.word.replace(/^#/, ''));
    const pool: Suggestion[] = isTag
      ? known.filter((k) => k.kind === 'section')
      : [...known, ...FUNC_NAMES.map((f): Suggestion => ({ kind: 'func', insert: f })), ...KEYWORDS.map((k): Suggestion => ({ kind: 'kw', insert: k }))];
    const seen = new Set<string>();
    const items = pool
      .filter((k) => {
        const name = fold(k.insert.replace(/^#/, ''));
        if (seen.has(k.insert) || !name.startsWith(q) || name === q) return false;
        seen.add(k.insert);
        return true;
      })
      .slice(0, 8);
    if (!items.length) return setAc(null);
    const lineIdx = value.slice(0, caret).split('\n').length - 1;
    const row = srcRef.current?.children[lineIdx] as HTMLElement | undefined;
    const lineStart = value.lastIndexOf('\n', w.start - 1) + 1;
    const wrapW = wrapRef.current?.clientWidth ?? 300;
    const left = Math.max(0, Math.min(wrapW - 230, ta.offsetLeft + measure(ta, value.slice(lineStart, w.start))));
    setAc({ items, sel: 0, start: w.start, end: caret, top: (row?.offsetTop ?? 0) + (row?.offsetHeight ?? 24), left });
  };

  const accept = (item: Suggestion) => {
    if (!ac) return;
    const ta = taRef.current;
    const value = ta?.value ?? text;
    const ins = item.kind === 'func' ? item.insert + '(' : item.kind === 'emoji' ? item.insert + ' ' : item.insert;
    const next = value.slice(0, ac.start) + ins + value.slice(ac.end);
    setCaret(ac.start + ins.length);
    onChange(next);
    setAc(null);
    ta?.focus();
  };
  const refreshRates = useRates((s) => s.refresh);
  const lines = text.split('\n');

  // alinha a altura de cada resultado (e número de linha) à linha de texto correspondente
  useLayoutEffect(() => {
    const src = srcRef.current;
    if (!src) return;
    const sync = () => {
      const rows = src.children;
      const res = resRef.current?.children;
      const ln = lnRef.current?.children;
      for (let i = 0; i < rows.length; i++) {
        const h = (rows[i] as HTMLElement).offsetHeight + 'px';
        if (res?.[i]) (res[i] as HTMLElement).style.height = h;
        if (ln?.[i]) (ln[i] as HTMLElement).style.height = h;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(src);
    return () => ro.disconnect();
  });

  useLayoutEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  const updateActive = () => {
    const ta = taRef.current;
    if (!ta) return;
    setActiveLine(ta.value.slice(0, ta.selectionStart).split('\n').length - 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (ac) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (ac.grid && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) {
        e.preventDefault();
        const cols = ac.grid ? 8 : 1;
        const d = e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : e.key === 'ArrowRight' ? 1 : -1;
        setAc({ ...ac, sel: (ac.sel + d + ac.items.length) % ac.items.length });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        accept(ac.items[ac.sel]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAc(null);
        return;
      }
    }
    // "/ia pergunta" + Enter: a IA escreve o cálculo no lugar da linha
    if (e.key === 'Enter' && !e.shiftKey && onAiCommand) {
      const idx = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
      const m = ta.value.split('\n')[idx]?.match(AI_COMMAND);
      if (m && m[3]?.trim()) {
        e.preventDefault();
        onAiCommand(idx, m[3].trim());
        return;
      }
    }
    // Enter no fim da linha: o valor vira a forma canônica (R$ 2.000,00) e contas esperadas são preenchidas
    if (e.key === 'Enter' && !e.shiftKey && autoFormat && ta.selectionStart === ta.selectionEnd) {
      const s = ta.selectionStart;
      const idx = ta.value.slice(0, s).split('\n').length - 1;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      let lineEnd = ta.value.indexOf('\n', s);
      if (lineEnd < 0) lineEnd = ta.value.length;
      const line = ta.value.slice(lineStart, lineEnd);
      if (!ta.value.slice(s, lineEnd).trim()) {
        const canon = canonicalLine(line, results[idx], fmt);
        if (canon) {
          e.preventDefault();
          const indent = line.match(/^\s*/)![0];
          const next = ta.value.slice(0, lineStart) + canon + '\n' + indent + ta.value.slice(lineEnd);
          onChange(next);
          setCaret(lineStart + canon.length + 1 + indent.length);
          return;
        }
      }
    }
    // Tab recua/avança a linha como num editor de código
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      if (e.shiftKey) {
        if (ta.value.slice(lineStart, lineStart + 2) === '  ') {
          onChange(ta.value.slice(0, lineStart) + ta.value.slice(lineStart + 2));
          requestAnimationFrame(() => (ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s - 2)));
        }
      } else insertAtCaret('  ');
    }
  };

  const copyResult = (v: Value) => {
    copyText(plainNumber(v, fmt));
    toast(t('editor.copied', { value: formatValue(v, fmt) }), 'ok');
  };

  const errorLabel = (code: string) => {
    const [c, d] = code.split(':');
    if (c === 'norate') return { text: t('err.norate', { code: d ?? '' }), action: true };
    if (c === 'incompatible') return { text: t('err.incompatible'), action: false };
    if (c === 'div0') return { text: t('err.div0'), action: false };
    if (c === 'domain') return { text: t('err.domain'), action: false };
    if (c === 'noprev' || c === 'noline') return { text: t('err.noref'), action: false };
    return null;
  };

  return (
    <div className={`calc ${lineNumbers ? 'with-ln' : ''}`} data-block={blockId}>
      {lineNumbers && (
        <div className="calc-ln" ref={lnRef} aria-hidden>
          {lines.map((_, i) => (
            <div key={i} className={i === activeLine ? 'on' : ''}>
              {firstLine + i}
            </div>
          ))}
        </div>
      )}
      <div className="calc-src-wrap" ref={wrapRef}>
        <div className="calc-src" ref={srcRef} aria-hidden>
          {lines.map((line, i) => {
            const r = results[i];
            return (
              <div key={i} className={`src-line k-${r?.kind ?? 'empty'} ${r?.tone ? 'tone-' + r.tone : ''} ${i === activeLine ? 'active' : ''}`}>
                {r && r.segments.length ? r.segments.map((s, j) => (s.text ? <span key={j} className={`s-${s.cls}`}>{s.text}</span> : null)) : line || '​'}
                {line === '' && '​'}
              </div>
            );
          })}
        </div>
        <textarea
          ref={taRef}
          className="calc-input"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          placeholder={t('editor.placeholder')}
          onChange={(e) => {
            const ta = e.currentTarget;
            let value = ta.value;
            let caret = ta.selectionStart;
            // dinheiro: separadores de milhar entram enquanto digita (conforme idioma/configuração)
            if (autoFormat && ta.selectionStart === ta.selectionEnd && Math.abs(value.length - text.length) === 1) {
              const idx = value.slice(0, caret).split('\n').length - 1;
              const ls = value.lastIndexOf('\n', caret - 1) + 1;
              let le = value.indexOf('\n', caret);
              if (le < 0) le = value.length;
              const prevLine = text.split('\n')[idx];
              if (isMoneyLine(value.slice(ls, le), prevLine !== undefined && value.split('\n').length === text.split('\n').length ? results[idx] : undefined)) {
                const g = regroupAtCaret(value, caret, fmt.decimal);
                if (g) {
                  value = g.text;
                  caret = g.caret;
                  setCaret(caret);
                }
              }
            }
            onChange(value);
            updateActive();
            suggest(value, caret);
          }}
          onKeyDown={onKeyDown}
          onSelect={updateActive}
          onClick={() => setAc(null)}
          onFocus={(e) => {
            lastInput = e.currentTarget;
            lastChange = onChange;
            useUi.getState().set({ focusBlock: blockId });
            updateActive();
          }}
          onBlur={() => {
            setActiveLine(-1);
            setTimeout(() => setAc(null), 150);
          }}
        />
        {ac && (
          <div className={`ac-pop ${ac.grid ? 'slash' : ''}`} style={{ top: ac.top, left: ac.left }} role="listbox">
            {ac.grid && (
              <div className="ac-slash-head">
                {t('slash.title')}
              </div>
            )}
            {ac.grid && ac.items.some((x) => x.kind === 'cmd') && (
              <button className={`ac-item ${ac.items[ac.sel]?.kind === 'cmd' ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => accept(ac.items.find((x) => x.kind === 'cmd')!)}>
                <span className="ac-kind">IA</span>
                <span className="ac-label">/ia</span>
                <span className="ac-detail">{t('slash.ai')}</span>
              </button>
            )}
            {ac.grid && (
              <div className="ac-emoji-grid">
                {ac.items.map((it, i) =>
                  it.kind === 'emoji' ? (
                    <button key={it.insert + i} className={`ac-emoji ${i === ac.sel ? 'on' : ''}`} title={it.detail} onMouseDown={(e) => e.preventDefault()} onClick={() => accept(it)}>
                      {it.insert}
                    </button>
                  ) : null,
                )}
              </div>
            )}
            {!ac.grid && ac.items.map((it, i) => (
              <button
                key={it.kind + it.insert}
                className={`ac-item ${i === ac.sel ? 'on' : ''}`}
                role="option"
                aria-selected={i === ac.sel}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => accept(it)}
              >
                <span className="ac-kind">{t(`ac.${it.kind}`)}</span>
                <span className={`ac-label ${it.tone ? 'tone-' + it.tone : ''}`}>{it.insert}</span>
                {it.value && <span className="ac-detail">{formatValue(it.value, fmt)}</span>}
              </button>
            ))}
            <div className="ac-hint">{ac.grid ? t('slash.hint') : t('ac.hint')}</div>
          </div>
        )}
      </div>
      <div className="calc-res" ref={resRef}>
        {lines.map((_, i) => {
          const r = results[i];
          if (!r) return <div key={i} />;
          if (r.kind === 'value' && r.value) {
            const s = formatValue(r.value, fmt);
            return (
              <div key={i} className={`res ${r.assigned ? 'assigned' : ''} ${r.aggregate ? 'aggregate' : ''} ${r.tone ? 'tone-' + r.tone : ''} ${i === activeLine ? 'active' : ''}`}>
                {(() => {
                  const n = attachCount?.(i) ?? 0;
                  if (n > 0)
                    return (
                      <button className="res-clip on" title={t('att.view')} onClick={() => onShowAttach?.(i)}>
                        <Paperclip size={12} />
                        {n > 1 && <small>{n}</small>}
                      </button>
                    );
                  return onAttach ? (
                    <button className={`res-clip ${i === activeLine ? 'show' : ''}`} title={t('att.add')} onMouseDown={(e) => e.preventDefault()} onClick={() => onAttach(i)}>
                      <Paperclip size={12} />
                    </button>
                  ) : null;
                })()}
                {r.due && onReminder && (
                  <button className={`res-bell ${hasReminder?.(i) ? 'on' : ''}`} title={hasReminder?.(i) ? t('rem.has') : t('rem.createFromLine')} onClick={() => onReminder(i)}>
                    {hasReminder?.(i) ? <BellRing size={13} /> : <Bell size={13} />}
                  </button>
                )}
                <button className="res-val" title={t('editor.clickToCopy')} onClick={() => copyResult(r.value!)}>
                  <span>{s}</span>
                  <Copy size={12} className="res-copy" />
                </button>
              </div>
            );
          }
          if (r.kind === 'command') {
            return (
              <div key={i} className="res cmd">
                <span className="res-cmd">{t('inline.hint')}</span>
              </div>
            );
          }
          if (r.kind === 'error' && r.error) {
            const e = errorLabel(r.error);
            if (!e) return <div key={i} />;
            return (
              <div key={i} className="res err">
                {e.action ? (
                  <button className="res-err" onClick={() => refreshRates(true)} title={t('rates.refresh')}>
                    <RefreshCw size={12} /> {e.text}
                  </button>
                ) : (
                  <span className="res-err">{e.text}</span>
                )}
              </div>
            );
          }
          return <div key={i} />;
        })}
      </div>
    </div>
  );
}
