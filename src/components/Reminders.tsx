/** Lembretes de contas e compromissos: calendário, lista por situação, formulário e central de notificações. */
import { useMemo, useState } from 'react';
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Repeat as RepeatIcon,
  Trash2,
  TriangleAlert,
  ExternalLink,
} from 'lucide-react';
import type { InboxItem, Note, Reminder, Repeat } from '../lib/types';
import { useData } from '../store/data';
import { toast, useUi } from '../store/ui';
import { useEvalContext, formatOptions } from '../lib/calcContext';
import { evaluateLine, newDocState } from '../engine/evaluate';
import { fold } from '../engine/units';
import { formatValue, add, type EvalContext, type FormatOptions, type Value } from '../engine/value';
import { evaluateNote } from '../lib/noteEval';
import { isIncome, markPaid, occurrences, snooze, startOfDay, statusOf, type ReminderStatus } from '../lib/reminders';
import { uid } from '../lib/platform';
import { NoteIcon } from '../lib/icons';
import { Field, Menu, MenuItem, Modal, Select } from './ui';
import { useLang, useT, LOCALES } from '../i18n';

const DAY = 86400_000;

export function amountValue(r: Pick<Reminder, 'amount'>, ctx: EvalContext): Value | undefined {
  if (!r.amount?.trim()) return undefined;
  const res = evaluateLine(r.amount, ctx, newDocState());
  return res.kind === 'value' ? res.value : undefined;
}
export function amountText(r: Pick<Reminder, 'amount'>, ctx: EvalContext, fmt: FormatOptions): string | undefined {
  const v = amountValue(r, ctx);
  return v ? formatValue(v, fmt) : r.amount?.trim() || undefined;
}

/** Vencimentos escritos nas notas ("Luz: R$ 150 vence 10/12") que ainda não viraram lembrete. */
export function dueFromNotes(notes: Note[], reminders: Reminder[], ctx: EvalContext) {
  const fmt = formatOptions(ctx);
  const have = new Set(reminders.filter((r) => !r.deleted).map((r) => `${r.noteId}|${fold(r.title)}`));
  const out: { noteId: string; noteTitle: string; title: string; amount?: string; due: number; monthly: boolean }[] = [];
  for (const n of notes) {
    if (n.deleted) continue;
    if (!n.blocks.some((b) => b.type === 'calc' && /venc|due|vto/i.test(b.text))) continue;
    const ev = evaluateNote(n, ctx, fmt);
    for (const [, { results }] of ev.perBlock)
      for (const r of results) {
        if (!r.due || !r.label) continue;
        if (have.has(`${n.id}|${fold(r.label)}`)) continue;
        out.push({ noteId: n.id, noteTitle: n.title, title: r.label, amount: r.value ? formatValue(r.value, fmt) : undefined, due: r.due.at, monthly: r.due.monthly });
      }
  }
  return out.sort((a, b) => a.due - b.due);
}

const toDateInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toTimeInput = (t: number) => {
  const d = new Date(t);
  return d.getHours() || d.getMinutes() ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
};

