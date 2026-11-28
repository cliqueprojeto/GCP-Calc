/** Páginas auxiliares: início, modelos, lixeira, busca rápida e teclado numérico. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeXml, Camera, Mic, ArrowRight, Calculator, Clock, CornerDownLeft, Delete, LayoutTemplate, Plus, RotateCcw, Search, Settings, Trash2, ListOrdered, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useData, visibleNotes } from '../store/data';
import { useUi } from '../store/ui';
import { NoteIcon } from '../lib/icons';
import { uid, isMobile } from '../lib/platform';
import { TEMPLATES } from '../notes/templates';
import { CODE_TEMPLATES, type CodeTemplate } from '../notes/codeTemplates';
import { useLang, useT, LOCALES } from '../i18n';
import { Logo } from './Logo';
import { noteSnippet } from './Sidebar';
import { insertAtCaret, keypadAction } from './CalcEditor';
import type { Block, UserTemplate } from '../lib/types';
import { blocksForTemplate } from '../lib/templateShare';
import { EditTemplateModal, ImportTemplateModal, TemplateActions } from './TemplateDialogs';
import { FileUp } from 'lucide-react';
import { askConfirm } from './Dialogs';

export function useCreateFromTemplate() {
  const lang = useLang();
  const { createNote } = useData();
  const { go } = useUi();
  return (id: string) => {
    const tpl = TEMPLATES.find((x) => x.id === id)!;
    const calc: Block = { id: uid(), type: 'calc', text: tpl.text[lang] };
    const blocks: Block[] = [calc];
    if (tpl.chart) blocks.push({ id: uid(), type: 'chart', kind: tpl.chart, source: calc.id, title: tpl.title[lang] });
    if (tpl.pvr) blocks.push({ id: uid(), type: 'compare', sources: ['self'], mode: 'pvr', title: tpl.title[lang] });
    const nid = createNote({ title: tpl.title[lang], icon: tpl.icon, color: tpl.color, blocks });
    go({ kind: 'note', id: nid });
  };
}

/** Nova nota a partir de um modelo de programação (lição com código que roda). */
export function useCreateFromCodeTemplate() {
  const lang = useLang();
  const { createNote } = useData();
  const { go } = useUi();
  return (tp: CodeTemplate) => {
    const blocks = tp.blocks(lang).map((b) => ({ ...b, id: uid() }) as Block);
    const nid = createNote({ title: tp.title[lang], icon: tp.icon, color: tp.color, blocks });
    go({ kind: 'note', id: nid });
  };
}

/** Nova nota a partir de um modelo do usuário (blocos completos, ícone e cor). */
export function useCreateFromUserTemplate() {
  const { createNote } = useData();
  const { go } = useUi();
  return (tp: UserTemplate) => {
    const nid = createNote({ title: tp.title, icon: tp.icon, color: tp.color, blocks: blocksForTemplate(tp.blocks) });
    go({ kind: 'note', id: nid });
  };
}

