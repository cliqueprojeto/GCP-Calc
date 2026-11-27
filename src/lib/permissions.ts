/**
 * Permissões do app (microfone e notificações): pedidas juntas no primeiro uso e
 * lembradas nas configurações. No Android, a atividade nativa também pede ao abrir.
 */
import { isMobile, isTauri } from './platform';

export type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

type Native = { permission?(n: string): string; requestPermissions?(): void; permissionsPending?(): boolean; allGranted?(): boolean };
export const native = () => (window as unknown as { GcpNative?: Native }).GcpNative;

/** Android: tudo já liberado pelo sistema? */
export const nativeAllGranted = () => !!native()?.allGranted?.();

export async function micState(): Promise<PermState> {
  const n = native();
  if (n?.permission) return n.permission('mic') === 'granted' ? 'granted' : 'prompt';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const r = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return r.state as PermState;
  } catch {
    return 'prompt';
  }
}

export async function requestMic(): Promise<PermState> {
  if (isMobile && native()?.requestPermissions) return (await requestAll()).mic;
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function notifyState(): Promise<PermState> {
  if (isTauri) {
    try {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      return (await isPermissionGranted()) ? 'granted' : 'prompt';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : (Notification.permission as PermState);
}

export async function requestNotify(): Promise<PermState> {
  if (isMobile && native()?.requestPermissions) return (await requestAll()).notify;
  if (isTauri) {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      if (await isPermissionGranted()) return 'granted';
      return (await requestPermission()) === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  const r = await Notification.requestPermission();
  return r === 'default' ? 'prompt' : (r as PermState);
}

/**
 * Pede tudo de uma vez. No Android: uma única janela do sistema (microfone, câmera e
 * notificações) e o resultado vem do próprio Android — sem pedidos repetidos ou simultâneos,
 * que faziam o app fechar.
 */
export async function requestAll(): Promise<{ mic: PermState; notify: PermState }> {
  const n = native();
  if (isMobile && n?.requestPermissions) {
    if (!n.allGranted?.()) {
      n.requestPermissions();
      // espera a janela abrir e fechar (até 2 minutos)
      await new Promise((r) => setTimeout(r, 600));
      for (let i = 0; i < 240 && n.permissionsPending?.(); i++) await new Promise((r) => setTimeout(r, 500));
    }
    const st = (k: string): PermState => (n.permission?.(k) === 'granted' ? 'granted' : 'denied');
    return { mic: st('mic'), notify: st('notify') };
  }
  const notify = await requestNotify();
  const mic = await requestMic();
  return { mic, notify };
}
