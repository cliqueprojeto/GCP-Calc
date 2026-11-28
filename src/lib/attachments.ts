/** Comprovantes: fotos (câmera ou arquivo) e PDFs anexados às linhas de um bloco de cálculo. */
import type { Attachment } from './types';
import { uid } from './platform';

const MAX_SIDE = 1600;
const MAX_PDF = 6 * 1024 * 1024;

/** Abre a câmera (celular) ou o seletor de arquivos. Precisa ser chamado num clique. */
export function pickFiles(camera: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = camera ? 'image/*' : 'image/*,application/pdf';
    if (camera) i.setAttribute('capture', 'environment');
    else i.multiple = true;
    i.style.display = 'none';
    i.onchange = () => {
      resolve(Array.from(i.files ?? []));
      i.remove();
    };
    // cancelado: alguns sistemas não disparam nada; resolve vazio ao voltar o foco.
    // Da câmera a foto chega alguns segundos depois de voltar ao app: não dá como cancelado.
    if (!camera) window.addEventListener('focus', () => setTimeout(() => !i.files?.length && resolve([]), 5000), { once: true });
    document.body.appendChild(i);
    i.click();
  });
}

const readAsDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

/** Foto reduzida (até 1600 px, JPEG) para caber bem na nota e na sincronização. */
async function compressImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return { src: c.toDataURL('image/jpeg', 0.82), w, h };
}

export async function filesToAttachments(files: File[], line?: string): Promise<{ ok: Attachment[]; skipped: string[] }> {
  const ok: Attachment[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    try {
      if (f.type.startsWith('image/')) {
        const img = await compressImage(f);
        ok.push({ id: uid(), name: f.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', src: img.src, w: img.w, h: img.h, line, created: Date.now() });
      } else if (f.type === 'application/pdf' && f.size <= MAX_PDF) {
        ok.push({ id: uid(), name: f.name, mime: f.type, src: await readAsDataUrl(f), line, created: Date.now() });
      } else skipped.push(f.name);
    } catch {
      skipped.push(f.name);
    }
  }
  return { ok, skipped };
}

export function dataUrlBytes(src: string): Uint8Array {
  const bin = atob(src.split(',')[1] ?? '');
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
