/** Notificações do sistema (desktop e Android) com reserva para o navegador. */
import { isMobile, isTauri } from './platform';

/** id numérico estável (32 bits) a partir de um texto */
export function numId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export async function systemNotify(title: string, body: string, key?: string) {
  try {
    if (isTauri) {
      const { sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      if (!(await isPermissionGranted())) return false;
      sendNotification({ id: key ? numId(key) : undefined, title, body });
      return true;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, tag: key, icon: '/logo.svg' });
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
