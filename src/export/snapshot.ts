/**
 * "Foto" exata da nota como aparece na tela (tema, fontes, gráficos), sem barras,
 * botões, menus nem o cursor do editor. Gera PNG e um PDF paginado com cortes entre blocos.
 */
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { resolveColor } from '../lib/colors';

async function capture(el: HTMLElement, scale = 2): Promise<{ canvas: HTMLCanvasElement; cuts: number[] }> {
  const bg = resolveColor(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0a1f');
  el.classList.add('capturing');
  (document.activeElement as HTMLElement | null)?.blur?.();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const top = el.getBoundingClientRect().top;
    // pontos de corte entre blocos (para paginar o PDF sem partir um bloco ao meio)
    const cuts = Array.from(el.querySelectorAll<HTMLElement>('.note-head, .block-wrap'))
      .filter((b) => b.offsetParent !== null)
      .map((b) => (b.getBoundingClientRect().bottom - top + 7) * scale);
    const canvas = await html2canvas(el, {
      backgroundColor: bg,
      scale,
      useCORS: true,
      logging: false,
      onclone: (d) => {
        // campos de texto viram texto comum com o mesmo estilo (o render de <input> corta letras)
        const win = d.defaultView!;
        d.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.note input, .note textarea:not(.calc-input)').forEach((inp) => {
          const cs = win.getComputedStyle(inp);
          const div = d.createElement('div');
          div.textContent = inp.value;
          div.className = inp.className;
          for (const k of ['font', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'color', 'textAlign', 'paddingLeft', 'paddingRight', 'paddingTop', 'flex', 'minWidth'] as const) {
            (div.style as unknown as Record<string, string>)[k] = cs[k] as string;
          }
          div.style.width = cs.width;
          div.style.lineHeight = '1.3';
          div.style.whiteSpace = 'pre-wrap';
          div.style.overflow = 'visible';
          div.style.background = 'transparent';
          div.style.border = '0';
          inp.replaceWith(div);
        });
        // libera a área com rolagem para a nota inteira entrar na imagem
        for (const sel of ['html', 'body', '#root', '.app', '.main', '.content']) {
          const n = d.querySelector<HTMLElement>(sel);
          if (n) {
            n.style.overflow = 'visible';
            n.style.height = 'auto';
          }
        }
      },
    });
    return { canvas, cuts };
  } finally {
    el.classList.remove('capturing');
  }
}

const toBytes = (canvas: HTMLCanvasElement): Promise<Uint8Array> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('png'))), 'image/png'),
  );

export async function snapshotPng(el: HTMLElement): Promise<Uint8Array> {
  const { canvas } = await capture(el, 2);
  return toBytes(canvas);
}

export async function snapshotPdf(el: HTMLElement, title: string): Promise<Uint8Array> {
  const { canvas, cuts } = await capture(el, 2);
  const bgHex = resolveColor(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0a1f');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title, creator: 'GCP-Calc' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 18;
  const k = (PW - M * 2) / canvas.width; // pt por pixel da imagem
  const avail = (PH - M * 2) / k; // altura útil da página, em pixels
  const [r, g, b] = (bgHex.replace('#', '').match(/.{2}/g) || ['00', '00', '00']).map((x) => parseInt(x, 16));
  let start = 0;
  let first = true;
  while (start < canvas.height - 2) {
    let end = Math.min(canvas.height, start + avail);
    if (end < canvas.height) {
      // corta no fim do último bloco que cabe (desde que use ao menos 35% da página)
      const ok = cuts.filter((c) => c > start + avail * 0.35 && c <= end);
      if (ok.length) end = Math.max(...ok);
    }
    const h = Math.ceil(end - start);
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, part.width, h);
    ctx.drawImage(canvas, 0, start, canvas.width, h, 0, 0, canvas.width, h);
    if (!first) doc.addPage();
    first = false;
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, PW, PH, 'F');
    doc.addImage(part.toDataURL('image/png'), 'PNG', M, M, PW - M * 2, h * k, undefined, 'FAST');
    start = end;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
