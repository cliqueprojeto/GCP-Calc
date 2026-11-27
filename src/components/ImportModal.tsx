/** Importar planilha ou documento (Excel, CSV, TXT, Markdown, PDF) e organizar num bloco de cálculo. */
import { useRef, useState } from 'react';
import { FileSpreadsheet, FileUp, Loader2 } from 'lucide-react';
import { Modal } from './ui';
import { Preview } from './OrganizeModal';
import { currencySymbol, type EvalContext, type FormatOptions } from '../engine/value';
import { gridToText, readGrid, type ImportResult } from '../lib/importer';
import { toast } from '../store/ui';
import { useT } from '../i18n';

export const IMPORT_ACCEPT = '.xlsx,.xlsm,.xls,.csv,.tsv,.txt,.md,.markdown,.pdf';

export function ImportModal({
  ctx,
  fmt,
  baseCurrency,
  onInsert,
  onClose,
}: {
  ctx: EvalContext;
  fmt: FormatOptions;
  baseCurrency: string;
  onInsert(text: string, title: string, asNote: boolean): void;
  onClose(): void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<string>('');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setFile(f.name);
    try {
      const grid = await readGrid(f);
      const symbol = currencySymbol(baseCurrency, { lang: ctx.lang, tags: ctx.tags });
      const title = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
      const r = gridToText(grid, { symbol, decimal: ctx.decimal, lang: ctx.lang }, title);
      if (!r.items) {
        setRes(null);
        toast(t('imp.none'), 'error');
      } else {
        setRes(r);
        setText(r.text);
      }
    } catch (e) {
      console.error(e);
      toast(t('imp.fail'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const title = file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

  return (
    <Modal open onClose={onClose} wide title={<><FileSpreadsheet size={16} /> {t('imp.title')}</>}>
      <div className="imp">
        <input ref={input} type="file" hidden accept={IMPORT_ACCEPT} onChange={(e) => void pick(e.target.files?.[0])} />
        <div
          className={`imp-drop ${busy ? 'busy' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
        >
          {busy ? <Loader2 size={22} className="spin" /> : <FileUp size={22} />}
          <strong>{file || t('imp.pick')}</strong>
          <small>{t('imp.formats')}</small>
        </div>
        {res && (
          <>
            <div className="imp-stats">
              {t('imp.stats', { s: res.sections, i: res.items })}
              {res.planned && <span className="res-pvr ok">{t('cmp.modePvr')}</span>}
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={() => setEdit((x) => !x)}>
                {edit ? t('imp.preview') : t('imp.edit')}
              </button>
            </div>
            {edit ? <textarea className="imp-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} /> : <Preview text={text} ctx={ctx} fmt={fmt} />}
            <p className="imp-hint">{t('imp.hint')}</p>
            <div className="btn-row">
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={onClose}>
                {t('common.close')}
              </button>
              <button className="btn" onClick={() => (onInsert(text, title, true), onClose())}>
                {t('imp.asNote')}
              </button>
              <button className="btn primary" onClick={() => (onInsert(text, title, false), onClose())}>
                {t('imp.insert')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
