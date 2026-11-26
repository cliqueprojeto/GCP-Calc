import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './ui';
import { COLORS, EMOJI_GROUPS, FEATURED_ICONS, ICON_NAMES, NoteIcon } from '../lib/icons';
import { useT } from '../i18n';

export function IconPicker({ open, onClose, onPick, color, onColor }: { open: boolean; onClose(): void; onPick(icon: string): void; color?: string; onColor?(c: string): void }) {
  const t = useT();
  const [tab, setTab] = useState<'icons' | 'emoji'>('icons');
  const [q, setQ] = useState('');
  const icons = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return FEATURED_ICONS;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(s)).slice(0, 240);
  }, [q]);
  return (
    <Modal open={open} onClose={onClose} title={t('icons.title')} className="icon-picker">
      <div className="ip-top">
        <div className="seg">
          <button className={tab === 'icons' ? 'on' : ''} onClick={() => setTab('icons')}>
            {t('icons.icons')}
          </button>
          <button className={tab === 'emoji' ? 'on' : ''} onClick={() => setTab('emoji')}>
            {t('icons.emoji')}
          </button>
        </div>
        {tab === 'icons' && (
          <label className="search">
            <Search size={15} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('icons.search', { n: ICON_NAMES.length })} />
          </label>
        )}
      </div>
      {onColor && (
        <div className="ip-colors">
          {COLORS.map((c) => (
            <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => onColor(c)} aria-label={c} />
          ))}
          <input type="color" value={color ?? '#8b5cf6'} onChange={(e) => onColor(e.target.value)} title={t('icons.customColor')} />
        </div>
      )}
      {tab === 'icons' ? (
        <div className="ip-grid">
          {icons.map((n) => (
            <button key={n} title={n} onClick={() => onPick(n)} style={{ color }}>
              <NoteIcon name={n} size={22} />
            </button>
          ))}
          {!icons.length && <p className="muted">{t('icons.none')}</p>}
        </div>
      ) : (
        <div className="ip-emoji">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.id}>
              <h4>{t(`emoji.${g.id}` as 'emoji.money')}</h4>
              <div className="ip-grid">
                {g.emojis.map((e) => (
                  <button key={e} onClick={() => onPick(e)} className="emoji">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
