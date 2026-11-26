/**
 * Criptografia dos arquivos enviados à nuvem (AES-256-GCM, chave PBKDF2-SHA256).
 * A frase-senha fica só nos aparelhos; o Google Drive recebe apenas dados cifrados.
 */

const ITER = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Sealed {
  format: 'gcp-calc-sealed';
  v: 1;
  kdf: { alg: 'PBKDF2-SHA256'; iter: number; salt: string };
  iv: string;
  data: string;
  /** primeiros bytes do hash da chave: confere a senha sem tentar abrir tudo */
  check: string;
}

const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const keyCache = new Map<string, Promise<CryptoKey>>();

function deriveKey(pass: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const id = `${pass}\u0000${b64(salt)}\u0000${iter}`;
  let p = keyCache.get(id);
  if (!p) {
    p = (async () => {
      const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    })();
    keyCache.set(id, p);
  }
  return p;
}

async function keyCheck(key: CryptoKey) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  return b64(h.subarray(0, 6));
}

export async function seal(pass: string, plain: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  return { format: 'gcp-calc-sealed', v: 1, kdf: { alg: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt) }, iv: b64(iv), data: b64(ct), check: await keyCheck(key) };
}

export class WrongPassphrase extends Error {
  constructor() {
    super('wrong-passphrase');
  }
}

export async function open(pass: string, s: Sealed): Promise<string> {
  if (s.format !== 'gcp-calc-sealed') throw new Error('invalid-format');
  const key = await deriveKey(pass, unb64(s.kdf.salt), s.kdf.iter);
  if ((await keyCheck(key)) !== s.check) throw new WrongPassphrase();
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.data));
    return dec.decode(pt);
  } catch {
    throw new WrongPassphrase();
  }
}
