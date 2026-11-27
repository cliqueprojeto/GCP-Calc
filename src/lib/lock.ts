/**
 * Bloqueio do app por senha: a senha nunca é guardada, só um hash PBKDF2 (SHA-256) com sal.
 * O código de recuperação (gerado na criação) também é guardado só como hash.
 * No celular, a digital/biometria do aparelho pode desbloquear.
 */
import { isMobile, isTauri } from './platform';

export interface LockConfig {
  enabled: boolean;
  salt: string;
  hash: string;
  rsalt: string;
  rhash: string;
  biometric?: boolean;
  /** bloquear de novo depois de N minutos fora do app (0 = só ao abrir) */
  autoLockMin?: number;
}

const ITER = 210_000;
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function derive(secret: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: ITER }, key, 256);
  return b64(new Uint8Array(bits));
}

/** código de recuperação legível: XXXX-XXXX-XXXX-XXXX (sem letras parecidas) */
export function newRecoveryCode(): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = rnd(16);
  return Array.from(r, (x) => A[x % A.length])
    .join('')
    .replace(/(.{4})(?=.)/g, '$1-');
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function createLock(password: string, code: string, prev?: Partial<LockConfig>): Promise<LockConfig> {
  const salt = b64(rnd(16));
  const rsalt = b64(rnd(16));
  return { enabled: true, biometric: prev?.biometric ?? false, autoLockMin: prev?.autoLockMin ?? 0, salt, hash: await derive(password, salt), rsalt, rhash: await derive(normCode(code), rsalt) };
}

export async function checkPassword(cfg: LockConfig, password: string) {
  return (await derive(password, cfg.salt)) === cfg.hash;
}
export async function checkRecovery(cfg: LockConfig, code: string) {
  return (await derive(normCode(code), cfg.rsalt)) === cfg.rhash;
}

/** Celular com digital/biometria disponível? */
export async function biometricAvailable(): Promise<boolean> {
  if (!isTauri || !isMobile) return false;
  try {
    const { checkStatus } = await import('@tauri-apps/plugin-biometric');
    return (await checkStatus()).isAvailable;
  } catch {
    return false;
  }
}

export async function biometricUnlock(reason: string): Promise<boolean> {
  try {
    const { authenticate } = await import('@tauri-apps/plugin-biometric');
    await authenticate(reason, { allowDeviceCredential: true, cancelTitle: 'Cancelar' });
    return true;
  } catch {
    return false;
  }
}
