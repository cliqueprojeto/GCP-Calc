/** Exportação de notas: PDF, Word, PowerPoint e Excel. */
import { currentContext, formatOptions } from '../lib/calcContext';
import { saveBinaryFile } from '../lib/platform';
import type { Note } from '../lib/types';
import { useData } from '../store/data';
import { buildExport, fileBase } from './model';

export type ExportFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';

const META: Record<ExportFormat, { ext: string; name: string; mime: string }> = {
  pdf: { ext: 'pdf', name: 'PDF', mime: 'application/pdf' },
  docx: { ext: 'docx', name: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pptx: { ext: 'pptx', name: 'PowerPoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  xlsx: { ext: 'xlsx', name: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};

/** Gera os bytes do arquivo (usado também pelos testes). */
export async function renderNote(note: Note, format: ExportFormat): Promise<Uint8Array> {
  const ctx = currentContext();
  const fmt = formatOptions(ctx);
  const base = useData.getState().settings.baseCurrency;
  const x = await buildExport(note, ctx, fmt, { base, withImages: format !== 'xlsx' });
  switch (format) {
    case 'pdf':
      return (await import('./pdf')).exportPdf(x);
    case 'docx':
      return (await import('./docx')).exportDocx(x);
    case 'pptx':
      return (await import('./pptx')).exportPptx(x);
    case 'xlsx':
      return (await import('./xlsx')).exportXlsx([{ x, ctx }]);
  }
}

export async function exportNote(note: Note, format: ExportFormat): Promise<string | null> {
  const bytes = await renderNote(note, format);
  const m = META[format];
  return saveBinaryFile(`${fileBase(note.title)}.${m.ext}`, bytes, [{ name: m.name, extensions: [m.ext] }], m.mime);
}

/** Todas as notas num único Excel (uma aba por nota + resumo). */
export async function exportAllXlsx(notes: Note[]): Promise<string | null> {
  const ctx = currentContext();
  const fmt = formatOptions(ctx);
  const base = useData.getState().settings.baseCurrency;
  const docs = [];
  for (const n of notes) docs.push({ x: await buildExport(n, ctx, fmt, { base, withImages: false }), ctx });
  const bytes = await (await import('./xlsx')).exportXlsx(docs);
  const d = new Date().toISOString().slice(0, 10);
  return saveBinaryFile(`GCP-Calc-${d}.xlsx`, bytes, [{ name: 'Excel', extensions: ['xlsx'] }], META.xlsx.mime);
}
