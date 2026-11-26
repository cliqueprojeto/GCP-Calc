/**
 * Word (.docx) editável: cada bloco de cálculo vira uma tabela (expressão colorida | resultado),
 * destaques e metas são tabelas sombreadas, gráficos e imagens entram como figuras.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { PRINT, XT, dataUrlToBytes, imageType, tint, type XDoc, type XLine } from './model';

const hex = (c: string) => c.replace('#', '').toUpperCase();
const BODY = 'Calibri';
const MONO = 'Consolas';
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const CONTENT_TWIPS = 9638; // A4 com margens de 2 cm

function lineRuns(l: XLine): TextRun[] {
  return l.segments
    .filter((s) => s.text)
    .map(
      (s) =>
        new TextRun({
          text: s.text,
          font: MONO,
          size: 19,
          bold: s.cls === 'assign',
          italics: s.cls === 'cmt',
          color: hex(l.kind === 'comment' ? PRINT.syn.cmt : PRINT.syn[s.cls] ?? PRINT.text),
        }),
    );
}

function img(src: string, wPx: number, hPx: number) {
  return new ImageRun({ type: imageType(src) === 'jpg' ? 'jpg' : imageType(src) === 'gif' ? 'gif' : 'png', data: dataUrlToBytes(src), transformation: { width: Math.round(wPx), height: Math.round(hPx) } });
}

export async function exportDocx(x: XDoc): Promise<Uint8Array> {
  const T = XT[x.lang];
  const children: (Paragraph | Table)[] = [];
  const MAXW = 620; // px na página

  // cabeçalho com ícone e título
  children.push(
    new Table({
      width: { size: CONTENT_TWIPS, type: WidthType.DXA },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 900, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(tint(x.color, 0.86)) },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: x.iconPng ? [img(x.iconPng, 34, 34)] : [] })],
            }),
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              margins: { left: 240 },
              children: [
                new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 40 }, children: [new TextRun({ text: x.title, bold: true, size: 44, font: BODY, color: hex(PRINT.text) })] }),
                new Paragraph({ children: [new TextRun({ text: `${T.exported} ${x.date}`, size: 17, color: hex(PRINT.muted), font: BODY })] }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: hex(x.color), space: 1 } }, spacing: { after: 240 } }),
  );

  for (const b of x.blocks) {
    switch (b.type) {
      case 'calc': {
        const rows: TableRow[] = [];
        let zebra = false;
        for (const l of b.lines) {
          if (l.kind === 'empty') {
            zebra = false;
            continue;
          }
          if (l.kind === 'header') {
            rows.push(
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    margins: { top: 140, bottom: 60 },
                    borders: { top: NONE, left: NONE, right: NONE, bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(PRINT.border) } },
                    children: [new Paragraph({ children: [new TextRun({ text: l.text.replace(/^#+\s*/, ''), bold: true, size: 25, color: hex(x.color), font: BODY })] })],
                  }),
                ],
              }),
            );
            zebra = false;
            continue;
          }
          const shade = zebra && l.kind === 'value' ? { type: ShadingType.CLEAR, color: 'auto', fill: hex(PRINT.zebra) } : undefined;
          rows.push(
            new TableRow({
              children: [
                new TableCell({ width: { size: 6400, type: WidthType.DXA }, shading: shade, margins: { top: 30, bottom: 30, left: 80 }, children: [new Paragraph({ children: lineRuns(l) })] }),
                new TableCell({
                  width: { size: CONTENT_TWIPS - 6400, type: WidthType.DXA },
                  shading: l.aggregate ? { type: ShadingType.CLEAR, color: 'auto', fill: hex(tint(x.color, 0.86)) } : shade,
                  margins: { top: 30, bottom: 30, right: 80 },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: l.result ? [new TextRun({ text: l.result, bold: true, font: MONO, size: 20, color: hex(l.aggregate ? x.color : PRINT.text) })] : [] })],
                }),
              ],
            }),
          );
          zebra = !zebra;
        }
        if (rows.length) children.push(new Table({ width: { size: CONTENT_TWIPS, type: WidthType.DXA }, borders: NO_BORDERS, rows }), new Paragraph({ spacing: { after: 160 } }));
        break;
      }
      case 'heading':
        children.push(
          new Paragraph({
            heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: b.text, bold: true, font: BODY, size: b.level === 1 ? 36 : b.level === 2 ? 30 : 24, color: hex(PRINT.text) })],
          }),
        );
        break;
      case 'chart':
        if (b.title) children.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: b.title, bold: true, font: BODY, size: 24, color: hex(PRINT.text) })] }));
        if (b.png) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [img(b.png, MAXW, (MAXW * b.h) / b.w)] }));
        break;
      case 'callout':
        children.push(
          new Table({
            width: { size: CONTENT_TWIPS, type: WidthType.DXA },
            borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 24, color: hex(b.color) } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(tint(b.color, 0.9)) },
                    margins: { top: 140, bottom: 140, left: 200, right: 200 },
                    children: b.text.split('\n').map(
                      (line, i) =>
                        new Paragraph({
                          children: [...(i === 0 && b.iconPng ? [img(b.iconPng, 16, 16), new TextRun({ text: '  ' })] : []), new TextRun({ text: line, font: BODY, size: 22, color: hex(PRINT.text) })],
                        }),
                    ),
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160 } }),
        );
        break;
      case 'progress': {
        const filled = Math.max(1, Math.round(CONTENT_TWIPS * b.pct));
        const cells = [new TableCell({ width: { size: filled, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(b.color) }, children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] })] })];
        if (b.pct < 1) cells.push(new TableCell({ width: { size: CONTENT_TWIPS - filled, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF2F7' }, children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] })] }));
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [new TextRun({ text: (b.label || T.progress) + '  ', bold: true, font: BODY, size: 24, color: hex(PRINT.text) }), new TextRun({ text: `${Math.round(b.pct * 100)}%`, bold: true, font: MONO, size: 24, color: hex(b.color) })],
          }),
          new Table({ width: { size: CONTENT_TWIPS, type: WidthType.DXA }, borders: NO_BORDERS, rows: [new TableRow({ height: { value: 160, rule: 'exact' as never }, children: cells })] }),
          new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: `${T.value}: ${b.valueText}    ${T.goal}: ${b.goalText}`, font: BODY, size: 19, color: hex(PRINT.muted) })] }),
        );
        break;
      }
      case 'ticker':
        children.push(
          new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: T.rates, bold: true, font: BODY, size: 22, color: hex(PRINT.muted) })] }),
          new Table({
            width: { size: CONTENT_TWIPS, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: b.rows.map(
                  (r) =>
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 140 },
                      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: hex(PRINT.border) }, bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(PRINT.border) }, left: { style: BorderStyle.SINGLE, size: 4, color: hex(PRINT.border) }, right: { style: BorderStyle.SINGLE, size: 4, color: hex(PRINT.border) } },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `1 ${r.code}`, font: BODY, size: 17, color: hex(PRINT.muted), bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: r.text, font: MONO, size: 22, color: hex(PRINT.syn.cur), bold: true })] }),
                      ],
                    }),
                ),
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160 } }),
        );
        break;
      case 'image': {
        const w = (MAXW * b.width) / 100;
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: b.caption ? 40 : 200 }, children: [img(b.src, w, (w * b.h) / b.w)] }));
        if (b.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: b.caption, italics: true, font: BODY, size: 18, color: hex(PRINT.muted) })] }));
        break;
      }
      case 'divider':
        children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(PRINT.border), space: 1 } }, spacing: { before: 120, after: 240 } }));
        break;
      case 'sticker':
        children.push(new Paragraph({ alignment: b.align === 'left' ? AlignmentType.LEFT : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER, spacing: { after: 160 }, children: [img(b.png, Math.min(90, b.size), Math.min(90, b.size))] }));
        break;
    }
  }

  const doc = new Document({
    creator: 'GCP-Calc',
    title: x.title,
    styles: { default: { document: { run: { font: BODY, size: 22, color: hex(PRINT.text) } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${x.title} · ${T.made} · ${T.page} `, size: 16, color: hex(PRINT.muted), font: BODY }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: hex(PRINT.muted), font: BODY }),
                  new TextRun({ text: ` ${T.of} `, size: 16, color: hex(PRINT.muted), font: BODY }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: hex(PRINT.muted), font: BODY }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
}
