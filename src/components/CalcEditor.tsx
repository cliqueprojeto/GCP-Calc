/**
 * Editor de cálculo: um textarea transparente sobre o texto colorido (estilo editor
 * de código) e, à direita, a coluna de resultados alinhada linha a linha.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import type { LineResult } from '../engine/evaluate';
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
}

export function CalcEditor({ blockId, text, results, fmt, firstLine, onChange, autoFocus }: CalcEditorProps) {
  const t = useT();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const srcRef = useRef<HTMLDivElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const lineNumbers = useData((s) => s.settings.lineNumbers);
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
      <div className="calc-src-wrap">
        <div className="calc-src" ref={srcRef} aria-hidden>
          {lines.map((line, i) => {
            const r = results[i];
            return (
              <div key={i} className={`src-line k-${r?.kind ?? 'empty'} ${i === activeLine ? 'active' : ''}`}>
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
            onChange(e.target.value);
            updateActive();
          }}
          onKeyDown={onKeyDown}
          onSelect={updateActive}
          onFocus={(e) => {
            lastInput = e.currentTarget;
            lastChange = onChange;
            useUi.getState().set({ focusBlock: blockId });
            updateActive();
          }}
          onBlur={() => setActiveLine(-1)}
        />
      </div>
      <div className="calc-res" ref={resRef}>
        {lines.map((_, i) => {
          const r = results[i];
          if (!r) return <div key={i} />;
          if (r.kind === 'value' && r.value) {
            const s = formatValue(r.value, fmt);
            return (
              <div key={i} className={`res ${r.assigned ? 'assigned' : ''} ${r.aggregate ? 'aggregate' : ''} ${i === activeLine ? 'active' : ''}`}>
                <button className="res-val" title={t('editor.clickToCopy')} onClick={() => copyResult(r.value!)}>
                  <span>{s}</span>
                  <Copy size={12} className="res-copy" />
                </button>
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
