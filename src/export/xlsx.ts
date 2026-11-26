/**
 * Excel (.xlsx) organizado de forma inteligente.
 *
 * Cada linha com valor vira um registro: seção, descrição (rótulo, variável ou o texto da linha),
 * expressão original, valor numérico com formato de moeda/porcentagem/data, unidade e tipo.
 * - "total" e "média" viram fórmulas SUM/AVERAGE sobre as linhas do grupo (quando batem).
 * - Variáveis e rótulos viram nomes definidos (ex.: =salario-aluguel).
 * - Expressões simples (números, variáveis e + − × ÷ ^) viram fórmulas vivas, conferidas com o resultado.
 * - Metas ganham "% atingido" calculado; gráficos levam sua tabela de dados ao lado.
 */
import ExcelJS from 'exceljs';
import { currencyInfo } from '../engine/currencies';
import { parseNumber } from '../engine/evaluate';
import { fold, type Dim } from '../engine/units';
import { currencySymbol, type EvalContext, type Value } from '../engine/value';
import { PRINT, XT, tint, type XDoc, type XLine } from './model';

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase();

const DIM_NAME: Record<string, Record<Dim, string>> = {
  pt: { length: 'comprimento', mass: 'massa', area: 'área', volume: 'volume', time: 'tempo', temp: 'temperatura', data: 'dados', datarate: 'velocidade de internet', speed: 'velocidade', energy: 'energia', power: 'potência', pressure: 'pressão', angle: 'ângulo', frequency: 'frequência', money: 'moeda' },
  en: { length: 'length', mass: 'mass', area: 'area', volume: 'volume', time: 'time', temp: 'temperature', data: 'data', datarate: 'data rate', speed: 'speed', energy: 'energy', power: 'power', pressure: 'pressure', angle: 'angle', frequency: 'frequency', money: 'currency' },
  es: { length: 'longitud', mass: 'masa', area: 'área', volume: 'volumen', time: 'tiempo', temp: 'temperatura', data: 'datos', datarate: 'velocidad de internet', speed: 'velocidad', energy: 'energía', power: 'potencia', pressure: 'presión', angle: 'ángulo', frequency: 'frecuencia', money: 'moneda' },
};

const KIND: Record<string, Record<string, string>> = {
  pt: { money: 'Moeda', pct: 'Porcentagem', date: 'Data', num: 'Número', unit: 'Unidade', sum: 'Total', avg: 'Média', var: 'Variável', note: 'Nota', goal: 'Meta', reached: '% atingido', rate: 'Cotação', formula: 'Fórmula' },
  en: { money: 'Currency', pct: 'Percentage', date: 'Date', num: 'Number', unit: 'Unit', sum: 'Total', avg: 'Average', var: 'Variable', note: 'Note', goal: 'Goal', reached: '% reached', rate: 'Rate', formula: 'Formula' },
  es: { money: 'Moneda', pct: 'Porcentaje', date: 'Fecha', num: 'Número', unit: 'Unidad', sum: 'Total', avg: 'Promedio', var: 'Variable', note: 'Nota', goal: 'Meta', reached: '% alcanzado', rate: 'Cotización', formula: 'Fórmula' },
};

function sheetName(title: string, used: Set<string>) {
  let base = (title || 'Nota').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Nota';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 26)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

function definedName(raw: string, used: Set<string>) {
  let n = fold(raw)
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!n) return null;
  if (!/^[a-z_]/.test(n)) n = '_' + n;
  if (/^[a-z]{1,3}\d+$/.test(n) || /^r\d*c\d*$/.test(n) || n === 'true' || n === 'false') n = 'v_' + n;
  let name = n.slice(0, 60);
  for (let i = 2; used.has(name); i++) name = `${n.slice(0, 56)}_${i}`;
  used.add(name);
  return name;
}

