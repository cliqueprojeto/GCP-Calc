import { Bell, Cloud, CloudOff, Heart, Menu as MenuIcon, Moon, RefreshCw, Sun, ListOrdered, CloudAlert, Loader2, Download } from 'lucide-react';
import { useData } from '../store/data';
import { useUi } from '../store/ui';
import { useRates } from '../lib/rates';
import { useSync } from '../cloud/autosync';
import { THEMES, resolveTheme } from '../lib/themes';
import { useLang, useT, LOCALES } from '../i18n';
import type { Lang } from '../lib/types';
import { useUpdate } from './UpdateBanner';
import { InboxPanel, useUnread } from './Reminders';
import { useState } from 'react';
import { createPortal } from 'react-dom';

export function Topbar() {
  const t = useT();
  const lang = useLang();
  const { settings, setSettings } = useData();
  const { view, set, go } = useUi();
  const rates = useRates();
  const sync = useSync();
  const update = useUpdate();
  const theme = resolveTheme(settings.theme, settings.customTheme);
  const unread = useUnread();
  const [inbox, setInbox] = useState(false);

  const toggleDark = () => {
    // alterna para o "par" do tema atual (mesmo grupo, modo oposto)
    const target = THEMES.find((x) => x.dark !== theme.dark && (theme.premium ? x.premium : !x.premium)) ?? THEMES.find((x) => x.dark !== theme.dark)!;
    setSettings({ theme: target.id });
  };

  const age = rates.fetched ? Date.now() - rates.fetched : Infinity;
  const ratesTitle = rates.fetched ? t('rates.updatedAt', { when: new Date(rates.fetched).toLocaleString(LOCALES[lang]) }) + (rates.source ? ` · ${rates.source}` : '') : t('rates.never');

  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={() => set({ sidebarOpen: true })} aria-label="Menu">
        <MenuIcon size={20} />
      </button>
      <div className="tb-spacer" />
      {update && (
        <button className="tb-pill update" onClick={() => go({ kind: 'settings', section: 'updates' })}>
          <Download size={14} /> {t('update.available', { v: update.version })}
        </button>
      )}
      <button className={`tb-pill rates ${age > 12 * 3600_000 ? 'stale' : ''}`} title={ratesTitle} onClick={() => rates.refresh(true)}>
        <RefreshCw size={13} className={rates.status === 'loading' ? 'spin' : ''} />
        <span className="hide-sm">{rates.status === 'error' ? t('rates.offline') : t('rates.label')}</span>
      </button>
      {view.kind === 'note' && (
        <button className="tb-pill ai" onClick={() => set({ assistant: useUi.getState().assistant ? undefined : { noteId: view.id } })}>
          <ListOrdered size={14} /> <span className="hide-sm">{t('assist.title')}</span>
        </button>
      )}
      <div className="lang-switch">
        {(['pt', 'en', 'es'] as Lang[]).map((l) => (
          <button key={l} className={lang === l ? 'on' : ''} onClick={() => setSettings({ lang: l })}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        className={`icon-btn sync-${sync.status}`}
        title={t(`sync.${sync.status}` as 'sync.off')}
        onClick={() => go({ kind: 'settings', section: 'backup' })}
      >
        {sync.status === 'syncing' ? <Loader2 size={17} className="spin" /> : sync.status === 'off' ? <CloudOff size={17} /> : sync.status === 'error' || sync.status === 'wrong-pass' ? <CloudAlert size={17} /> : <Cloud size={17} />}
      </button>
      <button className="icon-btn" onClick={toggleDark} title={t('topbar.toggleTheme')}>
        {theme.dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <div className="tb-inbox">
        <button className={`icon-btn ${inbox ? 'on' : ''}`} onClick={() => setInbox(!inbox)} title={t('inbox.title')}>
          <Bell size={17} />
          {unread > 0 && <span className="tb-count">{unread > 99 ? '99+' : unread}</span>}
        </button>
        {inbox &&
          createPortal(
            <>
              <div className="tb-scrim" onClick={() => setInbox(false)} />
              <InboxPanel onClose={() => setInbox(false)} />
            </>,
            document.body,
          )}
      </div>
      <button className="icon-btn heart" onClick={() => set({ support: true })} title={t('sidebar.support')}>
        <Heart size={17} />
      </button>
    </header>
  );
}
