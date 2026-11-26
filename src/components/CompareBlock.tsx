/** Bloco "Relatório comparativo": tabela e barras comparando notas salvas (BI simples). */
import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Plus, X } from 'lucide-react';
import type { Block, Note } from '../lib/types';
import type { Evaluated } from '../lib/noteEval';
import { compareRows, deltaTone, noteFigures, type CompareRow } from '../lib/compare';
import { formatValue, type EvalContext, type FormatOptions } from '../engine/value';
import { NoteIcon } from '../lib/icons';
import { useData } from '../store/data';
import { Menu, MenuItem } from './ui';
import { useT, useLang, LOCALES } from '../i18n';

type CompareB = Extract<Block, { type: 'compare' }>;

/** cor de cada coluna: a mais recente em destaque, as anteriores em tons neutros */
const colColor = (i: number, n: number) => (i === n - 1 ? 'var(--accent)' : ['#64748b', '#f59e0b', '#06b6d4', '#ec4899'][i % 4]);

export function useCompare(note: Note, block: CompareB, ctx: EvalContext, fmt: FormatOptions, ev: Evaluated) {
  const notes = useData((s) => s.notes);
  return useMemo(() => {
    const cols = block.sources
      .map((id) => (id === 'self' ? note : notes.find((n) => n.id === id && !n.deleted)))
      .filter((n): n is Note => !!n);
    const figs = cols.map((n) => noteFigures(n, ctx, fmt, n.id === note.id ? ev : undefined));
    return { cols, rows: compareRows(figs, ctx, block.only ?? 'all') };
  }, [notes, note, block.sources, block.only, ctx, fmt, ev]);
}

export function CompareBlock({ note, block, ctx, fmt, ev, onChange }: { note: Note; block: CompareB; ctx: EvalContext; fmt: FormatOptions; ev: Evaluated; onChange(p: Partial<CompareB>): void }) {
  const t = useT();
  const lang = useLang();
  const notes = useData((s) => s.notes);
  const { cols, rows } = useCompare(note, block, ctx, fmt, ev);
  const candidates = notes.filter((n) => !n.deleted && n.id !== note.id && !block.sources.includes(n.id)).sort((a, b) => b.updated - a.updated);
  const colName = (n: Note) => (n.id === note.id ? t('cmp.thisNote') : n.title || t('note.untitled'));
  const max = Math.max(1, ...rows.flatMap((r) => r.values.map((v) => Math.abs(v?.n ?? 0))));
  const pct = (r: CompareRow) => (r.pct === undefined ? '' : `${r.pct > 0 ? '+' : ''}${(r.pct * 100).toLocaleString(LOCALES[lang], { maximumFractionDigits: 1 })}%`);
  const delta = (r: CompareRow) => (r.delta ? (r.delta.n > 0 ? '+' : '') + formatValue(r.delta, fmt) : '—');

  return (
    <div className="cmp">
      <div className="cmp-head">
        <input className="cmp-title" value={block.title ?? ''} placeholder={t('cmp.title')} onChange={(e) => onChange({ title: e.target.value })} />
        <div className="seg small">
          <button className={(block.only ?? 'all') === 'all' ? 'on' : ''} onClick={() => onChange({ only: 'all' })}>
            {t('cmp.all')}
          </button>
          <button className={block.only === 'sections' ? 'on' : ''} onClick={() => onChange({ only: 'sections' })}>
            {t('cmp.totals')}
          </button>
        </div>
      </div>
      <div className="cmp-sources">
        {block.sources.map((id, i) => {
          const n = id === 'self' ? note : notes.find((x) => x.id === id);
          return (
            <span key={id + i} className="cmp-chip" style={{ '--c': colColor(i, block.sources.length) } as React.CSSProperties}>
              <span className="cmp-dot" />
              {n ? <NoteIcon name={n.icon} size={13} /> : null}
              {n ? colName(n) : t('cmp.missing')}
              <button onClick={() => onChange({ sources: block.sources.filter((_, j) => j !== i) })} title={t('block.remove')}>
                <X size={12} />
              </button>
            </span>
          );
        })}
        <Menu
          align="left"
          button={(toggle) => (
            <button className="cmp-add" onClick={toggle}>
              <Plus size={13} /> {t('cmp.addNote')}
            </button>
          )}
        >
          {(close) => (
            <>
              {!block.sources.includes('self') && (
                <MenuItem icon={<NoteIcon name={note.icon} size={15} color={note.color} />} onClick={() => (onChange({ sources: [...block.sources, 'self'] }), close())}>
                  {t('cmp.thisNote')}
                </MenuItem>
              )}
              {candidates.slice(0, 30).map((n) => (
                <MenuItem key={n.id} icon={<NoteIcon name={n.icon} size={15} color={n.color} />} onClick={() => (onChange({ sources: [n.id, ...block.sources] }), close())}>
                  {n.title || t('note.untitled')} · {new Date(n.updated).toLocaleDateString(LOCALES[lang])}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>
      {cols.length < 2 || !rows.length ? (
        <p className="cmp-empty">{t('cmp.hint')}</p>
      ) : (
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th />
                {cols.map((c, i) => (
                  <th key={c.id + i} style={{ '--c': colColor(i, cols.length) } as React.CSSProperties}>
                    <span className="cmp-dot" /> {colName(c)}
                  </th>
                ))}
                {cols.length >= 2 && <th>{t('cmp.change')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dt = deltaTone(r);
                return (
                  <tr key={r.kind + r.key} className={`k-${r.kind} ${r.tone ? 'tone-' + r.tone : ''}`}>
                    <td className="cmp-label">
                      {r.kind === 'section' ? '#' : ''}
                      {r.label}
                      <div className="cmp-bars">
                        {r.values.map((v, i) => (
                          <span key={i} style={{ width: `${(Math.abs(v?.n ?? 0) / max) * 100}%`, background: colColor(i, cols.length) }} />
                        ))}
                      </div>
                    </td>
                    {r.values.map((v, i) => (
                      <td key={i} className="cmp-num">
                        {v ? formatValue(v, fmt) : '—'}
                      </td>
                    ))}
                    <td className={`cmp-num cmp-delta ${dt ? 'tone-' + dt : ''}`}>
                      {r.delta ? r.delta.n > 0 ? <ArrowUpRight size={13} /> : r.delta.n < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} /> : null} {delta(r)}
                      {r.pct !== undefined && <small>{pct(r)}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
