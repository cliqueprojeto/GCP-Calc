/**
 * PDF com o visual da tela e texto selecionável: fundo e cartões do tema atual,
 * sintaxe colorida, coluna de resultados, gráficos com as mesmas cores, destaques,
 * metas, cotações e imagens. Fontes Inter e JetBrains Mono embutidas.
 */
import { jsPDF } from 'jspdf';
import interRegular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import interSemi from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?url';
import interBold from '@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf?url';
import monoRegular from '@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf?url';
import monoBold from '@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf?url';
import { mix } from '../lib/colors';
import { XT, docStyle, imageType, type XDoc, type XLine } from './model';

async function fontB64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

let fontCache: Promise<string[]> | null = null;
const loadFonts = () => (fontCache ??= Promise.all([interRegular, interSemi, interBold, monoRegular, monoBold].map(fontB64)));

const rgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '').match(/.{2}/g) || ['00', '00', '00'];
  return m.map((x) => parseInt(x, 16)) as [number, number, number];
};

export async function exportPdf(x: XDoc): Promise<Uint8Array> {
  const [ir, is, ib, mr, mb] = await loadFonts();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const fonts: [string, string, string, string][] = [
    ['Inter-Regular.ttf', ir, 'Inter', 'normal'],
    ['Inter-SemiBold.ttf', is, 'Inter', 'semibold'],
    ['Inter-Bold.ttf', ib, 'Inter', 'bold'],
    ['Mono-Regular.ttf', mr, 'Mono', 'normal'],
    ['Mono-Bold.ttf', mb, 'Mono', 'bold'],
  ];
  for (const [file, data, name, style] of fonts) {
    doc.addFileToVFS(file, data);
    doc.addFont(file, name, style);
  }
  doc.setProperties({ title: x.title, creator: 'GCP-Calc', author: 'GCP-Calc' });

  const S = docStyle(x.pal);
  const T = XT[x.lang];
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 40;
  const CW = PW - M * 2;
  const BOTTOM = PH - 46;
  const PAD = 14;
  let y = M;

  const color = (hex: string) => doc.setTextColor(...rgb(hex));
  const fill = (hex: string) => doc.setFillColor(...rgb(hex));
  const draw = (hex: string) => doc.setDrawColor(...rgb(hex));
  const paintPage = () => {
    fill(S.bg);
    doc.rect(0, 0, PW, PH, 'F');
  };
  const newPage = () => {
    doc.addPage();
    paintPage();
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const card = (x0: number, y0: number, w: number, h: number, bg = S.card, border = S.border) => {
    fill(bg);
    draw(border);
    doc.setLineWidth(0.8);
    doc.roundedRect(x0, y0, w, h, 9, 9, 'FD');
  };
  paintPage();

  // ------------------------------------------------------------- cabeçalho
  fill(mix(x.color, S.card, 0.18));
  draw(mix(x.color, S.border, 0.4));
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, 46, 46, 12, 12, 'FD');
  if (x.iconPng) doc.addImage(x.iconPng, 'PNG', M + 10, y + 10, 26, 26);
  doc.setFont('Inter', 'bold');
  doc.setFontSize(22);
  color(S.text);
  const titleLines = doc.splitTextToSize(x.title, CW - 62) as string[];
  doc.text(titleLines, M + 60, y + 21);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  color(S.muted);
  doc.text(`${T.exported} ${x.date}`, M + 60, y + 21 + titleLines.length * 24 - 6);
  y += Math.max(46, titleLines.length * 24 + 10) + 18;

  // ------------------------------------------------------------ blocos
  const LH = 16;
  const MONO = 9.8;
  const resW = CW * 0.3;
  const sepX = M + CW - resW - PAD;
  const srcX = M + PAD;
  const srcW = sepX - srcX - 10;

  /** Quebra os trechos coloridos de uma linha na largura da coluna. */
  const layoutLine = (l: XLine) => {
    const rows: { text: string; cls: string }[][] = [[]];
    let w = 0;
    for (const s of l.segments) {
      doc.setFont('Mono', s.cls === 'assign' || s.cls === 'hdr' ? 'bold' : 'normal');
      doc.setFontSize(MONO);
      let rest = s.text;
      while (rest) {
        const avail = srcW - w;
        let n = rest.length;
        while (n > 0 && doc.getTextWidth(rest.slice(0, n)) > avail) n--;
        if (n === 0) {
          rows.push([]);
          w = 0;
          continue;
        }
        rows[rows.length - 1].push({ text: rest.slice(0, n), cls: s.cls });
        w += doc.getTextWidth(rest.slice(0, n));
        rest = rest.slice(n);
      }
    }
    return rows;
  };

  for (const b of x.blocks) {
    switch (b.type) {
      case 'calc': {
        // mede cada linha e desenha o cartão em pedaços que cabem na página
        const items = b.lines.map((l) => {
          const rows = l.kind === 'empty' ? [[]] : layoutLine(l);
          const h = l.kind === 'empty' ? LH * 0.7 : rows.length * LH + (l.kind === 'header' ? 4 : 0);
          return { l, rows, h };
        });
        let i = 0;
        while (i < items.length) {
          ensure(LH * 2 + PAD * 2);
          let h = PAD * 2;
          let j = i;
          while (j < items.length && y + h + items[j].h <= BOTTOM) h += items[j++].h;
          if (j === i) j = i + 1;
          card(M, y, CW, h);
          draw(S.border);
          doc.setLineWidth(0.8);
          doc.line(sepX, y + PAD - 4, sepX, y + h - PAD + 4);
          let cy = y + PAD;
          for (let k = i; k < j; k++) {
            const { l, rows, h: lh } = items[k];
            if (l.aggregate && l.result) {
              fill(mix(S.res, S.card, 0.16));
              doc.roundedRect(sepX + 8, cy + 1, M + CW - PAD - sepX - 4, LH - 1, 4, 4, 'F');
            }
            rows.forEach((row, ri) => {
              let cx = srcX;
              for (const s of row) {
                doc.setFont('Mono', s.cls === 'assign' || s.cls === 'hdr' || l.kind === 'header' ? 'bold' : 'normal');
                doc.setFontSize(l.kind === 'header' ? MONO + 1.6 : MONO);
                color(l.kind === 'comment' ? S.syn.cmt : S.syn[s.cls] ?? S.text);
                doc.text(s.text, cx, cy + 11.5 + ri * LH);
                cx += doc.getTextWidth(s.text);
              }
            });
            if (l.result) {
              doc.setFont('Mono', 'bold');
              doc.setFontSize(MONO + 0.4);
              color(S.res);
              let r = l.result;
              const maxW = M + CW - PAD - sepX - 12;
              while (r.length > 3 && doc.getTextWidth(r) > maxW) r = r.slice(0, -2);
              doc.text(r === l.result ? r : r + '…', M + CW - PAD - 2, cy + 11.5, { align: 'right' });
            }
            cy += lh;
          }
          y += h;
          i = j;
          if (i < items.length) newPage();
        }
        y += 4;
        break;
      }
      case 'sum': {
        y -= 2;
        doc.setFont('Mono', 'bold');
        doc.setFontSize(9);
        const right = `${T.avg} ${b.avg} · ${b.count} ${T.lines}`;
        doc.setFont('Mono', 'normal');
        color(S.muted);
        const rw = doc.getTextWidth(right);
        doc.text(right, M + CW - PAD, y + 10, { align: 'right' });
        doc.setFont('Mono', 'bold');
        color(S.res);
        doc.text(`Σ ${b.sum}`, M + CW - PAD - rw - 12, y + 10, { align: 'right' });
        y += 20;
        break;
      }
      case 'heading': {
        const size = b.level === 1 ? 20 : b.level === 2 ? 15.5 : 11.5;
        ensure(size * 2);
        y += 6;
        doc.setFont('Inter', 'bold');
        doc.setFontSize(size);
        color(b.level === 3 ? S.muted : S.text);
        doc.text(b.level === 3 ? b.text.toUpperCase() : b.text, M + 4, y + size);
        y += size + 12;
        break;
      }
      case 'chart': {
        const iw = CW - PAD * 2;
        const ih = (iw * b.h) / b.w;
        const h = ih + PAD * 2 + 26;
        ensure(h + 10);
        card(M, y, CW, h);
        doc.setFont('Inter', 'bold');
        doc.setFontSize(11.5);
        color(S.text);
        doc.text(b.title || '', M + PAD, y + PAD + 10);
        if (b.png) doc.addImage(b.png, 'PNG', M + PAD, y + PAD + 22, iw, ih);
        y += h + 12;
        break;
      }
      case 'callout': {
        doc.setFont('Inter', 'normal');
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(b.text, CW - 60) as string[];
        const h = Math.max(38, lines.length * 15 + 20);
        ensure(h + 10);
        card(M, y, CW, h, mix(b.color, S.card, 0.12), mix(b.color, S.border, 0.3));
        fill(b.color);
        doc.rect(M, y + 2, 4, h - 4, 'F');
        if (b.iconPng) doc.addImage(b.iconPng, 'PNG', M + 16, y + 11, 16, 16);
        color(S.text);
        doc.text(lines, M + 42, y + 23);
        y += h + 12;
        break;
      }
      case 'progress': {
        const h = 78;
        ensure(h + 10);
        card(M, y, CW, h);
        doc.setFont('Inter', 'bold');
        doc.setFontSize(12);
        color(S.text);
        doc.text(b.label || T.progress, M + PAD, y + PAD + 10);
        doc.setFont('Mono', 'bold');
        doc.setFontSize(16);
        color(b.color);
        doc.text(`${Math.round(b.pct * 100)}%`, M + CW - PAD, y + PAD + 12, { align: 'right' });
        const by = y + PAD + 24;
        fill(S.card2);
        draw(S.border);
        doc.roundedRect(M + PAD, by, CW - PAD * 2, 11, 5.5, 5.5, 'FD');
        if (b.pct > 0) {
          fill(b.color);
          doc.roundedRect(M + PAD, by, Math.max(11, (CW - PAD * 2) * b.pct), 11, 5.5, 5.5, 'F');
        }
        doc.setFont('Mono', 'normal');
        doc.setFontSize(9);
        color(S.muted);
        doc.text(`${T.value}: ${b.valueText}    ${T.goal}: ${b.goalText}`, M + PAD, by + 28);
        y += h + 12;
        break;
      }
      case 'ticker': {
        const h = 74;
        ensure(h + 10);
        card(M, y, CW, h);
        const n = b.rows.length;
        const gap = 8;
        const w = (CW - PAD * 2 - gap * (n - 1)) / Math.max(1, n);
        b.rows.forEach((r, i) => {
          const x0 = M + PAD + i * (w + gap);
          card(x0, y + PAD, w, 46, S.card2, S.border);
          doc.setFont('Inter', 'semibold');
          doc.setFontSize(8.5);
          color(S.muted);
          doc.text(`1 ${r.code}`, x0 + 10, y + PAD + 15);
          doc.setFont('Mono', 'bold');
          doc.setFontSize(11);
          color(S.syn.cur);
          doc.text(r.text, x0 + 10, y + PAD + 34);
        });
        y += h + 12;
        break;
      }
      case 'image': {
        const w = ((CW - PAD * 2) * b.width) / 100;
        let h = (w * b.h) / b.w;
        let ww = w;
        if (h > BOTTOM - M - 60) {
          h = BOTTOM - M - 60;
          ww = (h * b.w) / b.h;
        }
        const ch = h + PAD * 2 + (b.caption ? 18 : 0);
        ensure(ch + 10);
        card(M, y, CW, ch);
        try {
          doc.addImage(b.src, imageType(b.src).toUpperCase(), M + (CW - ww) / 2, y + PAD, ww, h);
        } catch {
          /* formato não suportado */
        }
        if (b.caption) {
          doc.setFont('Inter', 'normal');
          doc.setFontSize(9);
          color(S.muted);
          doc.text(b.caption, M + CW / 2, y + PAD + h + 14, { align: 'center' });
        }
        y += ch + 12;
        break;
      }
      case 'divider':
        ensure(20);
        fill(S.accent);
        doc.roundedRect(M, y + 7, CW, 2.5, 1.2, 1.2, 'F');
        y += 22;
        break;
      case 'sticker': {
        const s = Math.min(90, b.size);
        ensure(s + 10);
        const x0 = b.align === 'left' ? M : b.align === 'right' ? M + CW - s : M + (CW - s) / 2;
        doc.addImage(b.png, 'PNG', x0, y, s, s);
        y += s + 10;
        break;
      }
    }
  }

  // -------------------------------------------------------------- rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(8);
    color(S.muted);
    doc.text(`${x.title} · ${T.made}`, M, PH - 22);
    doc.text(`${T.page} ${i} ${T.of} ${pages}`, PW - M, PH - 22, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
