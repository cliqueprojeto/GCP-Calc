/**
 * Importa planilhas e documentos (Excel, CSV, TXT, Markdown e PDF) e organiza num bloco de
 * cálculo: seções (etapas, grupos, rubricas), lançamentos com quantidade × valor unitário,
 * previsto | realizado quando houver as duas colunas, totais e saldo.
 */
import { classifyTerm } from '../engine/vocab';

export type Grid = string[][];

export interface ImportOptions {
  /** símbolo da moeda usado nas linhas ("R$", "$", "€") */
  symbol: string;
  decimal: 'comma' | 'dot';
  lang: 'pt' | 'en' | 'es';
}

export interface ImportResult {
  text: string;
  sections: number;
  items: number;
  /** soma dos lançamentos importados */
  total: number;
  planned: boolean;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/* ------------------------------------------------------------------ leitura dos arquivos */

export async function readGrid(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xlsm|xls)$/.test(name)) return readExcel(await file.arrayBuffer());
  if (name.endsWith('.pdf')) return readPdf(await file.arrayBuffer());
  const text = await file.text();
  if (name.endsWith('.csv') || name.endsWith('.tsv')) return parseCsv(text);
  return parseText(text);
}

export async function readExcel(buf: ArrayBuffer): Promise<Grid> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: Grid = [];
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== 'visible') return;
    if (out.length) out.push([]);
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      const n = Math.max(row.cellCount, row.actualCellCount);
      for (let c = 1; c <= n; c++) cells.push(cellText(row.getCell(c).value));
      out.push(cells);
    });
  });
  return out;
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return cellText(o.result);
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('').trim();
    if ('text' in o) return cellText(o.text);
    if ('sharedFormula' in o || 'formula' in o) return '';
  }
  return String(v);
}

async function readPdf(buf: ArrayBuffer): Promise<Grid> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const out: Grid = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as { str: string; transform: number[]; width: number; height?: number }[]).filter((i) => i.str?.trim());
    out.push(...pdfRows(items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || i.height || 10 }))));
  }
  return out;
}

/** Junta os pedaços de texto do PDF em linhas (mesma altura) e células (espaço grande entre eles). */
export function pdfRows(items: { s: string; x: number; y: number; w: number; h: number }[]): Grid {
  const lines: (typeof items)[] = [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) <= Math.max(2, it.h * 0.35));
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => {
    l.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let end = -Infinity;
    for (const it of l) {
      const gap = it.x - end;
      if (cells.length && gap < Math.max(4, it.h * 0.9)) cells[cells.length - 1] += (gap > 0.5 ? ' ' : '') + it.s;
      else cells.push(it.s);
      end = it.x + it.w;
    }
    return cells.map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
  });
}

export function parseCsv(text: string): Grid {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const count = (d: string) => sample.split(d).length;
  const delim = ['\t', ';', ','].sort((a, b) => count(b) - count(a))[0];
  const rows: Grid = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) row.push(cell.trim()), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) row.push(cell.trim()), rows.push(row);
  return rows;
}

/** TXT e Markdown: títulos viram seções, tabelas viram linhas, "Item: R$ 10" e listas também. */
export function parseText(text: string): Grid {
  const out: Grid = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      out.push([]);
      continue;
    }
    if (/^\|?\s*:?-{3,}/.test(line)) continue; // separador de tabela markdown
    if (line.startsWith('|')) {
      out.push(line.replace(/^\||\|$/g, '').split('|').map((c) => c.replace(/\*\*/g, '').trim()));
      continue;
    }
    const h = line.match(/^#{1,6}\s+(.+)$/);
    if (h) {
      out.push(['# ' + h[1].replace(/\*\*/g, '').trim()]);
      continue;
    }
    const l = line.replace(/^([-*+•]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
    // "Item: R$ 10", "Item — R$ 10", "Item ........ 10,00", "Item\tR$ 10"
    const m = l.match(/^(.*?\p{L}.*?)\s*(?::|—|–|-{1,2}|\.{3,}|\t|\s{2,})\s*((?:R\$|US\$|\$|€|£)?\s*-?[\d.,]+(?:\s*(?:R\$|€))?(?:\s+.*)?)$/u);
    if (m) out.push([m[1].trim(), ...m[2].split(/\s{2,}|\t/).map((c) => c.trim())]);
    else out.push(l.split(/\t|\s{3,}/).map((c) => c.trim()));
  }
  return out;
}

/* ------------------------------------------------------------------ interpretação */

const MONEY_RE = /^\(?-?\s*(?:R\$|US\$|U\$|\$|€|£)?\s*-?\s*\d[\d.,\s]*(?:\s*(?:R\$|€|reais|BRL|USD|EUR))?\)?$/i;

/** Número de uma célula ("R$ 1.234,56", "1,234.56", "1234.5", "(300)") ou undefined. */
export function cellNumber(raw: string, pref: 'comma' | 'dot' = 'comma'): number | undefined {
  const s = raw.trim();
  if (!s || !MONEY_RE.test(s)) return undefined;
  const neg = /^\(.*\)$/.test(s) || /-/.test(s);
  let d = s.replace(/[^\d.,]/g, '');
  if (!d) return undefined;
  const lc = d.lastIndexOf(',');
  const ld = d.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) d = lc > ld ? d.replace(/\./g, '').replace(',', '.') : d.replace(/,/g, '');
  else if (lc >= 0) {
    const after = d.length - lc - 1;
    d = (d.split(',').length > 2 || (after === 3 && pref === 'dot')) ? d.replace(/,/g, '') : d.replace(',', '.');
  } else if (ld >= 0) {
    const after = d.length - ld - 1;
    if (d.split('.').length > 2 || (after === 3 && pref === 'comma')) d = d.replace(/\./g, '');
  }
  const n = Number(d);
  return Number.isFinite(n) ? (neg ? -n : n) : undefined;
}

