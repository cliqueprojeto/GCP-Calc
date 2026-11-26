/** Elementos gráficos que podem ser inseridos entre os blocos de cálculo. */
import { useLayoutEffect, useRef, useState } from 'react';
import { ChartColumn, ChartPie, ChartLine, ChartBarBig, CircleDot, ImagePlus, RefreshCw } from 'lucide-react';
import type { Block, ChartKind } from '../lib/types';
import { formatValue, type EvalContext, type FormatOptions, type Value } from '../engine/value';
import { convert, currencyUnit } from '../engine/value';
import { currencyInfo } from '../engine/currencies';
import { NoteIcon, COLORS } from '../lib/icons';
import { pickImage } from '../lib/platform';
import { useRates } from '../lib/rates';
import { useT, useLang, LOCALES } from '../i18n';

export interface ChartDatum {
  label: string;
  n: number;
  value: Value;
}

const PALETTE = ['var(--accent)', 'var(--accent-2)', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316', '#a855f7', '#0ea5e9'];

export function ChartBlock({ block, data, fmt, onChange }: { block: Extract<Block, { type: 'chart' }>; data: ChartDatum[]; fmt: FormatOptions; onChange(p: Partial<Block>): void }) {
  const t = useT();
  const [hover, setHover] = useState(-1);
  const kinds: { k: ChartKind; icon: JSX.Element }[] = [
    { k: 'bar', icon: <ChartColumn size={15} /> },
    { k: 'hbar', icon: <ChartBarBig size={15} /> },
    { k: 'pie', icon: <ChartPie size={15} /> },
    { k: 'donut', icon: <CircleDot size={15} /> },
    { k: 'line', icon: <ChartLine size={15} /> },
  ];
  const pos = data.filter((d) => d.n > 0);
  const total = pos.reduce((a, d) => a + d.n, 0);
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.n)));
  const fmtV = (d: ChartDatum) => formatValue(d.value, fmt);

  let chart: JSX.Element;
  if (!data.length) chart = <div className="chart-empty">{t('chart.empty')}</div>;
  else if (block.kind === 'pie' || block.kind === 'donut') {
    let a0 = -Math.PI / 2;
    const R = 80;
    const r = block.kind === 'donut' ? 48 : 0;
    const arcs = pos.map((d, i) => {
      const a1 = a0 + (d.n / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, ang: number) => `${100 + rad * Math.cos(ang)} ${100 + rad * Math.sin(ang)}`;
      const path =
        pos.length === 1
          ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} Z`
          : r
            ? `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`
            : `M 100 100 L ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} Z`;
      a0 = a1;
      return <path key={i} d={path} fill={PALETTE[i % PALETTE.length]} opacity={hover === -1 || hover === i ? 1 : 0.35} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} />;
    });
    chart = (
      <div className="chart-pie">
        <svg viewBox="0 0 200 200" width="200" height="200">
          {arcs}
          {block.kind === 'donut' && (
            <text x="100" y="106" textAnchor="middle" className="chart-center">
              {hover >= 0 ? `${Math.round((pos[hover].n / total) * 100)}%` : pos.length}
            </text>
          )}
        </svg>
        <ul className="chart-legend">
          {pos.map((d, i) => (
            <li key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)} className={hover === i ? 'on' : ''}>
              <i style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="lg-label">{d.label}</span>
              <span className="lg-val">{fmtV(d)}</span>
              <span className="lg-pct">{Math.round((d.n / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (block.kind === 'hbar') {
    chart = (
      <div className="chart-hbar">
        {data.map((d, i) => (
          <div key={i} className="hbar-row">
            <span className="hbar-label">{d.label}</span>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(Math.abs(d.n) / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
            <span className="hbar-val">{fmtV(d)}</span>
          </div>
        ))}
      </div>
    );
  } else {
    const W = 560;
    const H = 200;
    const pad = 28;
    const bw = (W - pad * 2) / data.length;
    const y = (n: number) => H - pad - (Math.max(0, n) / max) * (H - pad * 2);
    chart = (
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
        {block.kind === 'bar' &&
          data.map((d, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
              <rect x={pad + i * bw + bw * 0.15} y={y(d.n)} width={bw * 0.7} height={H - pad - y(d.n)} rx="6" fill={PALETTE[i % PALETTE.length]} opacity={hover === -1 || hover === i ? 1 : 0.4} />
              <text x={pad + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="chart-x">
                {d.label.slice(0, 14)}
              </text>
              {(hover === i || data.length <= 6) && (
                <text x={pad + i * bw + bw / 2} y={y(d.n) - 6} textAnchor="middle" className="chart-v">
                  {fmtV(d)}
                </text>
              )}
            </g>
          ))}
        {block.kind === 'line' && (
          <>
            <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" points={data.map((d, i) => `${pad + i * bw + bw / 2},${y(d.n)}`).join(' ')} />
            {data.map((d, i) => (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
                <circle cx={pad + i * bw + bw / 2} cy={y(d.n)} r={hover === i ? 7 : 5} fill="var(--accent-2)" />
                <text x={pad + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="chart-x">
                  {d.label.slice(0, 14)}
                </text>
                {hover === i && (
                  <text x={pad + i * bw + bw / 2} y={y(d.n) - 12} textAnchor="middle" className="chart-v">
                    {fmtV(d)}
                  </text>
                )}
              </g>
            ))}
          </>
        )}
      </svg>
    );
  }

  return (
    <div className="blk blk-chart">
      <div className="chart-head">
        <input className="chart-title" value={block.title ?? ''} placeholder={t('chart.title')} onChange={(e) => onChange({ title: e.target.value })} />
        <div className="seg">
          {kinds.map((k) => (
            <button key={k.k} className={block.kind === k.k ? 'on' : ''} onClick={() => onChange({ kind: k.k })} title={t(`chart.${k.k}` as 'chart.bar')}>
              {k.icon}
            </button>
          ))}
        </div>
      </div>
      {chart}
    </div>
  );
}

export function ProgressBlock({ block, value, goal, fmt, onChange }: { block: Extract<Block, { type: 'progress' }>; value?: Value; goal?: Value; fmt: FormatOptions; onChange(p: Partial<Block>): void }) {
  const t = useT();
  const pct = value && goal && goal.n ? Math.max(0, Math.min(1, value.n / goal.n)) : 0;
  return (
    <div className="blk blk-progress">
      <div className="prog-head">
        <input className="prog-label" value={block.label} placeholder={t('progress.label')} onChange={(e) => onChange({ label: e.target.value })} />
        <span className="prog-pct" style={{ color: block.color }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${pct * 100}%`, background: block.color }} />
      </div>
      <div className="prog-exprs">
        <label>
          {t('progress.value')}
          <input value={block.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="sobra" />
          <b>{value ? formatValue(value, fmt) : '—'}</b>
        </label>
        <label>
          {t('progress.goal')}
          <input value={block.goal} onChange={(e) => onChange({ goal: e.target.value })} placeholder="R$ 10.000" />
          <b>{goal ? formatValue(goal, fmt) : '—'}</b>
        </label>
        <div className="prog-colors">
          {COLORS.slice(0, 8).map((c) => (
            <button key={c} style={{ background: c }} className={c === block.color ? 'on' : ''} onClick={() => onChange({ color: c })} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TickerBlock({ block, ctx, fmt, base, onChange }: { block: Extract<Block, { type: 'ticker' }>; ctx: EvalContext; fmt: FormatOptions; base: string; onChange(p: Partial<Block>): void }) {
  const t = useT();
  const lang = useLang();
  const { fetched, status, refresh } = useRates();
  const [adding, setAdding] = useState('');
  return (
    <div className="blk blk-ticker">
      <div className="ticker-row">
        {block.codes.map((c) => {
          let txt = '—';
          try {
            txt = formatValue(convert({ n: 1, unit: currencyUnit(c) }, currencyUnit(base), ctx), fmt);
          } catch {
            /* sem cotação */
          }
          return (
            <div key={c} className="tick" title={currencyInfo(c)?.label[lang === 'pt' ? 0 : lang === 'en' ? 1 : 2]}>
              <span className="tick-code">1 {c}</span>
              <span className="tick-val">{txt}</span>
              <button className="tick-x" onClick={() => onChange({ codes: block.codes.filter((x) => x !== c) })}>
                ×
              </button>
            </div>
          );
        })}
        <form
          className="tick-add"
          onSubmit={(e) => {
            e.preventDefault();
            const c = adding.trim().toUpperCase();
            if (c && !block.codes.includes(c)) onChange({ codes: [...block.codes, c] });
            setAdding('');
          }}
        >
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="+ JPY" maxLength={6} />
        </form>
      </div>
      <div className="ticker-foot">
        <button className="link" onClick={() => refresh(true)}>
          <RefreshCw size={12} className={status === 'loading' ? 'spin' : ''} /> {t('rates.refresh')}
        </button>
        <span>{fetched ? t('rates.updatedAt', { when: new Date(fetched).toLocaleString(LOCALES[lang]) }) : t('rates.never')}</span>
      </div>
    </div>
  );
}

export function CalloutBlock({ block, onChange, onPickIcon }: { block: Extract<Block, { type: 'callout' }>; onChange(p: Partial<Block>): void; onPickIcon(): void }) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [block.text]);
  return (
    <div className="blk blk-callout" style={{ '--c': block.color } as React.CSSProperties}>
      <button className="callout-icon" onClick={onPickIcon}>
        <NoteIcon name={block.icon} size={20} />
      </button>
      <textarea
        ref={ref}
        value={block.text}
        placeholder={t('callout.placeholder')}
        rows={1}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="callout-colors">
        {COLORS.slice(0, 10).map((c) => (
          <button key={c} style={{ background: c }} className={c === block.color ? 'on' : ''} onClick={() => onChange({ color: c })} />
        ))}
      </div>
    </div>
  );
}

export function ImageBlock({ block, onChange }: { block: Extract<Block, { type: 'image' }>; onChange(p: Partial<Block>): void }) {
  const t = useT();
  return (
    <div className="blk blk-image">
      {block.src ? (
        <figure>
          <img src={block.src} alt={block.caption ?? ''} style={{ width: `${block.width ?? 100}%` }} />
          <input className="caption" value={block.caption ?? ''} placeholder={t('image.caption')} onChange={(e) => onChange({ caption: e.target.value })} />
          <div className="img-tools">
            {[33, 50, 75, 100].map((w) => (
              <button key={w} className={(block.width ?? 100) === w ? 'on' : ''} onClick={() => onChange({ width: w })}>
                {w}%
              </button>
            ))}
            <button
              onClick={async () => {
                const src = await pickImage();
                if (src) onChange({ src });
              }}
            >
              {t('image.replace')}
            </button>
          </div>
        </figure>
      ) : (
        <button
          className="img-empty"
          onClick={async () => {
            const src = await pickImage();
            if (src) onChange({ src });
          }}
        >
          <ImagePlus size={22} /> {t('image.choose')}
        </button>
      )}
    </div>
  );
}

export function DividerBlock({ block, onChange }: { block: Extract<Block, { type: 'divider' }>; onChange(p: Partial<Block>): void }) {
  const styles: Extract<Block, { type: 'divider' }>['style'][] = ['line', 'dots', 'wave', 'gradient'];
  return (
    <div className={`blk blk-divider d-${block.style}`} onDoubleClick={() => onChange({ style: styles[(styles.indexOf(block.style) + 1) % styles.length] })}>
      {block.style === 'wave' ? (
        <svg viewBox="0 0 400 12" preserveAspectRatio="none">
          <path d="M0 6 Q 12.5 0 25 6 T 50 6 T 75 6 T 100 6 T 125 6 T 150 6 T 175 6 T 200 6 T 225 6 T 250 6 T 275 6 T 300 6 T 325 6 T 350 6 T 375 6 T 400 6" fill="none" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      ) : (
        <hr />
      )}
    </div>
  );
}

export function StickerBlock({ block, onChange, onPick }: { block: Extract<Block, { type: 'sticker' }>; onChange(p: Partial<Block>): void; onPick(): void }) {
  return (
    <div className="blk blk-sticker" style={{ textAlign: block.align }}>
      <button className="sticker" style={{ fontSize: block.size }} onClick={onPick}>
        <NoteIcon name={block.emoji} size={block.size} color="var(--accent)" />
      </button>
      <div className="sticker-tools">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button key={a} className={block.align === a ? 'on' : ''} onClick={() => onChange({ align: a })}>
            {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
          </button>
        ))}
        {[32, 56, 88].map((s) => (
          <button key={s} className={block.size === s ? 'on' : ''} onClick={() => onChange({ size: s })}>
            {s === 32 ? 'S' : s === 56 ? 'M' : 'L'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeadingBlock({ block, onChange }: { block: Extract<Block, { type: 'heading' }>; onChange(p: Partial<Block>): void }) {
  const t = useT();
  return (
    <div className={`blk blk-heading h${block.level}`}>
      <input value={block.text} placeholder={t('heading.placeholder')} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="seg small">
        {([1, 2, 3] as const).map((l) => (
          <button key={l} className={block.level === l ? 'on' : ''} onClick={() => onChange({ level: l })}>
            H{l}
          </button>
        ))}
      </div>
    </div>
  );
}
