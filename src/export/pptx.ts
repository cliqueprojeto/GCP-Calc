/**
 * PowerPoint (.pptx) editável: capa, tabelas nativas com a sintaxe colorida,
 * gráficos nativos do PowerPoint (editáveis), destaques, metas e cotações como formas.
 */
import PptxGenJS from 'pptxgenjs';
import { XT, docStyle, type XDoc, type XLine } from './model';
import { mix } from '../lib/colors';

const hex = (c: string) => c.replace('#', '').toUpperCase();
const FONT = 'Calibri';
const MONO = 'Consolas';
const W = 13.333;
const H = 7.5;
const MX = 0.6;
const TOP = 1.3;
const BOTTOM = 6.8;
const ROWS_PER_SLIDE = 10;
const ROW_H = 0.48;

const img = (src: string) => src.replace(/^data:/, '');

export async function exportPptx(x: XDoc): Promise<Uint8Array> {
  const T = XT[x.lang];
  const S = docStyle(x.pal);
  const tint = (c: string, a: number) => mix(S.card, c, a);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = x.title;
  pptx.company = 'GCP-Calc';
  pptx.defineSlideMaster({
    title: 'GCP',
    background: { color: hex(S.bg) },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.09, fill: { color: hex(x.color) } } },
      { text: { text: `${x.title} · ${T.made}`, options: { x: MX, y: H - 0.5, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: hex(S.muted) } } },
    ],
    slideNumber: { x: W - 1.1, y: H - 0.5, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: hex(S.muted) },
  });

  // ---------------------------------------------------------------- capa
  const cover = pptx.addSlide({ masterName: 'GCP' });
  cover.addShape(pptx.ShapeType.roundRect, { x: MX, y: 2.2, w: 1.3, h: 1.3, fill: { color: hex(tint(x.color, 0.8)) }, line: { color: hex(tint(x.color, 0.8)) }, rectRadius: 0.2 });
  if (x.iconPng) cover.addImage({ data: img(x.iconPng), x: MX + 0.3, y: 2.5, w: 0.7, h: 0.7 });
  cover.addText(x.title, { x: MX, y: 3.75, w: W - MX * 2, h: 1.1, fontFace: FONT, fontSize: 40, bold: true, color: hex(S.text) });
  cover.addText(`${T.exported} ${x.date}`, { x: MX, y: 4.85, w: W - MX * 2, h: 0.4, fontFace: FONT, fontSize: 14, color: hex(S.muted) });

  // ------------------------------------------------------- slides de conteúdo
  let slide: PptxGenJS.Slide | null = null;
  let y = TOP;
  let pendingTitle = '';

  const newSlide = (title: string) => {
    slide = pptx.addSlide({ masterName: 'GCP' });
    slide.addText(title || x.title, { x: MX, y: 0.4, w: W - MX * 2, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: hex(S.text) });
    y = TOP;
    return slide;
  };
  const room = (h: number) => {
    if (!slide || y + h > BOTTOM) newSlide(pendingTitle || x.title);
    return slide!;
  };

  const lineCell = (l: XLine) => ({
    text: l.segments
      .filter((s) => s.text)
      .map((s) => ({ text: s.text, options: { color: hex(l.kind === 'comment' ? S.syn.cmt : S.syn[s.cls] ?? S.text), bold: s.cls === 'assign', fontFace: MONO } })),
  });

  for (const b of x.blocks) {
    switch (b.type) {
      case 'calc': {
        // seções: cada título (#) começa uma série de slides
        const sections: { title: string; lines: XLine[] }[] = [{ title: pendingTitle || x.title, lines: [] }];
        for (const l of b.lines) {
          if (l.kind === 'header') sections.push({ title: l.text.replace(/^#+\s*/, ''), lines: [] });
          else if (l.kind !== 'empty') sections[sections.length - 1].lines.push(l);
        }
        for (const sec of sections) {
          if (!sec.lines.length) continue;
          for (let i = 0; i < sec.lines.length; i += ROWS_PER_SLIDE) {
            const chunk = sec.lines.slice(i, i + ROWS_PER_SLIDE);
            const s = newSlide(i ? `${sec.title} (${T.cont})` : sec.title);
            const rows = chunk.map((l, k) => [
              { ...lineCell(l), options: { fill: { color: k % 2 ? hex(S.card) : hex(S.zebra) }, fontSize: 18, valign: 'middle' as const } },
              {
                text: l.result ?? '',
                options: {
                  align: 'right' as const,
                  bold: true,
                  fontFace: MONO,
                  fontSize: 19,
                  valign: 'middle' as const,
                  color: hex(S.res),
                  fill: { color: l.aggregate ? hex(mix(S.res, S.card, 0.16)) : k % 2 ? hex(S.card) : hex(S.zebra) },
                },
              },
            ]);
            s.addTable(rows as PptxGenJS.TableRow[], { x: MX, y: TOP, w: W - MX * 2, colW: [(W - MX * 2) * 0.66, (W - MX * 2) * 0.34], rowH: ROW_H, fontFace: MONO, border: { type: 'solid', pt: 0.75, color: hex(S.card) }, margin: [0.04, 0.16, 0.04, 0.16] });
            y = TOP + chunk.length * ROW_H + 0.3;
          }
        }
        break;
      }
      case 'heading':
        if (b.level === 1) {
          pendingTitle = b.text;
          slide = null;
        } else {
          const s = room(0.6);
          s.addText(b.text, { x: MX, y, w: W - MX * 2, h: 0.5, fontFace: FONT, fontSize: b.level === 2 ? 20 : 15, bold: true, color: hex(b.level === 3 ? S.muted : S.text) });
          y += 0.6;
        }
        break;
      case 'chart': {
        const s = newSlide(b.title || pendingTitle || x.title);
        const type = b.kind === 'pie' ? pptx.ChartType.pie : b.kind === 'donut' ? pptx.ChartType.doughnut : b.kind === 'line' ? pptx.ChartType.line : pptx.ChartType.bar;
        const isPie = b.kind === 'pie' || b.kind === 'donut';
        s.addChart(type, [{ name: b.title || x.title, labels: b.data.map((d) => d.label), values: b.data.map((d) => Math.round(d.n * 100) / 100) }], {
          x: MX,
          y: TOP,
          w: W - MX * 2,
          h: BOTTOM - TOP,
          barDir: b.kind === 'hbar' ? 'bar' : 'col',
          chartColors: x.pal.chart.map(hex),
          showValue: !isPie,
          showPercent: isPie,
          showLegend: isPie,
          legendPos: 'r',
          legendFontSize: 13,
          dataLabelFontSize: 12,
          catAxisLabelFontSize: 12,
          valAxisLabelFontSize: 11,
          holeSize: 55,
          valGridLine: { color: hex(S.border), size: 0.75 },
          catAxisLabelColor: hex(S.muted),
          valAxisLabelColor: hex(S.muted),
          legendColor: hex(S.text),
          catAxisLineShow: false,
          valAxisLineShow: false,
          plotArea: { fill: { color: hex(S.card) } },
          chartArea: { fill: { color: hex(S.card) }, border: { color: hex(S.border), pt: 1 }, roundedCorners: true },
          lineSize: 3,
          lineDataSymbolSize: 9,
          catAxisLabelFontFace: FONT,
          dataLabelColor: hex(S.text),
        });
        slide = null;
        break;
      }
      case 'callout': {
        const lines = Math.max(1, Math.ceil(b.text.length / 95) + (b.text.match(/\n/g)?.length ?? 0));
        const h = 0.35 + lines * 0.32;
        const s = room(h + 0.2);
        s.addShape(pptx.ShapeType.roundRect, { x: MX, y, w: W - MX * 2, h, fill: { color: hex(tint(b.color, 0.86)) }, line: { color: hex(tint(b.color, 0.86)) }, rectRadius: 0.08 });
        s.addShape(pptx.ShapeType.rect, { x: MX, y, w: 0.07, h, fill: { color: hex(b.color) }, line: { color: hex(b.color) } });
        if (b.iconPng) s.addImage({ data: img(b.iconPng), x: MX + 0.25, y: y + 0.16, w: 0.3, h: 0.3 });
        s.addText(b.text, { x: MX + 0.7, y, w: W - MX * 2 - 0.9, h, fontFace: FONT, fontSize: 15, color: hex(S.text), valign: 'middle' });
        y += h + 0.25;
        break;
      }
      case 'progress': {
        const s = room(1.2);
        const cw = W - MX * 2;
        s.addText(b.label || T.progress, { x: MX, y, w: cw * 0.7, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: hex(S.text) });
        s.addText(`${Math.round(b.pct * 100)}%`, { x: MX + cw * 0.7, y, w: cw * 0.3, h: 0.4, align: 'right', fontFace: MONO, fontSize: 20, bold: true, color: hex(b.color) });
        s.addShape(pptx.ShapeType.roundRect, { x: MX, y: y + 0.5, w: cw, h: 0.2, fill: { color: hex(S.card2) }, line: { color: hex(S.border) }, rectRadius: 0.1 });
        if (b.pct > 0) s.addShape(pptx.ShapeType.roundRect, { x: MX, y: y + 0.5, w: Math.max(0.2, cw * b.pct), h: 0.2, fill: { color: hex(b.color) }, line: { color: hex(b.color) }, rectRadius: 0.1 });
        s.addText(`${T.value}: ${b.valueText}     ${T.goal}: ${b.goalText}`, { x: MX, y: y + 0.75, w: cw, h: 0.35, fontFace: FONT, fontSize: 13, color: hex(S.muted) });
        y += 1.3;
        break;
      }
      case 'ticker': {
        const s = room(1.2);
        const n = b.rows.length;
        const gap = 0.2;
        const w = (W - MX * 2 - gap * (n - 1)) / Math.max(1, n);
        b.rows.forEach((r, i) => {
          const x0 = MX + i * (w + gap);
          s.addShape(pptx.ShapeType.roundRect, { x: x0, y, w, h: 1, fill: { color: hex(S.card) }, line: { color: hex(S.border), width: 1 }, rectRadius: 0.1 });
          s.addText(`1 ${r.code}`, { x: x0 + 0.15, y: y + 0.1, w: w - 0.3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: hex(S.muted) });
          s.addText(r.text, { x: x0 + 0.15, y: y + 0.45, w: w - 0.3, h: 0.4, fontFace: MONO, fontSize: 17, bold: true, color: hex(S.syn.cur) });
        });
        y += 1.25;
        break;
      }
      case 'image': {
        const maxW = ((W - MX * 2) * b.width) / 100;
        let w = maxW;
        let h = (w * b.h) / b.w;
        if (h > BOTTOM - TOP - (b.caption ? 0.4 : 0)) {
          h = BOTTOM - TOP - (b.caption ? 0.4 : 0);
          w = (h * b.w) / b.h;
        }
        const s = room(h + (b.caption ? 0.5 : 0.2));
        s.addImage({ data: img(b.src), x: MX + (W - MX * 2 - w) / 2, y, w, h });
        y += h + 0.1;
        if (b.caption) {
          s.addText(b.caption, { x: MX, y, w: W - MX * 2, h: 0.35, align: 'center', fontFace: FONT, fontSize: 12, italic: true, color: hex(S.muted) });
          y += 0.45;
        }
        break;
      }
      case 'sum': {
        if (!slide) break;
        (slide as PptxGenJS.Slide).addText(
          [
            { text: `Σ ${b.sum}`, options: { bold: true, color: hex(S.res) } },
            { text: `   ${T.avg} ${b.avg} · ${b.count} ${T.lines}`, options: { color: hex(S.muted) } },
          ],
          { x: MX, y: Math.min(y - 0.25, BOTTOM - 0.35), w: W - MX * 2, h: 0.35, align: 'right', fontFace: MONO, fontSize: 13 },
        );
        y += 0.2;
        break;
      }
      case 'divider': {
        const s = room(0.3);
        s.addShape(pptx.ShapeType.rect, { x: MX, y: y + 0.08, w: W - MX * 2, h: 0.04, fill: { color: hex(S.accent) }, line: { color: hex(S.accent) } });
        y += 0.3;
        break;
      }
      case 'sticker': {
        const sz = Math.min(1.4, b.size / 56);
        const s = room(sz + 0.2);
        const x0 = b.align === 'left' ? MX : b.align === 'right' ? W - MX - sz : (W - sz) / 2;
        s.addImage({ data: img(b.png), x: x0, y, w: sz, h: sz });
        y += sz + 0.2;
        break;
      }
    }
  }

  const out = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
  return out;
}
