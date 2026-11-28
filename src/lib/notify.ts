/** Notificações do sistema (desktop e Android) com reserva para o navegador. */
import { isMobile, isTauri } from './platform';

/** id numérico estável (32 bits) a partir de um texto */
export function numId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export interface NotifyExtra {
  /** tipo do aviso: atrasado fica na tela até a pessoa agir */
  kind?: 'before' | 'due' | 'overdue';
  /** botões (navegador/celular): marcar como pago/recebido e abrir */
  actions?: { paid: string; open: string };
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export async function systemNotify(title: string, body: string, key?: string, extra: NotifyExtra = {}) {
  try {
    if (isTauri) {
      const { sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      if (!(await isPermissionGranted())) return false;
      sendNotification({ id: key ? numId(key) : undefined, title, body });
      return true;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const opts: NotificationOptions & Record<string, unknown> = {
        body,
        tag: key,
        // PNG: o SVG não aparece nas notificações de vários sistemas
        icon: asset('icons/icon-192.png'),
        badge: asset('icons/badge-96.png'),
        lang: document.documentElement.lang || 'pt-BR',
        timestamp: Date.now(),
        renotify: !!key,
        requireInteraction: extra.kind === 'overdue',
        silent: extra.kind === 'before',
        vibrate: extra.kind === 'overdue' ? [120, 60, 120, 60, 240] : [80, 40, 80],
        data: { key, url: location.href.split('#')[0] + '#reminders' },
        actions: extra.actions ? [{ action: 'paid', title: extra.actions.paid }, { action: 'open', title: extra.actions.open }] : [],
      };
      // pelo service worker as notificações ganham botões e abrem o app ao tocar
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
      if (reg?.showNotification) await reg.showNotification(title, opts);
      else {
        delete opts.actions;
        const n = new Notification(title, opts);
        n.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('gcp-notification', { detail: { key, action: 'open' } }));
          n.close();
        };
      }
      return true;
    }
  } catch (e) {
    console.warn('notificação', e);
  }
  return false;
}

/**
 * Agenda no sistema (Android): o aviso chega mesmo com o app fechado.
 * No desktop o próprio app avisa quando está aberto (e entrega os atrasados ao abrir).
 */
export async function scheduleSystem(items: { key: string; title: string; body: string; at: number }[]) {
  if (!isTauri || !isMobile) return;
  try {
    const { sendNotification, isPermissionGranted, Schedule, pending, cancel } = await import('@tauri-apps/plugin-notification');
    if (!(await isPermissionGranted())) return;
    const want = new Map(items.filter((i) => i.at > Date.now()).map((i) => [numId(i.key), i]));
    const old = await pending().catch(() => []);
    const stale = old.map((p) => p.id).filter((id) => !want.has(id));
    if (stale.length) await cancel(stale).catch(() => undefined);
    const have = new Set(old.map((p) => p.id));
    for (const [id, i] of want) {
      if (have.has(id)) continue;
      sendNotification({ id, title: i.title, body: i.body, schedule: Schedule.at(new Date(i.at), false, true) });
    }
  } catch (e) {
    console.warn('agendamento', e);
  }
}
