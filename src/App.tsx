import { useEffect } from 'react';
import { useData, flushSave } from './store/data';
import { useUi } from './store/ui';
import { useRates } from './lib/rates';
import { applyTheme, resolveTheme, FONTS } from './lib/themes';
import { isTauri } from './lib/platform';
import { startAutoSync, hasPendingSync, syncSoon } from './cloud/autosync';
import { autoBackupIfDue } from './cloud/cloud';
import { useLang } from './i18n';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { NoteView } from './components/NoteView';
import { SettingsView } from './components/Settings';
import { Support } from './components/Support';
import { CommandPalette, Home, Keypad, Templates, Trash } from './components/Pages';
import { Toasts } from './components/ui';
import { runUpdateCheck } from './components/UpdateBanner';
import { RemindersPage, amountText } from './components/Reminders';
import { PermissionsFirstRun } from './components/Permissions';
import { startReminderLoop } from './lib/reminders';
import { currentContext, formatOptions } from './lib/calcContext';

export function App() {
  const loaded = useData((s) => s.loaded);
  const settings = useData((s) => s.settings);
  const notes = useData((s) => s.notes);
  const { view, sidebarOpen, set } = useUi();
  const lang = useLang();

  // inicialização: dados, cotações, sincronização e atualizações
  useEffect(() => {
    (async () => {
      await Promise.all([useData.getState().load(), useRates.getState().load()]);
      const s = useData.getState().settings;
      const first = useData.getState().notes.find((n) => !n.deleted);
      if (first) useUi.getState().go({ kind: 'note', id: first.id });
      if (s.ratesOnOpen) useRates.getState().refresh(false, s.ratesMaxAge);
      startAutoSync();
      setTimeout(() => autoBackupIfDue(), 20_000);
      setTimeout(() => runUpdateCheck(), 4_000);
      // lembretes: avisos na central, notificações do sistema e agendamento no Android
      startReminderLoop((r) => {
        const ctx = currentContext();
        return amountText(r, ctx, formatOptions(ctx));
      });
    })();
  }, []);

  // tema, fonte e idioma
  useEffect(() => {
    const th = resolveTheme(settings.theme, settings.customTheme);
    applyTheme(th, settings.synColors[th.id]);
    const font = FONTS.find((f) => f.id === settings.font) ?? FONTS[0];
    document.documentElement.style.setProperty('--font-calc', font.css);
    document.documentElement.style.setProperty('--calc-size', `${settings.fontSize}px`);
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
    if (settings.theme === 'system') {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      const h = () => applyTheme(resolveTheme('system', settings.customTheme), settings.synColors[resolveTheme('system', settings.customTheme).id]);
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }
  }, [settings.theme, settings.customTheme, settings.synColors, settings.font, settings.fontSize, lang]);

  // atalhos de teclado
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        set({ palette: !useUi.getState().palette });
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        useUi.getState().go({ kind: 'note', id: useData.getState().createNote() });
      } else if (mod && e.key === ',') {
        e.preventDefault();
        useUi.getState().go({ kind: 'settings' });
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const v = useUi.getState().view;
        if (v.kind === 'note') set({ assistant: useUi.getState().assistant ? undefined : { noteId: v.id } });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [set]);

  // ao fechar: grava e envia o que estiver pendente
  useEffect(() => {
    const h = () => {
      flushSave();
      if (hasPendingSync()) syncSoon();
    };
    window.addEventListener('beforeunload', h);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSave());
    if (isTauri) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const w = getCurrentWindow();
        w.onCloseRequested(async (ev) => {
          ev.preventDefault();
          await flushSave();
          if (hasPendingSync()) await Promise.race([syncSoon(), new Promise((r) => setTimeout(r, 6000))]);
          await w.destroy();
        });
      });
    }
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  if (!loaded) return <div className="splash" />;

  const note = view.kind === 'note' ? notes.find((n) => n.id === view.id && !n.deleted) : undefined;

  return (
    <div className={`app ${sidebarOpen ? 'sb-open' : ''}`}>
      <Sidebar />
      <div className="sb-scrim" onClick={() => set({ sidebarOpen: false })} />
      <main className="main">
        <Topbar />
        <div className="content">
          {view.kind === 'note' && note && <NoteView key={note.id} note={note} />}
          {(view.kind === 'home' || (view.kind === 'note' && !note)) && <Home />}
          {view.kind === 'settings' && <SettingsView initial={view.section} />}
          {view.kind === 'templates' && <Templates />}
          {view.kind === 'trash' && <Trash />}
          {view.kind === 'reminders' && <RemindersPage />}
        </div>
        <Keypad />
      </main>
      <Support />
      <PermissionsFirstRun />
      <CommandPalette />
      <Toasts />
    </div>
  );
}