function numFmt(v: Value, ctx: EvalContext): string {
  if (v.date) return ctx.dateOrder === 'mdy' ? 'mm/dd/yyyy' : 'dd/mm/yyyy';
  if (v.pct) return '0.00%';
  if (v.unit?.dim === 'money') {
    const code = v.unit.currency!;
    const info = currencyInfo(code);
    const dec = info?.decimals ?? 2;
    const pattern = '#,##0' + (dec ? '.' + '0'.repeat(dec) : '');
    const sym = currencySymbol(code, { lang: ctx.lang, tags: ctx.tags }).replace(/"/g, '');
    const letters = /^[A-Za-z]{2,}$/.test(sym) || info?.crypto || !info;
    return letters || ctx.currencyPosition === 'after' ? `${pattern} "${sym}"` : `"${sym}" ${pattern};-"${sym}" ${pattern}`;
  }
  return 'General';
}

/** Descrição inferida: rótulo, variável ou as palavras da linha sem os números. */
function describe(l: XLine): string {
  if (l.label) return l.label;
  const words = l.segments
    .filter((s) => s.cls === 'text' || s.cls === 'label')
    .map((s) => s.text)
    .join(' ')
    .replace(/\/\/.*$/, '')
    .replace(/[:=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return words.length > 1 ? words : l.text.trim();
}

interface RowInfo {
  row: number;
  v: Value;
}

export async function exportXlsx(docs: { x: XDoc; ctx: EvalContext }[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GCP-Calc';
  wb.created = new Date();
  const lang = docs[0]?.x.lang ?? 'pt';
  const T = XT[lang];
  const K = KIND[lang];
  const usedSheets = new Set<string>();
  // nomes definidos valem para a pasta de trabalho inteira: não podem se repetir entre abas
  const usedNames = new Set<string>();
  const summary: { name: string; title: string; lines: number; last?: { v: number; fmt: string } }[] = [];

  // com várias notas, a primeira aba é o resumo (preenchido no fim)
  const sumWs = docs.length > 1 ? wb.addWorksheet(sheetName(T.summary, usedSheets), { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] }) : null;

  for (const { x, ctx } of docs) {
    const name = sheetName(x.title, usedSheets);
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], properties: { tabColor: { argb: argb(x.color) } } });
    ws.columns = [
      { key: 'sec', width: 24 },
      { key: 'desc', width: 34 },
      { key: 'expr', width: 46 },
      { key: 'val', width: 20 },
      { key: 'unit', width: 10 },
      { key: 'kind', width: 22 },
    ];
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = x.title;
    ws.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: argb(PRINT.text) } };
    ws.getRow(1).height = 28;
    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = `${T.exported} ${x.date} · GCP-Calc`;
    ws.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: argb(PRINT.muted) } };
    const head = ws.getRow(4);
    head.values = [T.section, T.description, T.expression, T.result, T.unit, T.kind];
    head.height = 22;
    head.eachCell((c) => {
      c.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(x.color) } };
      c.alignment = { vertical: 'middle', horizontal: Number(c.col) === 4 ? 'right' : 'left' };
    });

    let r = 5;
    let section = T.general;
    let lastSection = '';
    let group: RowInfo[] = [];
    let zebra = false;
    const names = new Map<string, { name: string; v: Value }>();
    let lastTotal: { v: number; fmt: string } | undefined;
    let charts = 0;

    const style = (row: ExcelJS.Row, opts: { bold?: boolean; tinted?: boolean; italic?: boolean } = {}) => {
      row.eachCell({ includeEmpty: true }, (c) => {
        if (Number(c.col) > 6) return;
        c.font = { name: Number(c.col) === 3 ? 'Consolas' : 'Calibri', size: Number(c.col) === 3 ? 10 : 11, bold: opts.bold || Number(c.col) === 4, italic: opts.italic, color: { argb: argb(Number(c.col) === 3 ? PRINT.muted : PRINT.text) } };
        c.alignment = { vertical: 'middle', horizontal: Number(c.col) === 4 ? 'right' : Number(c.col) === 5 ? 'center' : 'left', wrapText: Number(c.col) === 2 };
        const fillColor = opts.tinted ? tint(x.color, 0.86) : zebra ? PRINT.zebra : '#ffffff';
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fillColor) } };
        c.border = { bottom: { style: 'hair', color: { argb: argb(PRINT.border) } } };
      });
      if (section !== lastSection) {
        row.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: argb(x.color) } };
        for (let c = 1; c <= 6; c++) row.getCell(c).border = { ...row.getCell(c).border, top: { style: 'thin', color: { argb: argb(x.color) } } };
        lastSection = section;
      }
      zebra = !zebra;
    };

    const unitLabel = (v: Value) => (v.unit?.dim === 'money' ? v.unit.currency! : v.unit ? v.unit.symbol : v.pct ? '%' : '');
    const kindLabel = (v: Value) =>
      v.date ? K.date : v.pct ? K.pct : v.unit?.dim === 'money' ? `${K.money} (${v.unit.currency})` : v.unit ? `${K.unit} · ${DIM_NAME[lang][v.unit.dim]}` : K.num;
    // arredonda ruídos de ponto flutuante (720,0000000000001 → 720)
    const cellValue = (v: Value) => (v.date ? new Date(v.n) : Number(v.n.toPrecision(12)));
    const sameUnit = (a: Value, b: Value) => (a.unit?.id ?? '') === (b.unit?.id ?? '') && !!a.pct === !!b.pct;

    /** Tenta transformar a linha numa fórmula do Excel usando nomes definidos; confere o resultado. */
    const toFormula = (l: XLine, v: Value): string | null => {
      if (v.date) return null;
      let i = 0;
      const segs = l.segments;
      // pula rótulo/atribuição no começo
      while (i < segs.length && (segs[i].cls === 'label' || segs[i].cls === 'assign' || (segs[i].cls === 'op' && segs[i].text.trim() === '=' && i <= 2) || (segs[i].cls === 'text' && !segs[i].text.trim()))) i++;
      let f = '';
      let js = '';
      let refs = 0;
      let ops = 0;
      for (; i < segs.length; i++) {
        const s = segs[i];
        const t = s.text;
        if (s.cls === 'text' || s.cls === 'cmt') {
          if (t.trim() && !t.trim().startsWith('//')) return null;
          continue;
        }
        if (s.cls === 'num') {
          const n = parseNumber(t, ctx.decimal);
          if (!isFinite(n)) return null;
          f += String(n);
          js += `(${n})`;
        } else if (s.cls === 'var') {
          const ref = names.get(fold(t.trim()));
          if (!ref || ref.v.date) return null;
          f += ref.name;
          js += `(${ref.v.n})`;
          refs++;
        } else if (s.cls === 'paren') {
          f += t;
          js += t;
        } else if (s.cls === 'op') {
          const o = t.trim();
          const m = o === '×' || o === 'x' || o === '·' || o === '*' ? '*' : o === '÷' || o === '/' ? '/' : o === '−' || o === '–' || o === '-' ? '-' : o === '+' ? '+' : o === '^' || o === '**' ? '^' : null;
          if (!m) return null;
          f += m;
          js += m === '^' ? '**' : m;
          ops++;
        } else return null;
      }
      if (!refs || !ops || !/^[\d.()+\-*/ e]+$/.test(js.replace(/\*\*/g, '*'))) return null;
      try {
        const got = Function(`"use strict";return (${js});`)() as number;
        const want = v.pct ? v.n : v.n;
        if (!isFinite(got) || Math.abs(got - want) > Math.max(1e-9, Math.abs(want) * 1e-9)) return null;
        return f;
      } catch {
        return null;
      }
    };

    const addValueRow = (l: XLine) => {
      const v = l.value!;
      const row = ws.getRow(r);
      let kind = l.assigned ? K.var : kindLabel(v);
      let formula: string | null = null;
      if (l.aggregate && group.length) {
        const same = group.filter((g) => sameUnit(g.v, v));
        if (same.length === group.length) {
          const sum = group.reduce((a, g) => a + g.v.n, 0);
          const avg = sum / group.length;
          const range = `D${group[0].row}:D${group[group.length - 1].row}`;
          const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);
          if (close(sum, v.n)) {
            formula = `SUM(${range})`;
            kind = K.sum;
          } else if (close(avg, v.n)) {
            formula = `AVERAGE(${range})`;
            kind = K.avg;
          }
        }
      }
      if (!formula && !l.aggregate) {
        formula = toFormula(l, v);
        if (formula && !l.assigned) kind = `${kindLabel(v)} · ${K.formula}`;
      }
      row.getCell(1).value = section;
      row.getCell(2).value = describe(l);
      row.getCell(3).value = l.text.trim();
      row.getCell(4).value = formula ? { formula, result: cellValue(v) as number } : cellValue(v);
      row.getCell(4).numFmt = numFmt(v, ctx);
      row.getCell(5).value = unitLabel(v);
      row.getCell(6).value = kind;
      style(row, { bold: !!l.aggregate, tinted: !!l.aggregate });
      // variáveis e rótulos viram nomes definidos para as fórmulas seguintes
      const key = l.assigned ?? (l.label ? fold(l.label) : undefined);
      if (key && !l.aggregate) {
        const nm = definedName(l.label ?? key, usedNames);
        if (nm) {
          wb.definedNames.add(`'${name.replace(/'/g, "''")}'!$D$${r}`, nm);
          names.set(fold(key), { name: nm, v });
        }
      } else if (key && l.aggregate) {
        const nm = definedName(l.label ?? key, usedNames);
        if (nm) {
          wb.definedNames.add(`'${name.replace(/'/g, "''")}'!$D$${r}`, nm);
          names.set(fold(key), { name: nm, v });
        }
      }
      if (!l.aggregate) group.push({ row: r, v });
      else lastTotal = { v: v.n, fmt: numFmt(v, ctx) };
      r++;
    };

    for (const b of x.blocks) {
      switch (b.type) {
        case 'heading':
          section = b.text;
          group = [];
          break;
        case 'calc':
          group = [];
          for (const l of b.lines) {
            if (l.kind === 'header') {
              section = l.text.replace(/^#+\s*/, '') || section;
              group = [];
            } else if (l.kind === 'empty') group = [];
            else if (l.kind === 'value' && l.value) addValueRow(l);
          }
          break;
        case 'callout': {
          const row = ws.getRow(r);
          row.getCell(1).value = T.observations;
          row.getCell(2).value = b.text;
          row.getCell(6).value = K.note;
          const prev = section;
          section = T.observations;
          style(row, { italic: true });
          section = prev;
          lastSection = T.observations;
          r++;
          break;
        }
        case 'progress': {
          const label = b.label || T.progress;
          const start = r;
          const put = (desc: string, val: number | { formula: string; result: number } | undefined, fmt: string, kind: string, tinted = false) => {
            const row = ws.getRow(r);
            row.getCell(1).value = section;
            row.getCell(2).value = desc;
            if (val !== undefined) row.getCell(4).value = val as ExcelJS.CellValue;
            row.getCell(4).numFmt = fmt;
            row.getCell(6).value = kind;
            style(row, { tinted, bold: tinted });
            r++;
          };
          put(`${label} · ${T.value}`, b.value, 'General', K.goal);
          put(`${label} · ${T.goal}`, b.goal, 'General', K.goal);
          put(`${label} · ${K.reached}`, b.value !== undefined && b.goal ? { formula: `IFERROR(D${start}/D${start + 1},0)`, result: b.pct } : undefined, '0.0%', K.reached, true);
          break;
        }
        case 'ticker':
          for (const t of b.rows) {
            const row = ws.getRow(r);
            row.getCell(1).value = T.rates;
            row.getCell(2).value = `1 ${t.code}`;
            row.getCell(3).value = `1 ${t.code} → ${b.base}`;
            row.getCell(4).value = t.text;
            row.getCell(5).value = b.base;
            row.getCell(6).value = K.rate;
            style(row);
            r++;
          }
          break;
        case 'chart': {
          // tabela de dados do gráfico ao lado (colunas H:I), pronta para "Inserir › Gráfico"
          const col0 = 8;
          const startRow = 4 + charts * (b.data.length + 4);
          charts++;
          ws.getColumn(col0).width = 26;
          ws.getColumn(col0 + 1).width = 18;
          const t = ws.getCell(startRow, col0);
          t.value = `${T.chartData}${b.title ? ': ' + b.title : ''}`;
          t.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
          t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(x.color) } };
          const t2 = ws.getCell(startRow, col0 + 1);
          t2.fill = t.fill;
          b.data.forEach((d, i) => {
            const a = ws.getCell(startRow + 1 + i, col0);
            const v = ws.getCell(startRow + 1 + i, col0 + 1);
            a.value = d.label;
            v.value = d.n;
            v.numFmt = '#,##0.00';
            a.font = v.font = { name: 'Calibri', color: { argb: argb(PRINT.text) } };
            a.fill = v.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(i % 2 ? '#ffffff' : PRINT.zebra) } };
          });
          const tot = startRow + 1 + b.data.length;
          ws.getCell(tot, col0).value = K.sum;
          ws.getCell(tot, col0 + 1).value = { formula: `SUM(${ws.getCell(startRow + 1, col0 + 1).address}:${ws.getCell(tot - 1, col0 + 1).address})`, result: b.data.reduce((a, d) => a + d.n, 0) };
          ws.getCell(tot, col0 + 1).numFmt = '#,##0.00';
          ws.getCell(tot, col0).font = ws.getCell(tot, col0 + 1).font = { name: 'Calibri', bold: true };
          break;
        }
      }
    }
    if (r > 5) ws.autoFilter = { from: 'A4', to: `F${r - 1}` };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    summary.push({ name, title: x.title, lines: r - 5, last: lastTotal });
  }

  if (sumWs) {
    const ws = sumWs;
    ws.columns = [{ width: 42 }, { width: 14 }, { width: 22 }];
    ws.getCell('A1').value = `GCP-Calc · ${T.summary}`;
    ws.getCell('A1').font = { name: 'Calibri', size: 18, bold: true };
    const h = ws.getRow(3);
    h.values = [T.notes, T.result, 'Total'];
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb('#2563eb') } };
    });
    summary.forEach((s, i) => {
      const row = ws.getRow(4 + i);
      row.getCell(1).value = { text: s.title, hyperlink: `#'${s.name.replace(/'/g, "''")}'!A1` };
      row.getCell(1).font = { color: { argb: argb('#2563eb') }, underline: true };
      row.getCell(2).value = s.lines;
      if (s.last) {
        row.getCell(3).value = s.last.v;
        row.getCell(3).numFmt = s.last.fmt;
      }
    });
  }

  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
