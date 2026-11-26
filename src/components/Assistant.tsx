/**
 * Assistente passo a passo dentro da nota: botões contextuais e dinâmicos que vão
 * perguntando (escolhas, número, texto) até gerar as linhas do cálculo.
 * Funciona offline com assistentes prontos e, com IA configurada, para qualquer pedido.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChartPie, CornerDownLeft, Loader2, RotateCcw, Sigma, Sparkles, Wand2, X, Coins, MessageSquareText, ListChecks } from 'lucide-react';
import { WIZARDS, type Wizard } from '../ai/wizards';
import { nextStep, type AssistStep, type Turn } from '../ai/assist';
import { evaluateLine, type DocState } from '../engine/evaluate';
import { formatValue } from '../engine/value';
import { currencySymbol } from '../engine/value';
import { formatOptions } from '../lib/calcContext';
import { NoteIcon } from '../lib/icons';
import { useData } from '../store/data';
import { useUi } from '../store/ui';
import { useLang, useT } from '../i18n';
import type { EvalContext } from '../engine/value';

interface Props {
  ctx: EvalContext;
  noteState: DocState;
  noteContext: string;
  hasValues: boolean;
  initialGoal?: string;
  onInsert(lines: string[]): void;
  onAddChart(): void;
  onClose(): void;
}

type Mode = { kind: 'start' } | { kind: 'wizard'; w: Wizard; i: number; answers: Record<string, string> } | { kind: 'ai'; goal: string; turns: Turn[]; loading: boolean; error?: string };

function cloneState(st: DocState): DocState {
  return { vars: new Map(st.vars), funcs: new Map(st.funcs), lines: [...st.lines], group: [], prev: st.prev };
}

export function Assistant({ ctx, noteState, noteContext, hasValues, initialGoal, onInsert, onAddChart, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const settings = useData((s) => s.settings);
  const provider = settings.ai.providers.find((p) => p.id === settings.ai.active) ?? settings.ai.providers[0];
  const [mode, setMode] = useState<Mode>({ kind: 'start' });
  const [input, setInput] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fmt = formatOptions(ctx);
  const cur = currencySymbol(settings.baseCurrency, { lang, tags: ctx.tags });
  const dec = ctx.decimal === 'comma' ? ',' : '.';

  const askAi = async (goal: string, turns: Turn[]) => {
    if (!provider) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setMode({ kind: 'ai', goal, turns, loading: true });
    try {
      const step = await nextStep(provider, { lang, decimal: ctx.decimal, baseCurrency: settings.baseCurrency, goal, noteContext, turns }, ac.signal);
      if (ac.signal.aborted) return;
      setMode({ kind: 'ai', goal, turns: [...turns, { step }], loading: false });
    } catch (e) {
      if (ac.signal.aborted) return;
      setMode({ kind: 'ai', goal, turns, loading: false, error: String((e as Error)?.message || e) });
    }
  };

  useEffect(() => {
    if (initialGoal && provider) askAi(initialGoal, []);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = (lines: string[]) => {
    const st = cloneState(noteState);
    return lines.map((l) => ({ line: l, r: evaluateLine(l, ctx, st) }));
  };

  const Preview = ({ lines }: { lines: string[] }) => (
    <div className="as-preview">
      {preview(lines).map(({ line, r }, i) => (
        <div key={i} className="as-pline">
          <span className="as-src">
            {r.segments.map((s, j) => (
              <span key={j} className={`s-${s.cls}`}>
                {s.text}
              </span>
            ))}
          </span>
          <span className="as-res">{r.value ? formatValue(r.value, fmt) : r.kind === 'error' ? '⚠' : ''}</span>
        </div>
      ))}
    </div>
  );

  // --------------------------------------------------------------- início
  const quick = useMemo(() => {
    const fav = settings.favoriteCurrencies.find((c) => c !== settings.baseCurrency) ?? 'USD';
    const out: { id: string; icon: JSX.Element; label: string; run(): void }[] = [];
    if (hasValues) {
      out.push({ id: 'total', icon: <Sigma size={14} />, label: t('assist.quick.total'), run: () => onInsert(['total']) });
      out.push({ id: 'chart', icon: <ChartPie size={14} />, label: t('assist.quick.chart'), run: onAddChart });
      out.push({ id: 'conv', icon: <Coins size={14} />, label: t('assist.quick.convert', { cur: fav }), run: () => onInsert([`prev ${t('assist.conv')} ${fav}`]) });
      if (provider) {
        out.push({ id: 'explain', icon: <MessageSquareText size={14} />, label: t('assist.quick.explain'), run: () => askAi(t('assist.goal.explain'), []) });
        out.push({ id: 'review', icon: <ListChecks size={14} />, label: t('assist.quick.review'), run: () => askAi(t('assist.goal.review'), []) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValues, provider, settings.favoriteCurrencies, settings.baseCurrency, lang]);

  const head = (
    <div className="as-head">
      <div className="as-title">
        <Wand2 size={16} /> {t('assist.title')}
      </div>
      <div className="as-head-actions">
        {mode.kind !== 'start' && (
          <button className="icon-btn" title={t('assist.restart')} onClick={() => setMode({ kind: 'start' })}>
            <RotateCcw size={15} />
          </button>
        )}
        <button className="icon-btn" title={t('common.close')} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
    </div>
  );

  if (mode.kind === 'start') {
    return (
      <div className="assistant">
        {head}
        {provider ? (
          <form
            className="as-ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) askAi(input.trim(), []);
              setInput('');
            }}
          >
            <Sparkles size={16} />
            <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('assist.askPlaceholder')} />
            <button className="btn primary sm" type="submit" disabled={!input.trim()}>
              <CornerDownLeft size={14} />
            </button>
          </form>
        ) : (
          <div className="as-noai">
            <Sparkles size={14} /> {t('assist.noAi')}{' '}
            <button className="link" onClick={() => useUi.getState().go({ kind: 'settings', section: 'ai' })}>
              {t('assist.configureAi')}
            </button>
          </div>
        )}
        {quick.length > 0 && (
          <div className="as-chips">
            {quick.map((q) => (
              <button key={q.id} className="chip" onClick={q.run}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        )}
        <div className="as-label">{t('assist.guided')}</div>
        <div className="as-wizards">
          {WIZARDS.map((w) => (
            <button key={w.id} className="as-wiz" onClick={() => setMode({ kind: 'wizard', w, i: 0, answers: {} })}>
              <NoteIcon name={w.icon} size={18} />
              <span>{w.title[lang]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------- assistente offline
  if (mode.kind === 'wizard') {
    const { w, i, answers } = mode;
    const done = i >= w.steps.length;
    const step = w.steps[Math.min(i, w.steps.length - 1)];
    const answer = (value: string) => {
      setMode({ ...mode, answers: { ...answers, [step.id]: value }, i: i + 1 });
      setInput('');
    };
    return (
      <div className="assistant">
        {head}
        <div className="as-wiz-title">
          <NoteIcon name={w.icon} size={16} /> {w.title[lang]}
          <div className="as-dots">
            {w.steps.map((_, k) => (
              <i key={k} className={k < i ? 'done' : k === i ? 'on' : ''} />
            ))}
          </div>
        </div>
        <div className="as-trail">
          {w.steps.slice(0, i).map((s) => (
            <span key={s.id} className="as-ans">
              {s.q[lang]} <b>{s.options ? (s.options(answers, lang).find((o) => o.value === answers[s.id])?.label ?? answers[s.id]) : answers[s.id]}</b>
            </span>
          ))}
        </div>
        {!done ? (
          <div className="as-step">
            <div className="as-q">{step.q[lang]}</div>
            {step.input === 'choice' && step.options ? (
              <div className="as-chips">
                {step.options(answers, lang).map((o) => (
                  <button key={o.value} className="chip" onClick={() => answer(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="as-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = input.trim() || step.def?.(dec) || '';
                  if (v) answer(v);
                }}
              >
                <input
                  autoFocus
                  inputMode={step.input === 'number' ? 'decimal' : 'text'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={step.def?.(dec) ?? step.placeholder?.[lang] ?? ''}
                />
                <button className="btn primary sm" type="submit">
                  <CornerDownLeft size={14} />
                </button>
              </form>
            )}
            {i > 0 && (
              <button className="link as-back" onClick={() => setMode({ ...mode, i: i - 1 })}>
                <ArrowLeft size={13} /> {t('common.back')}
              </button>
            )}
          </div>
        ) : (
          <div className="as-step">
            <Preview lines={w.build(answers, { lang, cur, dec })} />
            <div className="as-actions">
              <button className="btn primary" onClick={() => onInsert(w.build(answers, { lang, cur, dec }))}>
                <Check size={15} /> {t('assist.insert')}
              </button>
              <button className="btn" onClick={() => setMode({ ...mode, i: i - 1 })}>
                <ArrowLeft size={15} /> {t('common.back')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------- com IA
  const last = mode.turns[mode.turns.length - 1];
  const step: AssistStep | undefined = last?.step;
  const answerAi = (a: string) => {
    const turns = [...mode.turns];
    turns[turns.length - 1] = { ...turns[turns.length - 1], answer: a };
    setInput('');
    askAi(mode.goal, turns);
  };
  return (
    <div className="assistant">
      {head}
      <div className="as-goal">
        <Sparkles size={14} /> {mode.goal}
      </div>
      <div className="as-trail">
        {mode.turns
          .filter((x) => x.answer !== undefined && x.step.type === 'ask')
          .map((x, k) => (
            <span key={k} className="as-ans">
              {(x.step as { question: string }).question} <b>{x.answer}</b>
            </span>
          ))}
      </div>
      {mode.loading && (
        <div className="as-loading">
          <Loader2 size={16} className="spin" /> {t('assist.thinking')}
        </div>
      )}
      {mode.error && (
        <div className="as-error">
          {t('assist.error')}: {mode.error}{' '}
          <button className="link" onClick={() => askAi(mode.goal, mode.turns)}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {!mode.loading && step?.type === 'ask' && (
        <div className="as-step">
          <div className="as-q">{step.question}</div>
          {step.hint && <div className="as-hint">{step.hint}</div>}
          {step.options && step.options.length > 0 && (
            <div className="as-chips">
              {step.options.map((o) => (
                <button key={o} className="chip" onClick={() => answerAi(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <form
            className="as-ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) answerAi(input.trim());
            }}
          >
            <input autoFocus inputMode={step.input === 'number' ? 'decimal' : 'text'} value={input} onChange={(e) => setInput(e.target.value)} placeholder={step.placeholder ?? t('assist.typeAnswer')} />
            <button className="btn primary sm" type="submit" disabled={!input.trim()}>
              <CornerDownLeft size={14} />
            </button>
          </form>
        </div>
      )}
      {!mode.loading && step?.type === 'result' && (
        <div className="as-step">
          {step.title && <div className="as-q">{step.title}</div>}
          {step.explanation && <p className="as-expl">{step.explanation}</p>}
          {step.lines.length > 0 && <Preview lines={step.lines} />}
          <div className="as-actions">
            {step.lines.length > 0 && (
              <button className="btn primary" onClick={() => onInsert(step.lines)}>
                <Check size={15} /> {t('assist.insert')}
              </button>
            )}
          </div>
          {step.followups && step.followups.length > 0 && (
            <div className="as-chips">
              {step.followups.map((f) => (
                <button key={f} className="chip" onClick={() => answerAi(f)}>
                  <Sparkles size={13} /> {f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
