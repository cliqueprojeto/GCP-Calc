/** Prévia do "Organizar": antes × depois, com revisão opcional pela IA, antes de substituir o bloco. */
import { useMemo, useState } from 'react';
import { ListTree, MessageSquareText, RefreshCw } from 'lucide-react';
import { Modal } from './ui';
import { evaluateDocument, newDocState, type DocState } from '../engine/evaluate';
import { formatValue, type EvalContext, type FormatOptions } from '../engine/value';
import { organizeText } from '../lib/organize';
import { useData } from '../store/data';
import { isTransient, nextStep, orderedProviders } from '../ai/assist';
import { toast } from '../store/ui';
import { useT } from '../i18n';
import type { LineResult } from '../engine/evaluate';

export function Preview({ text, ctx, fmt, base }: { text: string; ctx: EvalContext; fmt: FormatOptions; base?: DocState }) {
  const res = useMemo(() => {
    const st: DocState = base ? { ...base, vars: new Map(base.vars), lines: [...base.lines], group: [], sections: new Map() } : newDocState();
    return evaluateDocument(text, ctx, st).lines;
  }, [text, ctx, base]);
  return (
    <div className="org-preview">
      {text.split('\n').map((l, i) => {
        const r = res[i];
        return (
          <div key={i} className={`org-line k-${r?.kind ?? 'empty'} ${r?.tone ? 'tone-' + r.tone : ''}`}>
            <span className="org-src">{l || ' '}</span>
            {r?.value && <span className="org-val">{formatValue(r.value, fmt)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function OrganizeModal({
  text,
  results,
  ctx,
  fmt,
  noteContext,
  onApply,
  onClose,
}: {
  text: string;
  results: LineResult[];
  ctx: EvalContext;
  fmt: FormatOptions;
  noteContext: string;
  onApply(text: string): void;
  onClose(): void;
}) {
  const t = useT();
  const auto = useMemo(() => organizeText(text, results, fmt, ctx.lang), [text, results, fmt, ctx.lang]);
  const [proposal, setProposal] = useState(auto);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const askAi = async () => {
    const st = useData.getState();
    const providers = orderedProviders(st.settings.ai.providers, st.settings.ai.active);
    if (!providers.length) return toast(t('inline.noAi'), 'error');
    setBusy(true);
    try {
      const goal = `${t('org.aiGoal')}\n\n${text}`;
      const step = await nextStep(providers, { lang: ctx.lang, decimal: ctx.decimal, baseCurrency: st.settings.baseCurrency, goal, noteContext, turns: [], inline: true }, undefined, (m) =>
        toast(t('assist.fallback', { model: m })),
      );
      if (step.type === 'result') {
        setProposal(step.lines.join('\n').trim());
        setNote(step.explanation);
      } else setNote(step.question);
    } catch (e) {
      toast(isTransient(e) ? t('assist.busy') : `${t('assist.error')}: ${String((e as Error)?.message || e).slice(0, 160)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('org.title')} wide className="org-modal">
      <p className="muted small">{t('org.hint')}</p>
      <div className="org-cols">
        <div>
          <div className="org-head">{t('org.before')}</div>
          <Preview text={text} ctx={ctx} fmt={fmt} />
        </div>
        <div>
          <div className="org-head">{t('org.after')}</div>
          <Preview text={proposal} ctx={ctx} fmt={fmt} />
        </div>
      </div>
      {note && <p className="org-note">{note}</p>}
      <div className="btn-row">
        <button className="btn" onClick={askAi} disabled={busy}>
          {busy ? <RefreshCw size={15} className="spin" /> : <MessageSquareText size={15} />} {t('org.ai')}
        </button>
        {proposal !== auto && (
          <button className="btn" onClick={() => (setProposal(auto), setNote(''))}>
            {t('org.reset')}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
        <button className="btn primary" disabled={!proposal.trim() || proposal === text} onClick={() => (onApply(proposal), onClose())}>
          <ListTree size={15} /> {t('org.apply')}
        </button>
      </div>
    </Modal>
  );
}
