/** Comprovantes do bloco: miniaturas, visualizador (ampliar, baixar, excluir) e escolha câmera/arquivo. */
import { useEffect, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Paperclip, Trash2 } from 'lucide-react';
import type { Attachment } from '../lib/types';
import { dataUrlBytes, filesToAttachments, pickFiles } from '../lib/attachments';
import { isMobile, saveBinaryFile } from '../lib/platform';
import { toast } from '../store/ui';
import { useLang, useT, LOCALES, type TKey } from '../i18n';
import { Modal } from './ui';
import { askConfirm } from './Dialogs';

/** Câmera ou arquivo (no computador vai direto para os arquivos). */
export async function attachFlow(camera: boolean | undefined, line: string | undefined, onAdd: (a: Attachment[]) => void, t: (k: TKey, v?: Record<string, string | number>) => string) {
  const files = await pickFiles(!!camera);
  if (!files.length) return;
  const { ok, skipped } = await filesToAttachments(files, line);
  if (ok.length) {
    onAdd(ok);
    toast(t('att.added', { n: ok.length }), 'ok');
  }
  if (skipped.length) toast(t('att.skipped', { names: skipped.join(', ').slice(0, 80) }), 'error');
}

export function AttachChooser({ open, onClose, onPick }: { open: boolean; onClose(): void; onPick(camera: boolean): void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={t('att.add')} className="att-chooser">
      <div className="att-choices">
        <button onClick={() => (onClose(), onPick(true))}>
          <Camera size={26} />
          <b>{t('att.camera')}</b>
          <small>{t('att.cameraHint')}</small>
        </button>
        <button onClick={() => (onClose(), onPick(false))}>
          <FolderOpen size={26} />
          <b>{t('att.files')}</b>
          <small>{t('att.filesHint')}</small>
        </button>
      </div>
    </Modal>
  );
}

export function ReceiptViewer({ items, index, labelOf, onIndex, onDelete, onClose }: { items: Attachment[]; index: number; labelOf(a: Attachment): string | undefined; onIndex(i: number): void; onDelete(a: Attachment): void; onClose(): void }) {
  const t = useT();
  const lang = useLang();
  const a = items[index];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndex(Math.min(items.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, items.length, onIndex]);
  if (!a) return null;
  const label = labelOf(a);
  return (
    <Modal open onClose={onClose} title={label || t('att.receipt')} wide className="att-viewer">
      <div className="att-stage">
        {index > 0 && (
          <button className="att-nav prev" onClick={() => onIndex(index - 1)}>
            <ChevronLeft size={22} />
          </button>
        )}
        {a.mime.startsWith('image/') ? (
          <img src={a.src} alt={a.name} />
        ) : (
          <div className="att-pdf">
            <FileText size={48} />
            <b>{a.name}</b>
            <small>PDF</small>
          </div>
        )}
        {index < items.length - 1 && (
          <button className="att-nav next" onClick={() => onIndex(index + 1)}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>
      <div className="att-meta">
        <span>
          {a.name} · {new Date(a.created).toLocaleString(LOCALES[lang], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {index + 1}/{items.length}
        </span>
        <div className="btn-row">
          <button
            className="btn small"
            onClick={async () => {
              const p = await saveBinaryFile(a.name, dataUrlBytes(a.src), [{ name: a.mime.includes('pdf') ? 'PDF' : 'JPEG', extensions: [a.mime.includes('pdf') ? 'pdf' : 'jpg'] }]);
              if (p) toast(t('att.saved'), 'ok');
            }}
          >
            <Download size={14} /> {t('att.download')}
          </button>
          <button
            className="btn small danger-text"
            onClick={async () => {
              if (!(await askConfirm({ message: t('att.confirmDelete'), danger: true, ok: t('common.delete') }))) return;
              onDelete(a);
              if (items.length <= 1) onClose();
              else onIndex(Math.max(0, index - 1));
            }}
          >
            <Trash2 size={14} /> {t('att.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Miniaturas sob o bloco. */
export function ReceiptsStrip({ items, labelOf, onOpen, onAdd }: { items: Attachment[]; labelOf(a: Attachment): string | undefined; onOpen(i: number): void; onAdd(): void }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div className="att-strip">
      <span className="att-title">
        <Paperclip size={13} /> {t('att.title', { n: items.length })}
      </span>
      <div className="att-thumbs">
        {items.map((a, i) => (
          <button key={a.id} className="att-thumb" onClick={() => onOpen(i)} title={labelOf(a) ?? a.name}>
            {a.mime.startsWith('image/') ? <img src={a.src} alt="" loading="lazy" /> : <FileText size={22} />}
            {labelOf(a) && <span>{labelOf(a)}</span>}
          </button>
        ))}
        <button className="att-thumb add" onClick={onAdd} title={t('att.add')}>
          {isMobile ? <Camera size={20} /> : <Paperclip size={20} />}
        </button>
      </div>
    </div>
  );
}