export function Home() {
  const t = useT();
  const lang = useLang();
  const allNotes = useData((s) => s.notes);
  const notes = useMemo(() => visibleNotes(allNotes), [allNotes]);
  const { createNote } = useData();
  const { go, set } = useUi();
  const fromTemplate = useCreateFromTemplate();
  const recent = [...notes].sort((a, b) => b.updated - a.updated).slice(0, 8);
  return (
    <div className="page home">
      <div className="home-hero">
        <Logo size={72} />
        <div>
          <h1>GCP-Calc</h1>
          <p>{t('home.subtitle')}</p>
        </div>
      </div>
      <div className="home-actions">
        <button className="btn primary" onClick={() => go({ kind: 'note', id: createNote() })}>
          <Plus size={16} /> {t('sidebar.newNote')}
        </button>
        <button
          className="btn"
          onClick={() => {
            const id = createNote({ title: t('assist.title'), icon: 'ListOrdered' });
            go({ kind: 'note', id });
            set({ assistant: { noteId: id } });
          }}
        >
          <ListOrdered size={16} /> {t('home.startAssistant')}
        </button>
        <button className="btn" onClick={() => go({ kind: 'templates' })}>
          <LayoutTemplate size={16} /> {t('sidebar.templates')}
        </button>
        <button className="btn" onClick={() => go({ kind: 'note', id: createNote({ title: 'Playground', icon: 'CodeXml', color: '#6366f1', blocks: [{ id: uid(), type: 'code', lang: 'python', code: '' }] }) })}>
          <CodeXml size={16} /> {t('home.playground')}
        </button>
      </div>
      {recent.length > 0 && (
        <>
          <h3 className="sec-title">
            <Clock size={15} /> {t('home.recent')}
          </h3>
          <div className="note-grid">
            {recent.map((n) => (
              <button key={n.id} className="note-card" onClick={() => go({ kind: 'note', id: n.id })} style={{ '--c': n.color } as React.CSSProperties}>
                <span className="nc-icon">
                  <NoteIcon name={n.icon} size={20} />
                </span>
                <span className="nc-title">{n.title || t('note.untitled')}</span>
                <span className="nc-snippet">{noteSnippet(n)}</span>
                <span className="nc-date">{new Date(n.updated).toLocaleDateString(LOCALES[lang])}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <h3 className="sec-title">
        <LayoutTemplate size={15} /> {t('home.quickStart')}
      </h3>
      <div className="tpl-row">
        {TEMPLATES.slice(0, 4).map((tp) => (
          <button key={tp.id} className="tpl-mini" onClick={() => fromTemplate(tp.id)} style={{ '--c': tp.color } as React.CSSProperties}>
            <NoteIcon name={tp.icon} size={18} />
            {tp.title[lang]}
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Templates() {
  const t = useT();
  const lang = useLang();
  const fromTemplate = useCreateFromTemplate();
  const fromUser = useCreateFromUserTemplate();
  const fromCode = useCreateFromCodeTemplate();
  const all = useData((s) => s.templates);
  const mine = useMemo(() => all.filter((x) => !x.deleted).sort((a, b) => b.updated - a.updated), [all]);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<UserTemplate | null>(null);
  return (
    <div className="page">
      <div className="page-head">
        <LayoutTemplate size={22} />
        <div style={{ flex: 1 }}>
          <h1>{t('sidebar.templates')}</h1>
          <p>{t('templates.subtitle')}</p>
        </div>
        <button className="btn" onClick={() => setImporting(true)}>
          <FileUp size={15} /> {t('tpl.import')}
        </button>
      </div>
      <h3 className="sec-title">{t('tpl.mine')}</h3>
      {mine.length ? (
        <div className="tpl-grid">
          {mine.map((tp) => (
            <div key={tp.id} className="tpl-card user" role="button" tabIndex={0} onClick={() => fromUser(tp)} onKeyDown={(e) => e.key === 'Enter' && fromUser(tp)} style={{ '--c': tp.color } as React.CSSProperties}>
              <div className="tpl-icon">
                <NoteIcon name={tp.icon} size={22} />
              </div>
              <div className="tpl-more-wrap" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <TemplateActions tpl={tp} onEdit={() => setEditing(tp)} />
              </div>
              <h3>{tp.title}</h3>
              <p>{tp.desc || (tp.author ? t('tpl.by', { name: tp.author }) : '')}</p>
              <pre>
                {tp.blocks
                  .filter((b) => b.type === 'calc')
                  .map((b) => (b as { text: string }).text)
                  .join('\n')
                  .split('\n')
                  .slice(0, 5)
                  .join('\n')}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted tpl-empty">{t('tpl.empty')}</p>
      )}
      <h3 className="sec-title">{t('tpl.builtin')}</h3>
      {/* modelos prontos de finanças e dia a dia ficam abaixo; os de programação no fim */}
      <ImportTemplateModal open={importing} onClose={() => setImporting(false)} />
      {editing && <EditTemplateModal key={editing.id} tpl={editing} onClose={() => setEditing(null)} />}
      <div className="tpl-grid">
        {TEMPLATES.map((tp) => (
          <button key={tp.id} className="tpl-card" onClick={() => fromTemplate(tp.id)} style={{ '--c': tp.color } as React.CSSProperties}>
            <div className="tpl-icon">
              <NoteIcon name={tp.icon} size={22} />
            </div>
            <h3>{tp.title[lang]}</h3>
            <p>{tp.desc[lang]}</p>
            <pre>{tp.text[lang].split('\n').slice(0, 5).join('\n')}</pre>
          </button>
        ))}
      </div>
      <h3 className="sec-title">
        <CodeXml size={15} /> {t('tpl.code')}
      </h3>
      <p className="muted small tpl-code-intro">{t('tpl.codeIntro')}</p>
      <div className="tpl-grid">
        {CODE_TEMPLATES.map((tp) => (
          <button key={tp.id} className="tpl-card code" onClick={() => fromCode(tp)} style={{ '--c': tp.color } as React.CSSProperties}>
            <div className="tpl-icon">
              <NoteIcon name={tp.icon} size={22} />
            </div>
            <h3>{tp.title[lang]}</h3>
            <p>{tp.desc[lang]}</p>
            <pre>
              {(tp.blocks(lang).find((b) => b.type === 'code') as { code?: string } | undefined)?.code?.split('\n').slice(0, 5).join('\n')}
            </pre>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Trash() {
  const t = useT();
  const lang = useLang();
  const { notes, restoreNote, purgeNote } = useData();
  const trashed = notes.filter((n) => n.deleted && !n.purged).sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0));
  return (
    <div className="page">
      <div className="page-head">
        <Trash2 size={22} />
        <div>
          <h1>{t('sidebar.trash')}</h1>
          <p>{t('trash.subtitle')}</p>
        </div>
      </div>
      {!trashed.length && <p className="muted">{t('trash.empty')}</p>}
      <div className="trash-list">
        {trashed.map((n) => (
          <div key={n.id} className="trash-row">
            <NoteIcon name={n.icon} size={18} color={n.color} />
            <span className="tr-title">{n.title || t('note.untitled')}</span>
            <span className="muted">{new Date(n.deleted!).toLocaleString(LOCALES[lang])}</span>
            <button className="btn sm" onClick={() => restoreNote(n.id)}>
              <RotateCcw size={14} /> {t('trash.restore')}
            </button>
            <button className="btn sm danger" onClick={async () => (await askConfirm({ message: t('trash.purgeConfirm'), danger: true })) && purgeNote(n.id)}>
              <Trash2 size={14} /> {t('trash.purge')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Busca rápida (Ctrl+K): notas, modelos e ações. */
export function CommandPalette() {
  const t = useT();
  const lang = useLang();
  const { palette, set, go } = useUi();
  const allNotes = useData((s) => s.notes);
  const notes = useMemo(() => visibleNotes(allNotes), [allNotes]);
  const { createNote } = useData();
  const fromTemplate = useCreateFromTemplate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (palette) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [palette]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const acts = [
      { id: 'new', icon: <Plus size={16} />, label: t('sidebar.newNote'), run: () => go({ kind: 'note', id: createNote() }) },
      { id: 'settings', icon: <Settings size={16} />, label: t('sidebar.settings'), run: () => go({ kind: 'settings' }) },
      { id: 'templates', icon: <LayoutTemplate size={16} />, label: t('sidebar.templates'), run: () => go({ kind: 'templates' }) },
      { id: 'support', icon: <Heart size={16} />, label: t('sidebar.support'), run: () => set({ support: true }) },
    ];
    const ns = notes.map((n) => ({ id: n.id, icon: <NoteIcon name={n.icon} size={16} color={n.color} />, label: n.title || t('note.untitled'), sub: noteSnippet(n), run: () => go({ kind: 'note', id: n.id }) }));
    const tps = TEMPLATES.map((tp) => ({ id: 'tpl-' + tp.id, icon: <NoteIcon name={tp.icon} size={16} color={tp.color} />, label: `${t('palette.template')}: ${tp.title[lang]}`, run: () => fromTemplate(tp.id) }));
    const all = [...ns, ...acts, ...tps] as { id: string; icon: JSX.Element; label: string; sub?: string; run(): void }[];
    return s ? all.filter((x) => (x.label + ' ' + (x.sub ?? '')).toLowerCase().includes(s)).slice(0, 12) : all.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, notes, lang]);

  if (!palette) return null;
  const run = (i: number) => {
    items[i]?.run();
    set({ palette: false });
  };
  return (
    <div className="modal-back palette-back" onMouseDown={(e) => e.target === e.currentTarget && set({ palette: false })}>
      <div className="palette">
        <label className="search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder={t('palette.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              if (e.key === 'Enter') run(sel);
              if (e.key === 'Escape') set({ palette: false });
            }}
          />
        </label>
        <div className="pal-list">
          {items.map((it, i) => (
            <button key={it.id} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => run(i)}>
              {it.icon}
              <span className="pal-label">{it.label}</span>
              {it.sub && <span className="pal-sub">{it.sub}</span>}
              {i === sel && <CornerDownLeft size={14} className="pal-enter" />}
            </button>
          ))}
          {!items.length && <div className="muted pad">{t('sidebar.noResults')}</div>}
        </div>
      </div>
    </div>
  );
}

/** Teclado numérico para celular: insere operadores, unidades e moedas no editor focado. */
export function Keypad() {
  const t = useT();
  const mode = useData((s) => s.settings.keypad);
  const focus = useUi((s) => s.focusBlock);
  const view = useUi((s) => s.view);
  const [page, setPage] = useState(0);
  const dec = useData((s) => (s.settings.decimal === 'dot' || (s.settings.decimal === 'auto' && (s.settings.lang === 'en' || (s.settings.lang === 'auto' && !/^(pt|es)/i.test(navigator.language)))) ? '.' : ','));
  // o teclado do sistema é o padrão; o de operadores só aparece se ligado (no Android os dois disputavam a tela)
  const show = view.kind === 'note' && !!focus && mode === 'on';
  if (!show) return null;
  const pages = [
    ['7', '8', '9', '/', '(', ')', '4', '5', '6', '*', '%', '^', '1', '2', '3', '-', '=', '$', '0', dec, ' ', '+', '\u0001mic', '\u0001cam'],
    ['R$', 'US$', '€', 'BTC', ` ${t('keypad.in')} `, ` ${t('keypad.of')} `, 'km', 'kg', 'm²', 'L', 'h', 'min', '°C', 'GB', t('keypad.total'), t('keypad.today'), 'sqrt(', 'pmt(', ';', '//', '#', '\n', '\u0001mic', '\u0001cam'],
  ];
  return (
    <div className="keypad" onMouseDown={(e) => e.preventDefault()}>
      <div className="kp-keys">
        {pages[page].map((k, i) => (
          k.startsWith('\u0001') ? (
            <button
              key={i}
              className="op special"
              title={k === '\u0001mic' ? t('voice.title') : t('att.add')}
              onClick={() => useUi.getState().set(k === '\u0001mic' ? { voiceRequest: Date.now() } : { attachRequest: Date.now() })}
            >
              {k === '\u0001mic' ? <Mic size={17} /> : <Camera size={17} />}
            </button>
          ) : (
            <button key={i} className={/[0-9.,]/.test(k) && k.length === 1 ? 'num' : 'op'} onClick={() => (k === '\n' ? keypadAction('enter') : insertAtCaret(k))}>
              {k === ' ' ? '␣' : k === '\n' ? '⏎' : k.trim() || k}
            </button>
          )
        ))}
      </div>
      <div className="kp-side">
        <button onClick={() => setPage((p) => (p + 1) % pages.length)} title={t('keypad.more')}>
          {page === 0 ? <Calculator size={16} /> : '123'}
        </button>
        <button onClick={() => keypadAction('left')}>
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => keypadAction('right')}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => keypadAction('back')}>
          <Delete size={18} />
        </button>
        <button className="enter" onClick={() => keypadAction('enter')}>
          <CornerDownLeft size={18} />
        </button>
      </div>
    </div>
  );
}
