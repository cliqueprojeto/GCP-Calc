/**
 * PDF premium com texto selecionável: fontes Inter e JetBrains Mono embutidas,
 * sintaxe colorida, resultados alinhados, gráficos, destaques, metas e imagens.
 */
import { jsPDF } from 'jspdf';
import interRegular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import interSemi from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?url';
import interBold from '@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf?url';
import monoRegular from '@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf?url';
import monoBold from '@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf?url';
import { PRINT, XT, tint, imageType, type XDoc, type XLine } from './model';

async function fontB64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

let fontCache: Promise<[string, string, string, string, string]> | null = null;
const loadFonts = () => (fontCache ??= Promise.all([interRegular, interSemi, interBold, monoRegular, monoBold].map(fontB64)) as Promise<[string, string, string, string, string]>);

const rgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '').match(/.{2}/g) || ['00', '00', '00'];
  return m.map((x) => parseInt(x, 16)) as [number, number, number];
};

export async function exportPdf(x: XDoc): Promise<Uint8Array> {
  const [ir, is, ib, mr, mb] = await loadFonts();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Inter-Regular.ttf', ir);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-SemiBold.ttf', is);
  doc.addFont('Inter-SemiBold.ttf', 'Inter', 'semibold');
  doc.addFileToVFS('Inter-Bold.ttf', ib);
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
  doc.addFileToVFS('Mono-Regular.ttf', mr);
  doc.addFont('Mono-Regular.ttf', 'Mono', 'normal');
  doc.addFileToVFS('Mono-Bold.ttf', mb);
  doc.addFont('Mono-Bold.ttf', 'Mono', 'bold');
  doc.setProperties({ title: x.title, creator: 'GCP-Calc', author: 'GCP-Calc' });

  const T = XT[x.lang];
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = PH - 48;
  let y = M;

  const color = (hex: string) => doc.setTextColor(...rgb(hex));
  const fill = (hex: string) => doc.setFillColor(...rgb(hex));
  const draw = (hex: string) => doc.setDrawColor(...rgb(hex));
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------- cabeçalho
  fill(tint(x.color, 0.86));
  doc.roundedRect(M, y, 46, 46, 10, 10, 'F');
  if (x.iconPng) doc.addImage(x.iconPng, 'PNG', M + 9, y + 9, 28, 28);
  doc.setFont('Inter', 'bold');
  doc.setFontSize(22);
  color(PRINT.text);
  const titleLines = doc.splitTextToSize(x.title, CW - 62) as string[];
  doc.text(titleLines, M + 60, y + 20);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  color(PRINT.muted);
  doc.text(`${T.exported} ${x.date}`, M + 60, y + 20 + titleLines.length * 24 - 6);
  y += Math.max(46, titleLines.length * 24 + 10) + 12;
  fill(x.color);
  doc.rect(M, y, CW, 2, 'F');
  y += 20;

  // ------------------------------------------------------------ blocos
  const LH = 15.5;
  const MONO = 9.6;
  const resW = CW * 0.32;
  const srcW = CW - resW - 14;

  /** Desenha os trechos coloridos de uma linha, quebrando quando passa da largura. */
  const layoutLine = (l: XLine) => {
    doc.setFont('Mono', 'normal');
    doc.setFontSize(MONO);
    const rows: { text: string; cls: string }[][] = [[]];
    let w = 0;
    for (const s of l.segments) {
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
        y += 4;
        let zebra = false;
        for (const l of b.lines) {
          if (l.kind === 'empty') {
            y += LH * 0.55;
            zebra = false;
            continue;
          }
          if (l.kind === 'header') {
            ensure(LH * 2.2);
            y += 6;
            doc.setFont('Inter', 'bold');
            doc.setFontSize(12.5);
            color(x.color);
            doc.text(l.text.replace(/^#+\s*/, ''), M, y + 10);
            y += 16;
            draw(PRINT.border);
            doc.setLineWidth(0.6);
            doc.line(M, y, M + CW, y);
            y += 6;
            zebra = false;
            continue;
          }
          const rows = layoutLine(l);
          const h = rows.length * LH + 3;
          ensure(h);
          if (zebra && l.kind === 'value') {
            fill(PRINT.zebra);
            doc.rect(M - 6, y - 1, CW + 12, h, 'F');
          }
          if (l.aggregate && l.result) {
            fill(tint(x.color, 0.88));
            doc.roundedRect(M + CW - resW - 4, y, resW + 10, LH + 1, 4, 4, 'F');
          }
          rows.forEach((row, i) => {
            let cx = M;
            for (const s of row) {
              doc.setFont('Mono', s.cls === 'assign' || s.cls === 'hdr' ? 'bold' : 'normal');
              color(l.kind === 'comment' ? PRINT.syn.cmt : PRINT.syn[s.cls] ?? PRINT.text);
              doc.text(s.text, cx, y + 11 + i * LH);
              cx += doc.getTextWidth(s.text);
            }
          });
          if (l.result) {
            doc.setFont('Mono', 'bold');
            doc.setFontSize(MONO + 0.4);
            color(l.aggregate ? x.color : PRINT.text);
            let r = l.result;
            while (r.length > 3 && doc.getTextWidth(r) > resW) r = r.slice(0, -2);
            doc.text(r === l.result ? r : r + '…', M + CW, y + 11, { align: 'right' });
          }
          y += h;
          zebra = !zebra;
        }
        y += 10;
        break;
      }
      case 'heading': {
        const size = b.level === 1 ? 19 : b.level === 2 ? 15 : 11.5;
        ensure(size * 2);
        y += 8;
        doc.setFont('Inter', 'bold');
        doc.setFontSize(size);
        color(b.level === 3 ? PRINT.muted : PRINT.text);
        doc.text(b.level === 3 ? b.text.toUpperCase() : b.text, M, y + size);
        y += size + 12;
        break;
      }
      case 'chart': {
        const h = (CW * b.h) / b.w;
        ensure(h + 30);
        if (b.title) {
          doc.setFont('Inter', 'semibold');
          doc.setFontSize(12);
          color(PRINT.text);
          doc.text(b.title, M, y + 12);
          y += 20;
        }
        if (b.png) doc.addImage(b.png, 'PNG', M, y, CW, h);
        y += h + 14;
        break;
      }
      case 'callout': {
        doc.setFont('Inter', 'normal');
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(b.text, CW - 56) as string[];
        const h = Math.max(36, lines.length * 15 + 18);
        ensure(h + 10);
        fill(tint(b.color, 0.9));
        doc.roundedRect(M, y, CW, h, 8, 8, 'F');
        fill(b.color);
        doc.rect(M, y, 3.5, h, 'F');
        if (b.iconPng) doc.addImage(b.iconPng, 'PNG', M + 14, y + 10, 16, 16);
        color(PRINT.text);
        doc.text(lines, M + 40, y + 22);
        y += h + 12;
        break;
      }
      case 'progress': {
        ensure(64);
        doc.setFont('Inter', 'semibold');
        doc.setFontSize(12);
        color(PRINT.text);
        doc.text(b.label || T.progress, M, y + 12);
        doc.setFont('Mono', 'bold');
        doc.setFontSize(14);
        color(b.color);
        doc.text(`${Math.round(b.pct * 100)}%`, M + CW, y + 13, { align: 'right' });
        y += 22;
        fill('#eef2f7');
        doc.roundedRect(M, y, CW, 10, 5, 5, 'F');
        if (b.pct > 0) {
          fill(b.color);
          doc.roundedRect(M, y, Math.max(10, CW * b.pct), 10, 5, 5, 'F');
        }
        y += 22;
        doc.setFont('Inter', 'normal');
        doc.setFontSize(9.5);
        color(PRINT.muted);
        doc.text(`${T.value}: ${b.valueText}    ${T.goal}: ${b.goalText}`, M, y);
        y += 16;
        break;
      }
      case 'ticker': {
        ensure(60);
        const n = b.rows.length;
        const gap = 8;
        const w = (CW - gap * (n - 1)) / Math.max(1, n);
        b.rows.forEach((r, i) => {
          const x0 = M + i * (w + gap);
          draw(PRINT.border);
          doc.setLineWidth(0.8);
          doc.roundedRect(x0, y, w, 44, 7, 7, 'S');
          doc.setFont('Inter', 'semibold');
          doc.setFontSize(8.5);
          color(PRINT.muted);
          doc.text(`1 ${r.code}`, x0 + 10, y + 15);
          doc.setFont('Mono', 'bold');
          doc.setFontSize(11);
          color(PRINT.syn.cur);
          doc.text(r.text, x0 + 10, y + 33);
        });
        y += 56;
        break;
      }
      case 'image': {
        const w = (CW * b.width) / 100;
        const h = (w * b.h) / b.w;
        const scale = h > BOTTOM - M ? (BOTTOM - M) / h : 1;
        ensure(h * scale + (b.caption ? 20 : 8));
        const x0 = M + (CW - w * scale) / 2;
        try {
          doc.addImage(b.src, imageType(b.src).toUpperCase(), x0, y, w * scale, h * scale);
        } catch {
          /* formato não suportado */
        }
        y += h * scale + 6;
        if (b.caption) {
          doc.setFont('Inter', 'normal');
          doc.setFontSize(9);
          color(PRINT.muted);
          doc.text(b.caption, M + CW / 2, y + 8, { align: 'center' });
          y += 18;
        }
        y += 6;
        break;
      }
      case 'divider':
        ensure(20);
        draw(PRINT.border);
        doc.setLineWidth(1);
        doc.line(M, y + 8, M + CW, y + 8);
        y += 20;
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
    color(PRINT.muted);
    doc.text(`${x.title} · ${T.made}`, M, PH - 24);
    doc.text(`${T.page} ${i} ${T.of} ${pages}`, PW - M, PH - 24, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