type Col = 'name' | 'detail' | 'unit' | 'qty' | 'price' | 'total' | 'planned' | 'actual' | 'index' | 'occ' | 'other';

const HEAD: [Col, RegExp][] = [
  ['index', /^(ordem|n[ºo°]?\.?|item|#|c[oó]d(igo)?\.?|id|seq\.?)$/],
  ['planned', /^(meta|previsto|or[cç]ado|aprovado|valor aprovado|valor previsto|planned|budget|presupuestado)\b/],
  ['actual', /^(realizado|executado|gasto|comprovado|actual|spent|ejecutado|valor realizado|valor executado)\b/],
  ['price', /^(valor unit|vl\.? unit|vlr\.? unit|pre[cç]o unit|unit[aá]rio|unit\.?$|unit price|precio unit|r\$ unit|custo unit)/],
  ['total', /^(valor total|vl\.? total|vlr\.? total|total|subtotal|custo total|r\$ total|vl\.? solicitado|valor solicitado|amount|importe|monto|valor$|valor \(r\$\)$)/],
  ['qty', /^(qtde?\.?|quantidade|quant\.?|qty|quantity|cantidad)$/],
  ['occ', /^(ocorr[eê]ncias?|ocor\.?|ocorr\.?|vezes|repeti[cç][oõ]es|meses|dias)$/],
  ['unit', /^(unidade|unid\.?|und\.?|un\.?|unit|unidad|medida)$/],
  ['name', /^(despesa|descri[cç][aã]o|itens$|nome|rubrica|fonte|produto|servi[cç]o|categoria|description|name|concepto|descripci[oó]n|elemento|item or[cç]ament|discrimina|fun[cç][aã]o|[aá]rea)/],
  ['detail', /^(detalhamento|detalhe|especifica|observa|obs\.?|justificativa|details|detalle|profissional|fornecedor|docs\.?|an[aá]lise|cpf|cnpj|status)/],
];

function headerMap(row: string[]): Map<number, Col> | null {
  const map = new Map<number, Col>();
  row.forEach((c, i) => {
    const f = fold(c ?? '').replace(/\s+/g, ' ').replace(/[:*]/g, '').trim();
    if (!f || f.length > 45 || /\d{2,}/.test(f)) return;
    for (const [col, re] of HEAD) {
      if (re.test(f) && (col === 'detail' || col === 'occ' || ![...map.values()].includes(col))) {
        map.set(i, col);
        break;
      }
    }
  });
  const cols = new Set(map.values());
  const numeric = ['qty', 'price', 'total', 'planned', 'actual'].filter((c) => cols.has(c as Col)).length;
  return map.size >= 2 && numeric >= 1 ? map : null;
}
const signature = (m: Map<number, Col>) => [...new Set(m.values())].filter((c) => c !== 'detail').sort().join(',');

const TOTAL_RE = /^(sub)?total\b|^soma\b|^valor total do|^grand total|^total geral/i;
const STOP_RE = /^(resumo financeiro|quadro resumo|consolidado|summary|resumen)\b/i;
const SECTION_HINT = /^(grupo|etapa|fase|bloco|categoria|rubrica|despesas?|receitas?|fontes?|pr[ée]-produ[cç][aã]o|p[oó]s-produ[cç][aã]o|produ[cç][aã]o|divulga[cç][aã]o|administra[cç][aã]o|comunica[cç][aã]o|equipe|ingresos|gastos|income|expenses)\b/i;
const CONNECTOR_END = /(,|\/|\s(e|de|da|do|das|dos|para|ou|com|em|and|of|for|y|del|la)|-)$/i;

interface Item {
  label: string;
  /** texto original do nome (para juntar as linhas quebradas do PDF) */
  rawLabel?: string;
  qty?: number;
  unit?: string;
  price?: number;
  total?: number;
  planned?: number;
  actual?: number;
}
interface Group {
  name: string;
  kind: 'income' | 'expense';
  items: Item[];
}

/** Rótulo seguro para a linha de cálculo (sem dígitos soltos, barras, parênteses, ":" ou "="). */
export function cleanLabel(s: string): string {
  let t = s
    .replace(/^\s*(?:\d+(?:[.,]\d+)*[.)\-–—]?\s*[-–—]?\s*)+/, '') // "1.2 - ", "2.01 "
    .replace(/\([^)]*\)?/g, ' ')
    .replace(/\be\s*\/\s*ou\b/gi, 'e ou')
    .replace(/[/\\|]/g, ' e ')
    .replace(/[:=*#"“”;[\]{}<>+()]/g, ' ')
    .replace(/\d+[ªº°]?/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, '')
    .trim();
  if (t.length > 60) t = t.slice(0, 60).replace(/\s+\S*$/, '');
  while (/\s(e|de|da|do|das|dos|para|ou|com|a|o)$/i.test(t)) t = t.replace(/\s+\S+$/, '').replace(/[,\s]+$/, '');
  if (t && t === t.toUpperCase() && /\p{Lu}{3,}/u.test(t)) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

/** Nome de grupo: "Grupo 1 - Comunicação | R$ 1.200", "Despesas - Equipe – Recursos do…", "ADMINISTRAÇÃO * Atenção…" */
function groupName(raw: string): { name: string; kind?: 'income' | 'expense' } {
  let t = raw.replace(/^#\s*/, '').trim();
  let kind: 'income' | 'expense' | undefined;
  const pre = t.match(/^(despesas?|receitas?|fontes?|gastos|ingresos|expenses|income)\s*[-–—:]\s*(.+)$/i);
  if (pre) {
    kind = /^(receit|font|ingres|income)/i.test(pre[1]) ? 'income' : 'expense';
    t = pre[2];
  }
  t = t
    .replace(/^(grupo|etapa|fase|meta|bloco|item|group|stage)\s*\d+(?:\.\d+)*\s*[-–—:.]?\s*/i, '')
    .replace(/\s*\|\s*(?:R\$|US\$|\$|€).*$/, '')
    .split(/\s+[–|]\s+|\s+\*\s*|\s+-\s+(?=recursos\b)/i)[0];
  return { name: cleanLabel(t), kind };
}

const nonEmpty = (r: string[]) => r.map((c) => (c ?? '').trim()).filter(Boolean);
const isCaps = (s: string) => /\p{Lu}{3}/u.test(s) && s === s.toUpperCase();

/** Monta grupos e lançamentos a partir das linhas. */
export function interpret(grid: Grid, pref: 'comma' | 'dot' = 'comma'): Group[] {
  const groups: Group[] = [];
  let cur: Group | undefined;
  let head: Map<number, Col> | null = null;
  let headLen = 0;
  let skipping = false;
  let curStrong = false;
  let last: Item | undefined;
  // tabela principal: o tipo de cabeçalho com mais linhas de valores embaixo (orçamento, não resumo/equipe)
  const score = new Map<string, number>();
  let curSig: string | undefined;
  for (const row of grid) {
    const hm = headerMap(row);
    if (hm) curSig = signature(hm);
    else if (curSig && nonEmpty(row).some((c) => cellNumber(c, pref) !== undefined)) score.set(curSig, (score.get(curSig) ?? 0) + 1);
  }
  const mainSig = [...score.entries()].sort((a, b) => b[1] - a[1] || b[0].split(',').length - a[0].split(',').length)[0]?.[0];
  const hasHeader = !!mainSig;
  let afterHeader = false;
  const group = (raw: string) => {
    const g = groupName(raw);
    if (!g.name || g.name.length < 2) return;
    const kind = g.kind ?? (/capta[cç][aã]o de recursos|remunera[cç][aã]o|custos? /i.test(g.name) ? 'expense' : undefined) ?? (classifyTerm(g.name) === 'income' || /^(receitas?|fontes?|ingresos?|income|revenue|patroc[ií]nio)\b/i.test(g.name) ? 'income' : 'expense');
    cur = groups.find((x) => fold(x.name) === fold(g.name));
    if (!cur) groups.push((cur = { name: g.name, kind, items: [] }));
    last = undefined;
  };
  for (let r = 0; r < grid.length; r++) {
    const raw = grid[r];
    const cells = nonEmpty(raw);
    if (!cells.length) continue;
    const first = fold(cells[0]);
    if (STOP_RE.test(first) && groups.some((g) => g.items.length)) break;
    // "# Título" (TXT/Markdown) é sempre seção
    if (cells.length === 1 && cells[0].startsWith('# ')) {
      group(cells[0]);
      continue;
    }
    const hm = headerMap(raw);
    if (hm) {
      // outra tabela (resumo, equipe, cronograma…): ignora até voltar a tabela do orçamento
      skipping = signature(hm) !== mainSig;
      head = hm;
      headLen = nonEmpty(raw).length;
      last = undefined;
      afterHeader = true;
      continue;
    }
    const nums = cells.map((c) => cellNumber(c, pref));
    const numCount = nums.filter((n) => n !== undefined).length;
    const texts = cells.filter((_, i) => nums[i] === undefined && /\p{L}/u.test(cells[i]));
    if (texts.some((t) => TOTAL_RE.test(fold(t).replace(/^\d+[.)]?\s*/, '')))) {
      last = undefined;
      continue;
    }
    const uniq = [...new Set(cells.map(fold))];
    const nextHeader = (() => {
      for (let k = r + 1; k < Math.min(grid.length, r + 4); k++) if (nonEmpty(grid[k]).length) return !!headerMap(grid[k]);
      return false;
    })();
    const wasAfterHeader = afterHeader;
    afterHeader = false;
    if (numCount === 0) {
      // linha quebrada do PDF: continua o nome do lançamento anterior (que terminou em "de", ",", "e"…)
      const sectionish = isCaps(cells[0]) || /^\d+\s*[-–.]\s*\p{Lu}/u.test(cells[0]) || /^(grupo|etapa|fase)\s*\d/i.test(cells[0]);
      if (last?.rawLabel && cells.length <= 2 && !nextHeader && !sectionish && CONNECTOR_END.test(last.rawLabel)) {
        last.rawLabel = `${last.rawLabel} ${cells[0]}`;
        last.label = cleanLabel(last.rawLabel);
        if (!CONNECTOR_END.test(cells[0])) last.rawLabel = undefined;
        continue;
      }
      if (last && !last.rawLabel && cells.length <= 2 && /^\p{Ll}/u.test(cells[0])) continue;
      last = undefined;
      // título de seção (células mescladas repetem o texto)
      const title = uniq.length === 1 && /\p{L}{3}/u.test(cells[0]) && cells[0].length <= 90 && !wasAfterHeader;
      const inTable = !!head || groups.some((g) => g.items.length);
      const titleLike = /^[\p{Lu}\d]/u.test(cells[0]) && cells[0].length <= 45 && !CONNECTOR_END.test(cells[0]) && !/[.;]$/.test(cells[0]);
      const strong = isCaps(cells[0]) || /^\d+\s*[-–.]\s*\p{Lu}/u.test(cells[0]);
      if (title && !CONNECTOR_END.test(cells[0]) && (!inTable || strong || (SECTION_HINT.test(first) && titleLike && !hasHeader) || nextHeader)) {
        // "MG - Nova Lima" logo depois de "1 - Pré-produção": fica a etapa
        if (!strong && curStrong && cur && !cur.items.length) continue;
        curStrong = strong;
        group(cells[0]);
        skipping = skipping && !nextHeader ? skipping : false;
        continue;
      }
      // tabela que não é de orçamento (cabeçalho sem valores)
      if (cells.length >= 3 && cells.every((c) => c.length <= 30) && groups.some((g) => g.items.length) && !nextHeader) skipping = true;
      last = undefined;
      continue;
    }
    // "Grupo 1 - Comunicação | R$ 1.200,00" / "Grupo 1 - Comunicação" "R$ 1.200,00"
    if (texts.length === 1 && numCount <= 1 && /^(grupo|etapa|fase|meta|bloco)\s*\d/i.test(first)) {
      group(texts[0]);
      continue;
    }
    if (skipping || (hasHeader && !head) || !texts.length) continue;
    const aligned = head && Math.abs(cells.length - headLen) <= 0 && [...head.values()].includes('name');
    const it = aligned ? byHeader(raw, head!, pref) : byShape(cells, nums);
    if (!it || !it.label) continue;
    if (it.total === undefined && it.qty && it.price) it.total = it.qty * it.price;
    if (it.total === undefined && it.actual === undefined && it.planned === undefined) continue;
    if (!cur) group(classifyTerm(it.label) === 'income' ? 'Receitas' : 'Despesas');
    // mesmo item, mesmo valor, no mesmo grupo: junta em quantidade ("9 × Cachê de músico")
    const same = cur!.items.find((x) => fold(x.label) === fold(it.label) && x.planned === undefined && it.planned === undefined && (x.price ?? x.total) === (it.price ?? it.total) && (x.qty ?? 1) >= 1);
    if (same && it.total !== undefined) {
      const unitP = same.price ?? same.total! / (same.qty ?? 1);
      same.qty = (same.qty ?? 1) + (it.qty ?? 1);
      same.price = unitP;
      same.total = (same.total ?? 0) + it.total;
      last = same;
      continue;
    }
    cur!.items.push(it);
    last = it;
  }
  // tabelas-resumo: grupo cujos itens são os nomes dos outros grupos
  const names = new Set(groups.map((g) => fold(g.name)));
  return groups.filter((g) => g.items.length && !(g.items.length > 1 && g.items.every((i) => names.has(fold(i.label)))));
}

function byHeader(raw: string[], head: Map<number, Col>, pref: 'comma' | 'dot'): Item | null {
  const get = (c: Col) => {
    for (const [i, col] of head) if (col === c) return (raw[i] ?? '').trim();
    return '';
  };
  let name = get('name');
  if (!/\p{L}/u.test(name)) {
    const used = new Set([...head.entries()].filter(([, c]) => c !== 'name').map(([i]) => i));
    name = raw.find((c, i) => !used.has(i) && /\p{L}{2}/u.test(c ?? '') && cellNumber(c, pref) === undefined) ?? '';
  }
  const label = cleanLabel(name);
  if (!label) return null;
  let qty = cellNumber(get('qty'), pref);
  let unit = get('unit');
  const qm = get('qty').match(/^(\d+(?:[.,]\d+)?)\s+(\p{L}[\p{L}.]*)$/u);
  if (qm) (qty = cellNumber(qm[1], pref)), (unit ||= qm[2]);
  let occ: number | undefined;
  for (const [i, col] of head) if (col === 'occ') { const n = cellNumber(raw[i] ?? '', pref); if (n) occ = (occ ?? 1) * n; }
  if (occ && qty) qty *= occ;
  else if (occ && !qty) qty = occ;
  return {
    label,
    rawLabel: name,
    qty,
    unit: unit || undefined,
    price: cellNumber(get('price'), pref),
    total: cellNumber(get('total'), pref),
    planned: cellNumber(get('planned'), pref),
    actual: cellNumber(get('actual'), pref),
  };
}

/** Sem cabeçalho alinhado: nome = texto principal; penúltimo número = unitário, último = total. */
function byShape(cells: string[], nums: (number | undefined)[]): Item | null {
  const values: number[] = [];
  let label = '';
  let unit: string | undefined;
  let raw = '';
  cells.forEach((c, i) => {
    if (/%\s*$/.test(c)) return;
    if (nums[i] !== undefined) {
      // índice no começo ("1", "2.01") não é valor
      if (!values.length && !label && /^\d+(\.\d+)*\.?$/.test(c) && i < cells.length - 1) return;
      if (label || values.length) values.push(nums[i]!);
    } else if (/\p{L}/u.test(c)) {
      const qm = c.match(/^(\d+(?:[.,]\d+)?)\s+(\p{L}[\p{L}.]*)$/u);
      if (qm && label) {
        values.push(Number(qm[1].replace(',', '.')));
        unit = qm[2];
      } else if (!label) label = c;
    }
  });
  raw = label;
  label = cleanLabel(label);
  if (!label || !values.length) return null;
  const total = values[values.length - 1];
  if (values.length >= 2) {
    const price = values[values.length - 2];
    const q = price ? total / price : 0;
    if (q > 1 && Math.abs(q - Math.round(q)) < 1e-6 && q < 100000) return { label, rawLabel: raw, qty: Math.round(q), price, total, unit };
    if (Math.abs(q - 1) < 1e-9) return { label, rawLabel: raw, total, unit };
  }
  return { label, rawLabel: raw, total, unit };
}

/* ------------------------------------------------------------------ texto da nota */

export function formatMoney(n: number, o: ImportOptions): string {
  const neg = n < 0;
  const a = Math.abs(n);
  const cents = Math.round(a * 100) % 100 !== 0;
  const [int, dec] = a.toFixed(cents ? 2 : 0).split('.');
  const th = o.decimal === 'comma' ? '.' : ',';
  const ds = o.decimal === 'comma' ? ',' : '.';
  const body = int.replace(/\B(?=(\d{3})+(?!\d))/g, th) + (dec ? ds + dec : '');
  return `${neg ? '-' : ''}${o.symbol}${o.symbol === '$' ? '' : ' '}${body}`;
}

const MONTH_RE = /^(m[eê]s|meses|mensal|month|months|mes)$/i;
const qtyNum = (n: number, o: ImportOptions) => (Number.isInteger(n) ? String(n) : String(n).replace('.', o.decimal === 'comma' ? ',' : '.'));

const WORDS = {
  pt: { inc: 'Receitas', exp: 'Despesas', planned: 'Previsto', actual: 'Realizado', rest: 'Saldo a executar', exec: '% Executado', todo: '% A executar', months: 'meses', bal: 'Saldo' },
  en: { inc: 'Income', exp: 'Expenses', planned: 'Planned', actual: 'Actual', rest: 'Remaining', exec: '% Executed', todo: '% To execute', months: 'months', bal: 'Balance' },
  es: { inc: 'Ingresos', exp: 'Gastos', planned: 'Previsto', actual: 'Realizado', rest: 'Por ejecutar', exec: '% Ejecutado', todo: '% Por ejecutar', months: 'meses', bal: 'Saldo' },
} as const;

export function gridToText(grid: Grid, o: ImportOptions, title?: string): ImportResult {
  const groups = interpret(grid, o.decimal);
  const w = WORDS[o.lang];
  const planned = groups.some((g) => g.items.some((i) => i.planned !== undefined && i.actual !== undefined));
  const out: string[] = [];
  if (title) out.push(`// ${title}`);
  let items = 0;
  let total = 0;
  const line = (it: Item) => {
    items++;
    if (planned && it.planned !== undefined && it.actual !== undefined) {
      total += it.actual;
      return `${it.label}: ${formatMoney(it.planned, o)} | ${formatMoney(it.actual, o)}`;
    }
    const tot = it.total ?? it.actual ?? it.planned ?? 0;
    total += tot;
    if (it.qty && it.price && it.qty !== 1 && Math.abs(it.qty * it.price - tot) < Math.max(0.05, Math.abs(tot) * 0.001)) {
      if (it.unit && MONTH_RE.test(fold(it.unit))) return `${it.label}: ${formatMoney(it.price, o)} * ${qtyNum(it.qty, o)} ${w.months}`;
      return `${it.label}: ${qtyNum(it.qty, o)} * ${formatMoney(it.price, o)}`;
    }
    return `${it.label}: ${formatMoney(tot, o)}`;
  };
  const kinds: ('income' | 'expense')[] = ['income', 'expense'];
  for (const kind of kinds) {
    const gs = groups.filter((g) => g.kind === kind);
    if (!gs.length) continue;
    const top = kind === 'income' ? w.inc : w.exp;
    // um único grupo com o mesmo nome do tipo: sem subtítulo
    const flat = gs.length === 1 && fold(gs[0].name) === fold(top);
    if (out.length) out.push('');
    out.push(`# ${top}`);
    for (const g of gs) {
      if (!flat && fold(g.name) !== fold(top)) out.push(`## ${g.name}`);
      for (const it of g.items) out.push(line(it));
    }
    out.push('', `Total #${top}`);
  }
  const hasInc = groups.some((g) => g.kind === 'income');
  const hasExp = groups.some((g) => g.kind === 'expense');
  if (planned) {
    const t = hasExp ? w.exp : w.inc;
    out.push(`${w.planned} #${t}`, `${w.actual} #${t}`, `${w.rest} #${t}`, w.exec, w.todo);
  }
  if (hasInc && hasExp) out.push(w.bal);
  return { text: out.join('\n'), sections: groups.length, items, total, planned };
}
