/** Modelos do usuário: salvar a nota como modelo, compartilhar e importar de outras pessoas. */
import { useState } from 'react';
import { ClipboardPaste, Copy, FileDown, FileUp, Share2, Trash2 } from 'lucide-react';
import { Field, Menu, MenuItem, Modal } from './ui';
import { IconPicker } from './IconPicker';
import { COLORS, NoteIcon } from '../lib/icons';
import { copyText, pickTextFile, saveTextFile } from '../lib/platform';
import { fileNameFor, parseShared, shareCode, shareFile, templateFromNote } from '../lib/templateShare';
import type { Note, UserTemplate } from '../lib/types';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { useT } from '../i18n';

export const TEMPLATE_FILTERS = [{ name: 'GCP-Calc', extensions: ['gcptpl', 'json'] }];

/** Formulário comum: nome, descrição, ícone e cor. */
function TemplateForm({ value, onChange }: { value: { title: string; desc: string; icon: string; color: string }; onChange(v: Partial<{ title: string; desc: string; icon: string; color: string }>): void }) {
  const t = useT();
  const [pick, setPick] = useState(false);
  return (
    <div className="tpl-form">
      <div className="tpl-form-top">
        <button className="tpl-form-icon" style={{ color: value.color, borderColor: value.color }} onClick={() => setPick(true)} title={t('note.changeIcon')}>
          <NoteIcon name={value.icon} size={30} />
        </button>
        <div style={{ flex: 1 }}>
          <Field label={t('tpl.name')}>
            <input className="input" value={value.title} onChange={(e) => onChange({ title: e.target.value })} autoFocus />
          </Field>
        </div>
      </div>
      <Field label={t('tpl.desc')}>
        <input className="input" value={value.desc} onChange={(e) => onChange({ desc: e.target.value })} placeholder={t('tpl.descPh')} />
      </Field>
      <Field label={t('tpl.color')}>
        <div className="ip-colors">
          {COLORS.map((c) => (
            <button key={c} className={value.color === c ? 'on' : ''} style={{ background: c }} onClick={() => onChange({ color: c })} aria-label={c} />
          ))}
          <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} title={t('tpl.color')} />
        </div>
      </Field>
      <IconPicker open={pick} onClose={() => setPick(false)} onPick={(icon) => (onChange({ icon }), setPick(false))} color={value.color} onColor={(color) => onChange({ color })} />
    </div>
  );
}

export function SaveTemplateModal({ note, open, onClose }: { note: Note; open: boolean; onClose(): void }) {
  const t = useT();
  const saveTemplate = useData((s) => s.saveTemplate);
  const [v, setV] = useState({ title: note.title || t('note.untitled'), desc: '', icon: note.icon, color: note.color });
  return (
    <Modal open={open} onClose={onClose} title={t('tpl.saveTitle')}>
      <p className="muted small">{t('tpl.saveHint')}</p>
      <TemplateForm value={v} onChange={(p) => setV({ ...v, ...p })} />
      <div className="btn-row">
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
        <button
          className="btn primary"
          disabled={!v.title.trim()}
          onClick={() => {
            saveTemplate(templateFromNote(note, v.title.trim(), v.desc.trim(), v.icon, v.color));
            toast(t('tpl.saved'), 'ok');
            onClose();
          }}
        >
          {t('tpl.save')}
        </button>
      </div>
    </Modal>
  );
}

export function EditTemplateModal({ tpl, onClose }: { tpl: UserTemplate | null; onClose(): void }) {
  const t = useT();
  const saveTemplate = useData((s) => s.saveTemplate);
  const [v, setV] = useState(tpl ? { title: tpl.title, desc: tpl.desc, icon: tpl.icon, color: tpl.color } : { title: '', desc: '', icon: 'Calculator', color: '#8b5cf6' });
  if (!tpl) return null;
  return (
    <Modal open onClose={onClose} title={t('tpl.editTitle')}>
      <TemplateForm value={v} onChange={(p) => setV({ ...v, ...p })} />
      <div className="btn-row">
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
        <button
          className="btn primary"
          disabled={!v.title.trim()}
          onClick={() => {
            saveTemplate({ ...tpl, ...v, title: v.title.trim() });
            onClose();
          }}
        >
          {t('tpl.save')}
        </button>
      </div>
    </Modal>
  );
}

