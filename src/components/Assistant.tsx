/**
 * Assistente passo a passo dentro da nota: botões contextuais e dinâmicos que vão
 * perguntando (escolhas, número, texto) até gerar as linhas do cálculo.
 * Funciona offline com assistentes prontos e, com IA configurada, para qualquer pedido.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChartPie, CornerDownLeft, Loader2, RotateCcw, Sigma, ListOrdered, MessageCircleQuestion, Calculator, X, Coins, MessageSquareText, ListChecks } from 'lucide-react';
import { WIZARDS, type Wizard } from '../ai/wizards';
import { isTransient, nextStep, orderedProviders, type AssistStep, type Turn } from '../ai/assist';
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
  /** passos já obtidos (ex.: pelo comando /ia, quando a IA precisou perguntar algo) */
  initialTurns?: Turn[];
  onInsert(lines: string[]): void;
  onAddChart(): void;
  onClose(): void;
}

type Mode = { kind: 'start' } | { kind: 'wizard'; w: Wizard; i: number; answers: Record<string, string> } | { kind: 'ai'; goal: string; turns: Turn[]; loading: boolean; error?: string };

function cloneState(st: DocState): DocState {
  return { vars: new Map(st.vars), funcs: new Map(st.funcs), lines: [...st.lines], group: [], prev: st.prev };
}

export function Assistant({ ctx, noteState, noteContext, hasValues, initialGoal, initialTurns, onInsert, onAddChart, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const settings = useData((s) => s.settings);
  const providers = orderedProviders(settings.ai.providers, settings.ai.active);
  const provider = providers[0];
  const [fallback, setFallback] = useState('');
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
    setFallback('');
    try {
      const step = await nextStep(providers, { lang, decimal: ctx.decimal, baseCurrency: settings.baseCurrency, goal, noteContext, turns }, ac.signal, setFallback);
      if (ac.signal.aborted) return;
      setMode({ kind: 'ai', goal, turns: [...turns, { step }], loading: false });
    } catch (e) {
      if (ac.signal.aborted) return;
      setMode({ kind: 'ai', goal, turns, loading: false, error: isTransient(e) ? t('assist.busy') : String((e as Error)?.message || e) });
    }
  };

  useEffect(() => {
    if (initialGoal && initialTurns?.length) setMode({ kind: 'ai', goal: initialGoal, turns: initialTurns, loading: false });
    else if (initialGoal && provider) askAi(initialGoal, []);
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
        <ListOrdered size={16} /> {t('assist.title')}
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
    const examples = [t('assist.ex1'), t('assist.ex2'), t('assist.ex3'), t('assist.ex4')];
    return (
      <div className="assistant">
        {head}
        <p className="as-intro">{t('assist.intro')}</p>
        <div className="as-section">
          <div className="as-label">
            <MessageCircleQuestion size={13} /> {t('assist.askTitle')}
          </div>
          {provider ? (
            <>
              <form
                className="as-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) askAi(input.trim(), []);
                  setInput('');
                }}
              >
                <MessageCircleQuestion size={16} />
                <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('assist.askPlaceholder')} />
                <button className="btn primary sm" type="submit" disabled={!input.trim()}>
                  <CornerDownLeft size={14} />
                </button>
              </form>
              <div className="as-examples">
                <span>{t('assist.examples')}</span>
                {examples.map((ex) => (
                  <button key={ex} className="chip ghost" onClick={() => askAi(ex, [])}>
                    {ex}
                  </button>
                ))}
              </div>
              <div className="as-tip">
                <code>/ia</code> {t('assist.tipInline')}
              </div>
            </>
          ) : (
            <div className="as-noai">
              <Calculator size={14} /> {t('assist.noAi')}{' '}
              <button className="link" onClick={() => useUi.getState().go({ kind: 'settings', section: 'ai' })}>
                {t('assist.configureAi')}
              </button>
            </div>
          )}
        </div>
        {quick.length > 0 && (
          <div className="as-section">
            <div className="as-label">{t('assist.quickTitle')}</div>
            <div className="as-chips">
              {quick.map((q) => (
                <button key={q.id} className="chip" onClick={q.run}>
                  {q.icon} {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="as-section">
          <div className="as-label">{t('assist.guided')}</div>
          <p className="as-hint">{t('assist.guidedHint')}</p>
          <div className="as-wizards">
            {WIZARDS.map((w) => (
              <button key={w.id} className="as-wiz" onClick={() => setMode({ kind: 'wizard', w, i: 0, answers: {} })}>
                <NoteIcon name={w.icon} size={18} />
                <span className="as-wiz-text">
                  <b>{w.title[lang]}</b>
                  <small>{w.desc[lang]}</small>
                </span>
              </button>
            ))}
          </div>
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
        <MessageCircleQuestion size={14} /> {mode.goal}
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
          <Loader2 size={16} className="spin" /> {fallback ? t('assist.fallback', { model: fallback }) : t('assist.thinking')}
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
                  <ArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} /> {f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
