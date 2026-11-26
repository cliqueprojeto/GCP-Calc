/**
 * Ponte com o sistema. No aplicativo instalado usa o núcleo nativo (Tauri);
 * no navegador (modo demonstração/desenvolvimento) usa localStorage e APIs web.
 */
import { invoke } from '@tauri-apps/api/core';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
/** App instalado em computador (onde existe o atualizador interno). */
export const isDesktop = isTauri && !isMobile;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

// ------------------------------------------------------------ armazenamento

const WEB_PREFIX = 'gcp-calc:';

/** Lê um documento JSON salvo (arquivo no app instalado, localStorage no navegador). */
export async function loadDoc<T>(name: string): Promise<T | null> {
  try {
    if (isTauri) {
      const txt = await invoke<string | null>('data_load', { name });
      return txt ? (JSON.parse(txt) as T) : null;
    }
    const txt = localStorage.getItem(WEB_PREFIX + name);
    return txt ? (JSON.parse(txt) as T) : null;
  } catch (e) {
    console.warn('loadDoc', name, e);
    return null;
  }
}

/** Grava um documento JSON (gravação atômica no app instalado). */
export async function saveDoc(name: string, data: unknown): Promise<void> {
  const txt = JSON.stringify(data);
  if (isTauri) await invoke('data_save', { name, contents: txt });
  else localStorage.setItem(WEB_PREFIX + name, txt);
}

// ------------------------------------------------------------------ rede

/** fetch sem bloqueio de CORS no app (via núcleo nativo); fetch comum no navegador. */
export async function netFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri) {
    const { fetch: tfetch } = await import('@tauri-apps/plugin-http');
    return tfetch(input, init);
  }
  return fetch(input, init);
}

export async function openUrl(url: string) {
  if (isTauri) {
    const { openUrl: o } = await import('@tauri-apps/plugin-opener');
    await o(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

// --------------------------------------------------------------- arquivos

export interface FileFilter {
  name: string;
  extensions: string[];
}

export async function saveTextFile(defaultName: string, contents: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return null;
    if (isMobile) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, contents);
    } else await invoke('write_text_file', { path, contents });
    return path;
  }
  const blob = new Blob([contents], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return defaultName;
}

/** Salva bytes (PDF, DOCX, PPTX, XLSX) em arquivo escolhido pelo usuário. */
export async function saveBinaryFile(defaultName: string, bytes: Uint8Array, filters: FileFilter[], mime = 'application/octet-stream'): Promise<string | null> {
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return null;
    if (isMobile) {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      await writeFile(path, bytes);
    } else {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await invoke('write_binary_file', { path, base64Data: btoa(s) });
    }
    return path;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return defaultName;
}

export interface PickedFile {
  name: string;
  text: string;
}

export async function pickTextFile(filters: FileFilter[]): Promise<PickedFile | null> {
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const sel = await open({ multiple: false, filters });
    if (!sel || Array.isArray(sel)) return null;
    const text = isMobile ? await (await import('@tauri-apps/plugin-fs')).readTextFile(sel) : await invoke<string>('read_text_file', { path: sel });
    return { name: sel.split(/[\\/]/).pop() || sel, text };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => '.' + e)).join(',');
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

/** Escolhe uma imagem e devolve data URL já reduzida. */
export function pickImage(maxSize = 1400): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      fileToDataUrl(f, maxSize).then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export function fileToDataUrl(file: File, maxSize = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') return resolve(src);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 300_000) return resolve(src);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// --------------------------------------------------------------- sistema

export interface PlatformInfo {
  os: string;
  arch: string;
  package: string;
  version: string;
  data_dir: string;
}

export async function platformInfo(): Promise<PlatformInfo> {
  if (isTauri) return invoke<PlatformInfo>('platform_info');
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'android' : /iPhone|iPad/.test(ua) ? 'ios' : /Windows/.test(ua) ? 'windows' : /Mac/.test(ua) ? 'macos' : 'linux';
  return { os, arch: 'x86_64', package: '', version: APP_VERSION, data_dir: 'localStorage' };
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
