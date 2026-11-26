/**
 * Lembretes de contas e compromissos: calcula os avisos (N dias antes, no dia e atrasado),
 * coloca na central de notificações, mostra a notificação do sistema e — no Android —
 * agenda os próximos avisos para chegarem mesmo com o app fechado.
 */
import type { InboxItem, Lang, Reminder, Repeat } from './types';
import { useData } from '../store/data';
import { scheduleSystem, systemNotify } from './notify';
import { LOCALES, resolveLang, translate } from '../i18n';

const DAY = 86400_000;

/** horário do aviso quando o vencimento não tem hora: 9h */
export const atNine = (t: number) => {
  const d = new Date(t);
  if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(9, 0, 0, 0);
  return d.getTime();
};

export function addRepeat(t: number, repeat: Repeat, n = 1): number {
  const d = new Date(t);
  if (repeat === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (repeat === 'monthly') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    // dia 31 em meses mais curtos: último dia do mês
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else if (repeat === 'yearly') d.setFullYear(d.getFullYear() + n);
  return d.getTime();
}

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export type ReminderStatus = 'overdue' | 'today' | 'soon' | 'later' | 'done';

export function statusOf(r: Reminder, now = Date.now()): ReminderStatus {
  if (r.archived || (r.repeat === 'none' && r.paid?.includes(r.due))) return 'done';
  const d = startOfDay(r.due);
  const today = startOfDay(now);
  if (d < today) return 'overdue';
  if (d === today) return 'today';
  if (d - today <= 7 * DAY) return 'soon';
  return 'later';
}

/** vencimentos de um lembrete dentro de um intervalo (para o calendário) */
export function occurrences(r: Reminder, from: number, to: number): number[] {
  const out: number[] = [];
  let t = r.due;
  if (r.repeat === 'none') return t >= from && t < to ? [t] : [];
  // volta até antes do intervalo (o "due" guarda o próximo vencimento em aberto)
  let guard = 0;
  while (t > from && guard++ < 500) t = addRepeat(t, r.repeat, -1);
  guard = 0;
  while (t < to && guard++ < 500) {
    if (t >= from) out.push(t);
    t = addRepeat(t, r.repeat, 1);
  }
  return out;
}

interface Alert {
  key: string;
  kind: InboxItem['kind'];
  at: number;
}

function alertsOf(r: Reminder): Alert[] {
  if (statusOf(r) === 'done') return [];
  const due = atNine(r.due);
  const out: Alert[] = [];
  if (r.alertDays > 0) out.push({ key: `${r.id}:${r.due}:before`, kind: 'before', at: atNine(startOfDay(r.due) - r.alertDays * DAY) });
  out.push({ key: `${r.id}:${r.due}:due`, kind: 'due', at: due });
  out.push({ key: `${r.id}:${r.due}:overdue`, kind: 'overdue', at: atNine(startOfDay(r.due) + DAY) });
  return out;
}

function textFor(r: Reminder, kind: InboxItem['kind'], lang: Lang, amount: string | undefined, at: number) {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v);
  const date = new Date(r.due).toLocaleDateString(LOCALES[lang], { day: '2-digit', month: 'short' });
  const what = amount ? `${r.title} · ${amount}` : r.title;
  const n = Math.max(1, Math.round((startOfDay(r.due) - startOfDay(at)) / DAY));
  if (kind === 'before') return { title: t('rem.notifBefore', { title: r.title }), body: t('rem.notifBeforeBody', { what, date, n }) };
  if (kind === 'overdue') return { title: t('rem.notifOverdue', { title: r.title }), body: t('rem.notifOverdueBody', { what, date }) };
  return { title: t('rem.notifDue', { title: r.title }), body: t('rem.notifDueBody', { what, date }) };
}

/** Confere os lembretes: cria os avisos que já venceram e agenda os próximos. */
export async function runReminders(amountOf: (r: Reminder) => string | undefined) {
  const st = useData.getState();
  const lang = resolveLang(st.settings.lang);
  const now = Date.now();
  const have = new Set(st.inbox.map((x) => x.id));
  const fresh: Omit<InboxItem, 'updated'>[] = [];
  const future: { key: string; title: string; body: string; at: number }[] = [];
  for (const r of st.reminders) {
    if (r.deleted) continue;
    const alerts = alertsOf(r);
    // mostra só o aviso mais recente que já passou (ex.: abriu o app depois do vencimento)
    const due = alerts.filter((a) => a.at <= now);
    const last = due[due.length - 1];
    if (last && !have.has(last.key)) {
      const txt = textFor(r, last.kind, lang, amountOf(r), now);
      fresh.push({ id: last.key, reminderId: r.id, noteId: r.noteId, kind: last.kind, title: txt.title, body: txt.body, at: now });
      // o aviso anterior do mesmo vencimento, se ainda não lido, deixa de contar
      const older = st.inbox.filter((x) => x.reminderId === r.id && x.id.startsWith(`${r.id}:${r.due}:`) && !x.read).map((x) => x.id);
      if (older.length) st.patchInbox(older, { read: true });
    }
    for (const a of alerts) if (a.at > now && a.at - now < 62 * DAY) future.push({ key: a.key, at: a.at, ...textFor(r, a.kind, lang, amountOf(r), a.at) });
  }
  if (fresh.length) {
    st.addInbox(fresh);
    for (const f of fresh.filter((x) => !x.read)) await systemNotify(f.title, f.body, f.id);
  }
  await scheduleSystem(future);
}

/** Pago/feito: lembretes repetidos passam para o próximo vencimento. */
export function markPaid(r: Reminder) {
  const st = useData.getState();
  const paid = [...(r.paid ?? []), r.due].slice(-36);
  if (r.repeat === 'none') st.patchReminder(r.id, { paid });
  else st.patchReminder(r.id, { paid, due: addRepeat(r.due, r.repeat) });
  // avisos desse vencimento saem da lista de não lidas
  st.patchInbox(
    st.inbox.filter((x) => x.reminderId === r.id && x.id.includes(`:${r.due}:`)).map((x) => x.id),
    { read: true },
  );
}

export function snooze(r: Reminder, days: number) {
  useData.getState().patchReminder(r.id, { due: r.due + days * DAY });
}

let timer: ReturnType<typeof setInterval> | null = null;
/** Liga a verificação periódica (a cada minuto e ao voltar para o app). */
export function startReminderLoop(amountOf: (r: Reminder) => string | undefined) {
  if (timer) return;
  const tick = () => void runReminders(amountOf);
  setTimeout(tick, 1500);
  timer = setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
}