export function ReminderForm({ initial, onClose }: { initial: Partial<Reminder> | null; onClose(): void }) {
  const t = useT();
  const { notes, saveReminder, deleteReminder } = useData();
  const ctx = useEvalContext();
  const fmt = formatOptions(ctx);
  const [v, setV] = useState(() => ({
    title: initial?.title ?? '',
    amount: initial?.amount ?? '',
    date: toDateInput(initial?.due ?? startOfDay(Date.now() + DAY)),
    time: initial?.due ? toTimeInput(initial.due) : '',
    repeat: (initial?.repeat ?? 'monthly') as Repeat,
    alertDays: initial?.alertDays ?? 2,
    noteId: initial?.noteId ?? '',
    kind: (initial?.kind ?? (initial?.title && isIncome({ title: initial.title }) ? 'income' : 'expense')) as 'income' | 'expense',
  }));
  if (!initial) return null;
  const preview = amountText({ amount: v.amount }, ctx, fmt);
  const save = () => {
    const [y, m, d] = v.date.split('-').map(Number);
    const [hh, mm] = v.time ? v.time.split(':').map(Number) : [0, 0];
    const due = new Date(y, m - 1, d, hh, mm).getTime();
    saveReminder({
      id: initial.id ?? uid(),
      title: v.title.trim(),
      amount: v.amount.trim() || undefined,
      due,
      repeat: v.repeat,
      alertDays: v.alertDays,
      noteId: v.noteId || undefined,
      blockId: v.noteId === initial.noteId ? initial.blockId : undefined,
      kind: v.kind,
      paid: initial.paid,
      archived: initial.archived,
    });
    toast(t('rem.saved'), 'ok');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial.id ? t('rem.edit') : t('rem.new')}>
      <div className="rem-form">
        <Field label={t('rem.title')}>
          <input className="input" autoFocus value={v.title} placeholder={t('rem.titlePh')} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label={t('rem.kind')}>
          <div className="seg">
            <button className={v.kind === 'expense' ? 'on tone-expense' : ''} onClick={() => setV({ ...v, kind: 'expense' })}>
              {t('rem.kindExpense')}
            </button>
            <button className={v.kind === 'income' ? 'on tone-income' : ''} onClick={() => setV({ ...v, kind: 'income' })}>
              {t('rem.kindIncome')}
            </button>
          </div>
        </Field>
        <Field label={t('rem.amount')} hint={preview && v.amount.trim() !== preview ? `= ${preview}` : undefined}>
          <input className="input mono" value={v.amount} placeholder="R$ 150,00" onChange={(e) => setV({ ...v, amount: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label={t('rem.date')}>
            <input className="input" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          </Field>
          <Field label={t('rem.time')}>
            <input className="input" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
          </Field>
        </div>
        <div className="grid2">
          <Field label={t('rem.repeat')}>
            <Select
              value={v.repeat}
              onChange={(repeat) => setV({ ...v, repeat })}
              options={(['none', 'weekly', 'monthly', 'yearly'] as Repeat[]).map((r) => ({ value: r, label: t(`rem.rep.${r}`) }))}
            />
          </Field>
          <Field label={t('rem.alert')}>
            <Select value={v.alertDays} onChange={(alertDays) => setV({ ...v, alertDays })} options={[0, 1, 2, 3, 5, 7, 15].map((n) => ({ value: n, label: n ? t('rem.daysBefore', { n }) : t('rem.onlyOnDay') }))} />
          </Field>
        </div>
        <Field label={t('rem.note')} hint={v.noteId ? t('rem.linkHint') : undefined}>
          <Select
            value={v.noteId}
            onChange={(noteId) => setV({ ...v, noteId })}
            options={[{ value: '', label: t('rem.noNote') }, ...notes.filter((n) => !n.deleted).map((n) => ({ value: n.id, label: n.title || t('note.untitled') }))]}
          />
        </Field>
      </div>
      <div className="btn-row">
        {initial.id && (
          <button
            className="btn danger-text"
            onClick={() => {
              deleteReminder(initial.id!);
              onClose();
            }}
          >
            <Trash2 size={15} /> {t('rem.delete')}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
        <button className="btn primary" disabled={!v.title.trim() || !v.date} onClick={save}>
          {t('common.save')}
        </button>
      </div>
    </Modal>
  );
}

function Calendar({ reminders, month, setMonth, selected, onSelect }: { reminders: Reminder[]; month: Date; setMonth(d: Date): void; selected?: number; onSelect(d: number | undefined): void }) {
  const lang = useLang();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = startOfDay(first.getTime() - ((first.getDay() + 6) % 7) * DAY); // semana começa na segunda
  const days = Array.from({ length: 42 }, (_, i) => startOfDay(start + i * DAY + 3600_000 * 3));
  const end = days[41] + DAY;
  const byDay = new Map<number, { r: Reminder; st: ReminderStatus }[]>();
  for (const r of reminders) {
    if (r.deleted || r.archived) continue;
    for (const o of occurrences(r, start, end)) {
      const k = startOfDay(o);
      const paid = r.paid?.includes(o) || (r.repeat !== 'none' && o < r.due);
      const st: ReminderStatus = paid ? 'done' : statusOf({ ...r, due: o });
      byDay.set(k, [...(byDay.get(k) ?? []), { r, st }]);
    }
  }
  const today = startOfDay(Date.now());
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(LOCALES[lang], { weekday: 'short' }).replace('.', ''));
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={16} />
        </button>
        <b>{month.toLocaleDateString(LOCALES[lang], { month: 'long', year: 'numeric' })}</b>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="cal-grid">
        {wd.map((w) => (
          <div key={w} className="cal-wd">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const out = new Date(d).getMonth() !== month.getMonth();
          return (
            <button key={d} className={`cal-day ${out ? 'out' : ''} ${d === today ? 'today' : ''} ${selected === d ? 'sel' : ''}`} onClick={() => onSelect(selected === d ? undefined : d)}>
              <span>{new Date(d).getDate()}</span>
              <div className="cal-dots">
                {items.slice(0, 4).map((x, i) => (
                  <i key={i} className={`st-${x.st}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pago ou recebido: marca, lança o valor na nota ligada e avisa. */
export function payReminder(r: Reminder, ctx: EvalContext, fmt: FormatOptions, t: ReturnType<typeof useT>) {
  const income = isIncome(r);
  const posted = markPaid(r, amountText(r, ctx, fmt));
  toast(posted ? `${t(income ? 'rem.receivedToast' : 'rem.paidToast')} · ${t('rem.postedTo', { note: posted })}` : t(income ? 'rem.receivedToast' : 'rem.paidToast'), 'ok');
}

function sumOf(list: Reminder[], ctx: EvalContext): Value | undefined {
  let acc: Value | undefined;
  for (const r of list) {
    const v = amountValue(r, ctx);
    if (!v) continue;
    try {
      acc = acc ? add(acc, v, 1, ctx) : v;
    } catch {
      /* moedas sem cotação */
    }
  }
  return acc;
}

export function RemindersPage() {
  const t = useT();
  const lang = useLang();
  const { reminders, notes, saveReminder, patchReminder } = useData();
  const { go } = useUi();
  const ctx = useEvalContext();
  const fmt = formatOptions(ctx);
  const [editing, setEditing] = useState<Partial<Reminder> | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState<number | undefined>();
  const [showDone, setShowDone] = useState(false);
  const active = reminders.filter((r) => !r.deleted);
  const found = useMemo(() => dueFromNotes(notes, reminders, ctx), [notes, reminders, ctx]);

  const groups: Record<ReminderStatus, Reminder[]> = { overdue: [], today: [], soon: [], later: [], done: [] };
  for (const r of active) groups[statusOf(r)].push(r);
  for (const k of Object.keys(groups) as ReminderStatus[]) groups[k].sort((a, b) => a.due - b.due);
  const dayList = day !== undefined ? active.filter((r) => occurrences(r, day, day + DAY).length) : null;
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const monthOpen = active.filter((r) => !r.archived && occurrences(r, month.getTime(), monthEnd).some((o) => !(r.paid?.includes(o) || (r.repeat !== 'none' && o < r.due))));
  const toPay = (l: Reminder[]) => l.filter((r) => !isIncome(r));
  const overdueSum = sumOf(toPay(groups.overdue), ctx);
  const monthSum = sumOf(toPay(monthOpen), ctx);
  const monthIncome = sumOf(monthOpen.filter(isIncome), ctx);

  const Row = ({ r }: { r: Reminder }) => {
    const st = statusOf(r);
    const note = r.noteId ? notes.find((n) => n.id === r.noteId && !n.deleted) : undefined;
    const amt = amountText(r, ctx, fmt);
    return (
      <div className={`rem-row st-${st}`}>
        <span className="rem-dot" />
        <div className="rem-main">
          <div className="rem-title">
            {r.title}
            {r.repeat !== 'none' && <RepeatIcon size={12} className="muted" />}
          </div>
          <div className="rem-sub">
            <CalendarClock size={12} /> {new Date(r.due).toLocaleDateString(LOCALES[lang], { weekday: 'short', day: '2-digit', month: 'short' })}
            {new Date(r.due).getHours() ? ` · ${new Date(r.due).toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })}` : ''}
            {note && (
              <button className="link" onClick={() => go({ kind: 'note', id: note.id })}>
                <NoteIcon name={note.icon} size={12} /> {note.title || t('note.untitled')}
              </button>
            )}
          </div>
        </div>
        {amt && <div className={`rem-amt ${isIncome(r) ? 'tone-income' : ''}`}>{isIncome(r) ? '+' : ''}{amt}</div>}
        <div className="rem-actions">
          {st !== 'done' && (
            <button className={`btn small ${isIncome(r) ? 'tone-income' : ''}`} onClick={() => payReminder(r, ctx, fmt, t)} title={t(isIncome(r) ? 'rem.markReceived' : 'rem.markPaid')}>
              <Check size={14} /> <span className="hide-sm">{t(isIncome(r) ? 'rem.received' : 'rem.paid')}</span>
            </button>
          )}
          <Menu
            button={(toggle) => (
              <button className="icon-btn" onClick={toggle} title={t('common.more')}>
                <Pencil size={14} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<Pencil size={15} />} onClick={() => (setEditing(r), close())}>
                  {t('rem.edit')}
                </MenuItem>
                {st !== 'done' && (
                  <>
                    <MenuItem icon={<AlarmClock size={15} />} onClick={() => (snooze(r, 1), close())}>
                      {t('rem.snooze1')}
                    </MenuItem>
                    <MenuItem icon={<AlarmClock size={15} />} onClick={() => (snooze(r, 7), close())}>
                      {t('rem.snooze7')}
                    </MenuItem>
                  </>
                )}
                <MenuItem icon={r.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={() => (patchReminder(r.id, { archived: !r.archived }), close())}>
                  {r.archived ? t('rem.unarchive') : t('rem.archive')}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    );
  };

  const Section = ({ k, icon }: { k: ReminderStatus; icon: JSX.Element }) =>
    groups[k].length ? (
      <section className={`rem-sec sec-${k}`}>
        <h3 className="sec-title">
          {icon} {t(`rem.st.${k}`)} <span className="badge">{groups[k].length}</span>
        </h3>
        {groups[k].map((r) => (
          <Row key={r.id} r={r} />
        ))}
      </section>
    ) : null;

  return (
    <div className="page reminders">
      <div className="page-head">
        <BellRing size={22} />
        <div style={{ flex: 1 }}>
          <h1>{t('rem.page')}</h1>
          <p>{t('rem.subtitle')}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={15} /> {t('rem.new')}
        </button>
      </div>

      <div className="rem-kpis">
        <div className={`kpi ${toPay(groups.overdue).length ? 'bad' : ''}`}>
          <span>{t('rem.st.overdue')}</span>
          <b>{toPay(groups.overdue).length}</b>
          <small>{overdueSum ? formatValue(overdueSum, fmt) : '—'}</small>
        </div>
        <div className="kpi">
          <span>{t('rem.kpiWeek')}</span>
          <b>{toPay([...groups.today, ...groups.soon]).length}</b>
          <small>{sumOf(toPay([...groups.today, ...groups.soon]), ctx) ? formatValue(sumOf(toPay([...groups.today, ...groups.soon]), ctx)!, fmt) : '—'}</small>
        </div>
        <div className="kpi">
          <span>{t('rem.kpiMonth', { month: month.toLocaleDateString(LOCALES[lang], { month: 'long' }) })}</span>
          <b>{toPay(monthOpen).length}</b>
          <small>{monthSum ? formatValue(monthSum, fmt) : '—'}</small>
        </div>
        {monthIncome && (
          <div className="kpi good">
            <span>{t('rem.toReceive')}</span>
            <b>{monthOpen.filter(isIncome).length}</b>
            <small className="tone-income">+{formatValue(monthIncome, fmt)}</small>
          </div>
        )}
      </div>

      <div className="rem-layout">
        <div>
          <Calendar reminders={active} month={month} setMonth={setMonth} selected={day} onSelect={setDay} />
          {found.length > 0 && (
            <div className="rem-found">
              <h3 className="sec-title">
                <CalendarDays size={15} /> {t('rem.found')}
              </h3>
              <p className="muted small">{t('rem.foundHint')}</p>
              {found.slice(0, 12).map((f, i) => (
                <div key={i} className="rem-row found">
                  <div className="rem-main">
                    <div className="rem-title">{f.title}</div>
                    <div className="rem-sub">
                      {new Date(f.due).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: 'short' })} · {f.noteTitle || t('note.untitled')}
                    </div>
                  </div>
                  {f.amount && <div className="rem-amt">{f.amount}</div>}
                  <button
                    className="btn small"
                    onClick={() => {
                      saveReminder({ id: uid(), title: f.title, amount: f.amount, due: f.due, repeat: f.monthly ? 'monthly' : 'none', alertDays: 2, noteId: f.noteId });
                      toast(t('rem.saved'), 'ok');
                    }}
                  >
                    <Plus size={14} /> {t('rem.create')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rem-lists">
          {dayList ? (
            <section className="rem-sec">
              <h3 className="sec-title">
                <CalendarDays size={15} /> {new Date(day!).toLocaleDateString(LOCALES[lang], { weekday: 'long', day: '2-digit', month: 'long' })}
                <button className="link" onClick={() => setDay(undefined)}>
                  {t('rem.allDays')}
                </button>
              </h3>
              {dayList.length ? dayList.map((r) => <Row key={r.id} r={r} />) : <p className="muted">{t('rem.nothingDay')}</p>}
              <button className="btn small" onClick={() => setEditing({ due: day })}>
                <Plus size={14} /> {t('rem.newOnDay')}
              </button>
            </section>
          ) : active.length ? (
            <>
              <Section k="overdue" icon={<TriangleAlert size={15} />} />
              <Section k="today" icon={<BellRing size={15} />} />
              <Section k="soon" icon={<Clock size={15} />} />
              <Section k="later" icon={<CalendarClock size={15} />} />
              {groups.done.length > 0 && (
                <button className="link rem-done-toggle" onClick={() => setShowDone(!showDone)}>
                  <CheckCheck size={14} /> {t('rem.st.done')} ({groups.done.length})
                </button>
              )}
              {showDone && groups.done.map((r) => <Row key={r.id} r={r} />)}
            </>
          ) : (
            <div className="rem-empty">
              <Bell size={28} />
              <p>{t('rem.empty')}</p>
              <pre>{t('rem.emptyExample')}</pre>
            </div>
          )}
        </div>
      </div>
      {editing && <ReminderForm key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ------------------------------------------------------------ central de notificações

export function useUnread() {
  const inbox = useData((s) => s.inbox);
  return inbox.filter((x) => !x.read && !x.archived && !x.deleted).length;
}

const relTime = (t: number, lang: string) => {
  const diff = (t - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const a = Math.abs(diff);
  if (a < 60) return rtf.format(Math.round(diff), 'second');
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
};

export function InboxPanel({ onClose }: { onClose(): void }) {
  const t = useT();
  const lang = useLang();
  const { inbox, reminders, patchInbox } = useData();
  const { go } = useUi();
  const ctx = useEvalContext();
  const fmt = formatOptions(ctx);
  const [tab, setTab] = useState<'unread' | 'all' | 'archived'>('unread');
  const list = inbox
    .filter((x) => !x.deleted && (tab === 'archived' ? x.archived : !x.archived && (tab === 'all' || !x.read)))
    .sort((a, b) => b.at - a.at);
  const unread = inbox.filter((x) => !x.read && !x.archived && !x.deleted);
  const counts = { unread: unread.length, all: inbox.filter((x) => !x.archived && !x.deleted).length, archived: inbox.filter((x) => x.archived && !x.deleted).length };
  const open = (x: InboxItem) => {
    patchInbox([x.id], { read: true });
    if (x.noteId) go({ kind: 'note', id: x.noteId });
    else go({ kind: 'reminders' });
    onClose();
  };
  return (
    <div className="inbox">
      <div className="inbox-head">
        <b>{t('inbox.title')}</b>
        <div className="seg small">
          {(['unread', 'all', 'archived'] as const).map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {t(`inbox.${k}`)} {counts[k] > 0 && <span className="cnt">{counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="inbox-list">
        {!list.length && <p className="inbox-empty">{t(tab === 'unread' ? 'inbox.emptyUnread' : 'inbox.empty')}</p>}
        {list.map((x) => {
          const r = x.reminderId ? reminders.find((y) => y.id === x.reminderId && !y.deleted) : undefined;
          const canPay = r && statusOf(r) !== 'done' && x.id.includes(`:${r.due}:`);
          return (
            <div key={x.id} className={`inbox-item k-${x.kind} ${x.read ? 'read' : ''}`}>
              <button className="inbox-body" onClick={() => open(x)}>
                <span className="inbox-ico">{x.kind === 'overdue' ? <TriangleAlert size={15} /> : x.kind === 'before' ? <Clock size={15} /> : <BellRing size={15} />}</span>
                <span>
                  <b>{x.title}</b>
                  <small>{x.body}</small>
                  <em>{relTime(x.at, LOCALES[lang])}</em>
                </span>
              </button>
              <div className="inbox-actions">
                {canPay && (
                  <button className="icon-btn" title={t(isIncome(r!) ? 'rem.markReceived' : 'rem.markPaid')} onClick={() => payReminder(r!, ctx, fmt, t)}>
                    <Check size={14} />
                  </button>
                )}
                <button className="icon-btn" title={x.read ? t('inbox.markUnread') : t('inbox.markRead')} onClick={() => patchInbox([x.id], { read: !x.read })}>
                  {x.read ? <Bell size={14} /> : <CheckCheck size={14} />}
                </button>
                <button className="icon-btn" title={x.archived ? t('rem.unarchive') : t('rem.archive')} onClick={() => patchInbox([x.id], { archived: !x.archived, read: true })}>
                  {x.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="inbox-foot">
        <button className="link" disabled={!unread.length} onClick={() => patchInbox(unread.map((x) => x.id), { read: true })}>
          <CheckCheck size={14} /> {t('inbox.readAll')}
        </button>
        <button
          className="link"
          onClick={() => {
            go({ kind: 'reminders' });
            onClose();
          }}
        >
          <ExternalLink size={13} /> {t('rem.page')}
        </button>
      </div>
    </div>
  );
}
