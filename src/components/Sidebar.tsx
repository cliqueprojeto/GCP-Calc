import { useMemo, useState } from 'react';
import { BellRing, ChevronDown, ChevronRight, FolderPlus, Heart, Info, LayoutTemplate, Pin, Plus, Search, Settings as Cog, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { useData, visibleNotes } from '../store/data';
import { useUi } from '../store/ui';
import { NoteIcon } from '../lib/icons';
import { APP_VERSION, openUrl } from '../lib/platform';
import { useT } from '../i18n';
import type { Note } from '../lib/types';
import { Logo } from './Logo';
import { useUnread } from './Reminders';
import { statusOf } from '../lib/reminders';
import { IconPicker } from './IconPicker';
import { askConfirm } from './Dialogs';

export const DEV_URL = 'https://gestaoculturalpro.com.br';

export function noteSnippet(n: Note) {
  const b = n.blocks.find((x) => x.type === 'calc');
  return b && b.type === 'calc' ? b.text.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '' : '';
}

export function Sidebar() {
  const t = useT();
  const { notes, folders, createNote, createFolder, updateFolder, deleteFolder } = useData();
  const { view, go, search, set } = useUi();
  const [editing, setEditing] = useState<string | null>(null);
  const [iconFolder, setIconFolder] = useState<string | null>(null);
  const trashCount = notes.filter((n) => n.deleted && !n.purged).length;
  const unread = useUnread();
  const overdue = useData((s) => s.reminders.filter((r) => !r.deleted && statusOf(r) === 'overdue').length);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const vis = visibleNotes(notes);
    if (!q) return vis;
    return vis.filter((n) => n.title.toLowerCase().includes(q) || n.blocks.some((b) => (b.type === 'calc' || b.type === 'heading' || b.type === 'callout') && b.text.toLowerCase().includes(q)));
  }, [notes, search]);

  const pinned = list.filter((n) => n.pinned);
  const activeFolders = folders.filter((f) => !f.deleted);
  const loose = list.filter((n) => !n.pinned && (!n.folderId || !activeFolders.some((f) => f.id === n.folderId)));

  const newNote = (folderId?: string) => {
    const id = createNote(folderId ? { folderId } : {});
    go({ kind: 'note', id });
  };

  const Item = ({ n }: { n: Note }) => (
    <button className={`nav-note ${view.kind === 'note' && view.id === n.id ? 'on' : ''}`} onClick={() => go({ kind: 'note', id: n.id })}>
      <span className="nn-icon" style={{ color: n.color }}>
        <NoteIcon name={n.icon} size={16} />
      </span>
      <span className="nn-title">{n.title || t('note.untitled')}</span>
      {n.pinned && <Pin size={11} className="nn-pin" />}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <Logo size={34} />
        <div>
          <div className="sb-name">GCP-Calc</div>
          <div className="sb-tag">{t('app.tagline')}</div>
        </div>
      </div>

      <label className="search sb-search">
        <Search size={15} />
        <input value={search} onChange={(e) => set({ search: e.target.value })} placeholder={t('sidebar.search')} />
        <kbd>Ctrl K</kbd>
      </label>

      <button className="btn primary block" onClick={() => newNote()}>
        <Plus size={16} /> {t('sidebar.newNote')}
      </button>

      <nav className="sb-scroll">
        {pinned.length > 0 && (
          <div className="sb-group">
            <div className="sb-label">{t('sidebar.pinned')}</div>
            {pinned.map((n) => (
              <Item key={n.id} n={n} />
            ))}
          </div>
        )}

        <div className="sb-group">
          <div className="sb-label">
            {t('sidebar.folders')}
            <button className="icon-btn xs" title={t('sidebar.newFolder')} onClick={() => setEditing(createFolder(t('sidebar.folderName')))}>
              <FolderPlus size={14} />
            </button>
          </div>
          {activeFolders.map((f) => {
            const inside = list.filter((n) => n.folderId === f.id && !n.pinned);
            return (
              <div key={f.id} className="sb-folder">
                <div className="sb-folder-row">
                  <button className="fold" onClick={() => updateFolder(f.id, { collapsed: !f.collapsed })}>
                    {f.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button className="f-icon" style={{ color: f.color }} onClick={() => setIconFolder(f.id)}>
                    <NoteIcon name={f.icon} size={15} />
                  </button>
                  {editing === f.id ? (
                    <input
                      autoFocus
                      className="f-name-input"
                      defaultValue={f.name}
                      onBlur={(e) => {
                        updateFolder(f.id, { name: e.target.value.trim() || f.name });
                        setEditing(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <span className="f-name" onDoubleClick={() => setEditing(f.id)}>
                      {f.name}
                    </span>
                  )}
                  <span className="f-count">{inside.length}</span>
                  <div className="f-tools">
                    <button className="icon-btn xs" title={t('sidebar.newNote')} onClick={() => newNote(f.id)}>
                      <Plus size={13} />
                    </button>
                    <button className="icon-btn xs" title={t('sidebar.rename')} onClick={() => setEditing(f.id)}>
                      <Pencil size={12} />
                    </button>
                    <button className="icon-btn xs" title={t('sidebar.deleteFolder')} onClick={async () => (await askConfirm({ message: t('sidebar.deleteFolderConfirm'), danger: true, ok: t('sidebar.deleteFolder') })) && deleteFolder(f.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {!f.collapsed && (
                  <div className="sb-folder-notes">
                    {inside.map((n) => (
                      <Item key={n.id} n={n} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sb-group">
          <div className="sb-label">{t('sidebar.notes')}</div>
          {loose.map((n) => (
            <Item key={n.id} n={n} />
          ))}
          {!list.length && <div className="sb-empty">{search ? t('sidebar.noResults') : t('sidebar.empty')}</div>}
        </div>
      </nav>

      <div className="sb-bottom">
        <button className={`nav-link ${view.kind === 'reminders' ? 'on' : ''}`} onClick={() => go({ kind: 'reminders' })}>
          <BellRing size={16} /> {t('rem.page')}
          {overdue > 0 ? <span className="badge bad">{overdue}</span> : unread > 0 ? <span className="badge accent">{unread}</span> : null}
        </button>
        <button className={`nav-link ${view.kind === 'templates' ? 'on' : ''}`} onClick={() => go({ kind: 'templates' })}>
          <LayoutTemplate size={16} /> {t('sidebar.templates')}
        </button>
        <button className={`nav-link ${view.kind === 'trash' ? 'on' : ''}`} onClick={() => go({ kind: 'trash' })}>
          <Trash2 size={16} /> {t('sidebar.trash')}
          {trashCount > 0 && <span className="badge">{trashCount}</span>}
        </button>
        <button className={`nav-link ${view.kind === 'settings' ? 'on' : ''}`} onClick={() => go({ kind: 'settings' })}>
          <Cog size={16} /> {t('sidebar.settings')}
        </button>
        <button className="nav-link heart" onClick={() => set({ support: true })}>
          <Heart size={16} /> {t('sidebar.support')}
        </button>
        <button className="nav-link" onClick={() => go({ kind: 'settings', section: 'about' })}>
          <Info size={16} /> {t('sidebar.about')}
        </button>
      </div>

      <div className="sb-footer">
        <div className="sb-version">
          {t('app.version')} {APP_VERSION}
        </div>
        <button className="dev-card" onClick={() => openUrl(DEV_URL)}>
          {t('app.developedBy')} <b>Bruno Albertini</b>
          <span>
            <b>Gestão Cultural Pro</b> <ExternalLink size={11} />
          </span>
        </button>
      </div>

      <IconPicker
        open={!!iconFolder}
        onClose={() => setIconFolder(null)}
        color={folders.find((f) => f.id === iconFolder)?.color}
        onColor={(c) => iconFolder && updateFolder(iconFolder, { color: c })}
        onPick={(icon) => {
          if (iconFolder) updateFolder(iconFolder, { icon });
          setIconFolder(null);
        }}
      />
    </aside>
  );
}