export function ImportTemplateModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const saveTemplate = useData((s) => s.saveTemplate);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Omit<UserTemplate, 'updated'> | null>(null);
  const read = (text: string) => {
    try {
      setPreview(parseShared(text));
    } catch {
      setPreview(null);
      toast(t('tpl.invalid'), 'error');
    }
  };
  const close = () => {
    setCode('');
    setPreview(null);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={t('tpl.importTitle')}>
      {!preview ? (
        <>
          <p className="muted small">{t('tpl.importHint')}</p>
          <textarea className="input tpl-code" rows={4} value={code} onChange={(e) => setCode(e.target.value)} placeholder="GCPCALC1:…" />
          <div className="btn-row">
            <button
              className="btn"
              onClick={async () => {
                const f = await pickTextFile(TEMPLATE_FILTERS);
                if (f) read(f.text);
              }}
            >
              <FileUp size={15} /> {t('tpl.fromFile')}
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const s = await navigator.clipboard.readText();
                  setCode(s);
                } catch {
                  /* sem permissão: o usuário cola manualmente */
                }
              }}
            >
              <ClipboardPaste size={15} /> {t('tpl.paste')}
            </button>
            <button className="btn primary" disabled={!code.trim()} onClick={() => read(code)}>
              {t('tpl.read')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="tpl-card static" style={{ '--c': preview.color } as React.CSSProperties}>
            <div className="tpl-icon">
              <NoteIcon name={preview.icon} size={22} />
            </div>
            <h3>{preview.title}</h3>
            <p>{preview.desc}</p>
            {preview.author && <p className="muted small">{t('tpl.by', { name: preview.author })}</p>}
            <p className="muted small">{t('tpl.blocks', { n: preview.blocks.length })}</p>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => setPreview(null)}>
              {t('common.back')}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                saveTemplate(preview);
                toast(t('tpl.imported'), 'ok');
                close();
              }}
            >
              {t('tpl.add')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Menu de compartilhar / apagar de um modelo do usuário. */
export function TemplateActions({ tpl, onEdit }: { tpl: UserTemplate; onEdit(): void }) {
  const t = useT();
  const deleteTemplate = useData((s) => s.deleteTemplate);
  return (
    <Menu
      button={(toggle) => (
        <span
          className="icon-btn tpl-more"
          role="button"
          tabIndex={0}
          title={t('tpl.share')}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          <Share2 size={15} />
        </span>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon={<Copy size={15} />}
            onClick={() => {
              copyText(shareCode(tpl));
              toast(t('tpl.codeCopied'), 'ok');
              close();
            }}
          >
            {t('tpl.copyCode')}
          </MenuItem>
          <MenuItem
            icon={<FileDown size={15} />}
            onClick={async () => {
              close();
              const p = await saveTextFile(fileNameFor(tpl), shareFile(tpl), TEMPLATE_FILTERS);
              if (p) toast(t('tpl.fileSaved'), 'ok');
            }}
          >
            {t('tpl.saveFile')}
          </MenuItem>
          <MenuItem icon={<NoteIcon name="Palette" size={15} />} onClick={() => (onEdit(), close())}>
            {t('tpl.edit')}
          </MenuItem>
          <div className="menu-sep" />
          <MenuItem
            danger
            icon={<Trash2 size={15} />}
            onClick={() => {
              deleteTemplate(tpl.id);
              toast(t('tpl.deleted'));
              close();
            }}
          >
            {t('tpl.delete')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
