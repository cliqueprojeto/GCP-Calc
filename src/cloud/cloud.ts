/**
 * Backup e sincronização criptografados no Google Drive (pasta oculta do app).
 *
 * O arquivo enviado é cifrado com a frase-senha do usuário (AES-256-GCM): o Google
 * só guarda dados ilegíveis. Mesma lógica do GCP-Neuro Notas: login OAuth com PKCE
 * por loopback, um arquivo de sincronização junto por item (o mais recente vence)
 * e backups datados com rotação.
 */
import { invoke } from '@tauri-apps/api/core';
import { isTauri, netFetch, openUrl, APP_VERSION } from '../lib/platform';
import type { CloudAccount, DataDoc } from '../lib/types';
import { useData } from '../store/data';
import { open as openSealed, seal, type Sealed } from './crypto';

const ENV = import.meta.env as Record<string, string | undefined>;

export function clientConfig() {
  const s = useData.getState().settings.cloud;
  return {
    clientId: s.googleClientId || ENV.VITE_GOOGLE_CLIENT_ID || '',
    clientSecret: s.googleClientSecret || ENV.VITE_GOOGLE_CLIENT_SECRET || '',
  };
}

export const hasBuiltInClient = () => !!ENV.VITE_GOOGLE_CLIENT_ID;

export interface CloudSnapshot {
  format: 'gcp-calc-cloud';
  version: 1;
  app: string;
  device: string;
  created: number;
  sealed: Sealed;
}

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  modified: number;
}

export const SYNC_NAME = 'GCP-Calc-sync.gcpcalc';
const BACKUP_PREFIX = 'GCP-Calc-backup-';

// ------------------------------------------------------------------ OAuth

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';

async function tokenRequest(params: Record<string, string>) {
  const res = await netFetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  return data as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

export async function connect(): Promise<CloudAccount> {
  if (!isTauri) throw new Error('desktop-only');
  const { clientId, clientSecret } = clientConfig();
  if (!clientId) throw new Error('missing-client-id');
  const port = await invoke<number>('oauth_start');
  const redirect = `http://127.0.0.1:${port}`;
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  await openUrl(`${AUTH}?${q}`);

  let url: string | null = null;
  const deadline = Date.now() + 5 * 60_000;
  while (!url && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    url = await invoke<string | null>('oauth_result', { port });
  }
  if (!url) throw new Error('timeout');
  const params = new URL(url).searchParams;
  if (params.get('error')) throw new Error(params.get('error_description') || params.get('error')!);
  if (params.get('state') !== state) throw new Error('state-mismatch');
  const code = params.get('code');
  if (!code) throw new Error('no-code');

  const body: Record<string, string> = { client_id: clientId, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' };
  if (clientSecret) body.client_secret = clientSecret;
  const tok = await tokenRequest(body);
  const account: CloudAccount = {
    provider: 'gdrive',
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in - 60) * 1000,
    connectedAt: Date.now(),
  };
  try {
    if (tok.id_token) {
      const payload = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      account.email = payload.email;
    }
  } catch {
    /* e-mail é só informativo */
  }
  saveAccount(account);
  return account;
}

function saveAccount(a: CloudAccount) {
  useData.getState().setSettings((s) => ({ cloud: { ...s.cloud, accounts: [a] } }));
}

export function disconnect() {
  useData.getState().setSettings((s) => ({ cloud: { ...s.cloud, accounts: [] } }));
}

export const account = () => useData.getState().settings.cloud.accounts[0];

async function token(): Promise<string> {
  const acc = account();
  if (!acc) throw new Error('not-connected');
  if (Date.now() < acc.expiresAt) return acc.accessToken;
  if (!acc.refreshToken) throw new Error('expired');
  const { clientId, clientSecret } = clientConfig();
  const body: Record<string, string> = { client_id: clientId, refresh_token: acc.refreshToken, grant_type: 'refresh_token' };
  if (clientSecret) body.client_secret = clientSecret;
  const tok = await tokenRequest(body);
  const next = { ...acc, accessToken: tok.access_token, refreshToken: tok.refresh_token || acc.refreshToken, expiresAt: Date.now() + (tok.expires_in - 60) * 1000 };
  saveAccount(next);
  return next.accessToken;
}

async function api(url: string, init: RequestInit = {}) {
  const t = await token();
  const res = await netFetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${t}` } });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google Drive ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}

// ------------------------------------------------------- arquivos no Drive

const GD = 'https://www.googleapis.com/drive/v3';
const GDU = 'https://www.googleapis.com/upload/drive/v3';

export async function listFiles(): Promise<CloudFile[]> {
  const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'files(id,name,size,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '200' });
  const data = await (await api(`${GD}/files?${q}`)).json();
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, size: +f.size || 0, modified: Date.parse(f.modifiedTime) }));
}

async function upload(name: string, content: string, existingId?: string): Promise<number | undefined> {
  if (existingId) {
    const r = await api(`${GDU}/files/${existingId}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content });
    return modTime(await r.json().catch(() => null));
  }
  const boundary = 'gcpcalc' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const r = await api(`${GDU}/files?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return modTime(await r.json().catch(() => null));
}

function modTime(j: any): number | undefined {
  return j?.modifiedTime ? Date.parse(j.modifiedTime) : undefined;
}

export async function download(id: string): Promise<string> {
  return (await api(`${GD}/files/${id}?alt=media`)).text();
}

export async function removeFile(id: string) {
  await api(`${GD}/files/${id}`, { method: 'DELETE' });
}

// --------------------------------------------------------- backup e sync

function deviceName() {
  const ua = navigator.userAgent;
  return /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Linux';
}

export function passphrase(): string {
  const p = useData.getState().settings.cloud.passphrase;
  if (!p) throw new Error('no-passphrase');
  return p;
}

export async function makeSnapshot(pass = passphrase()): Promise<CloudSnapshot> {
  const doc = useData.getState().exportDoc();
  return { format: 'gcp-calc-cloud', version: 1, app: APP_VERSION, device: deviceName(), created: Date.now(), sealed: await seal(pass, JSON.stringify(doc)) };
}

export async function openSnapshot(text: string, pass = passphrase()): Promise<DataDoc> {
  const s = JSON.parse(text) as CloudSnapshot;
  if (s.format !== 'gcp-calc-cloud') throw new Error('invalid-format');
  return JSON.parse(await openSealed(pass, s.sealed)) as DataDoc;
}

function stamp() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}`;
}

export async function backupNow() {
  const snap = await makeSnapshot();
  await upload(`${BACKUP_PREFIX}${stamp()}.gcpcalc`, JSON.stringify(snap));
  const keep = useData.getState().settings.cloud.keep || 10;
  const files = (await listFiles()).filter((f) => f.name.startsWith(BACKUP_PREFIX));
  for (const f of files.slice(keep)) await removeFile(f.id).catch(() => undefined);
  useData.getState().setSettings((s) => ({ cloud: { ...s.cloud, lastBackup: Date.now() } }));
}

export async function listBackups() {
  return (await listFiles()).filter((f) => f.name.startsWith(BACKUP_PREFIX) || f.name === SYNC_NAME);
}

/** Restaura um backup: substitui os dados locais (o atual vira backup antes). */
export async function restoreBackup(id: string, pass?: string) {
  const doc = await openSnapshot(await download(id), pass);
  useData.getState().importDoc(doc, 'replace');
}

export interface SyncResult {
  pulled: number;
  pushed: boolean;
  remoteModified?: number;
}

/**
 * Sincroniza: baixa o arquivo de sincronização (se mudou desde `known`), junta item a item
 * (a versão mais recente vence) e envia de volta só se este aparelho tiver algo novo.
 */
export async function syncNow(opts: { known?: number; localChanged?: boolean } = {}): Promise<SyncResult> {
  const files = await listFiles();
  const existing = files.find((f) => f.name === SYNC_NAME);
  let pulled = 0;
  let ahead = !existing || opts.known === undefined || !!opts.localChanged;
  if (existing && existing.modified !== opts.known) {
    const remote = await openSnapshot(await download(existing.id));
    const r = useData.getState().mergeRemote(remote);
    pulled = r.pulled;
    ahead = r.ahead || !!opts.localChanged;
  }
  let remoteModified = existing?.modified;
  if (ahead) {
    const snap = await makeSnapshot();
    remoteModified = (await upload(SYNC_NAME, JSON.stringify(snap), existing?.id)) ?? Date.now();
  }
  useData.getState().setSettings((s) => ({ cloud: { ...s.cloud, lastSync: Date.now() } }));
  return { pulled, pushed: ahead, remoteModified };
}

/** Confere se a frase-senha abre o arquivo de sincronização já existente (aparelho novo). */
export async function verifyPassphraseAgainstCloud(pass: string): Promise<'ok' | 'wrong' | 'empty'> {
  const existing = (await listFiles()).find((f) => f.name === SYNC_NAME);
  if (!existing) return 'empty';
  try {
    await openSnapshot(await download(existing.id), pass);
    return 'ok';
  } catch {
    return 'wrong';
  }
}

export async function autoBackupIfDue() {
  const s = useData.getState().settings.cloud;
  if (!s.accounts.length || !s.passphrase || s.autoBackup === 'off') return;
  const interval = s.autoBackup === 'daily' ? 86400_000 : 7 * 86400_000;
  if (Date.now() - (s.lastBackup || 0) < interval) return;
  try {
    await backupNow();
  } catch (e) {
    console.warn('backup automático falhou', e);
  }
}
