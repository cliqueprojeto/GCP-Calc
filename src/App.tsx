import { useEffect, useRef } from 'react';
import { useData, flushSave } from './store/data';
import { useUi } from './store/ui';
import { useRates } from './lib/rates';
import { applyTheme, resolveTheme, FONTS } from './lib/themes';
import { isAndroid, isTauri } from './lib/platform';
import { startAutoSync, hasPendingSync, syncSoon } from './cloud/autosync';
import { autoBackupIfDue } from './cloud/cloud';
import { useLang, translate, resolveLang } from './i18n';
import { checkWhisperCrash } from './lib/whisper';
import { DialogHost } from './components/Dialogs';
import { useEvalContext } from './lib/calcContext';
import { toast } from './store/ui';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { NoteView } from './components/NoteView';
import { SettingsView } from './components/Settings';
import { Support } from './components/Support';
import { CommandPalette, Home, Keypad, Templates, Trash } from './components/Pages';
import { Toasts } from './components/ui';
import { runUpdateCheck } from './components/UpdateBanner';
import { RemindersPage, amountText, payReminder } from './components/Reminders';
import { PermissionsFirstRun } from './components/Permissions';
import { LockScreen } from './components/Lock';
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

  // toque numa notificação do navegador: "Marcar como pago/recebido" ou abrir os lembretes
  const ectx = useEvalContext();
  const ectxRef = useRef(ectx);
  ectxRef.current = ectx;
  useEffect(() => {
    const handle = (d?: { key?: string; action?: string }) => {
      const r = d?.key ? useData.getState().reminders.find((x) => d.key!.startsWith(x.id + ':')) : undefined;
      if (d?.action === 'paid' && r) {
        const lg = resolveLang(useData.getState().settings.lang);
        payReminder(r, ectxRef.current, formatOptions(ectxRef.current), ((k: string, v?: Record<string, string | number>) => translate(lg, k as never, v)) as never);
      } else useUi.getState().go({ kind: 'reminders' });
    };
    const fromSw = (e: MessageEvent) => e.data?.type === 'gcp-notification' && handle(e.data);
    const fromPage = (e: Event) => handle((e as CustomEvent).detail);
    navigator.serviceWorker?.addEventListener('message', fromSw);
    window.addEventListener('gcp-notification', fromPage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', fromSw);
      window.removeEventListener('gcp-notification', fromPage);
    };
  }, []);

  // o app fechou carregando a transcrição offline no celular? desliga neste aparelho e avisa
  useEffect(() => {
    if (checkWhisperCrash()) setTimeout(() => toast(translate(resolveLang(useData.getState().settings.lang), 'voice.crashNotice'), 'error'), 1500);
  }, []);

  // altura do teclado virtual no navegador/iPhone (no app Android quem informa é a atividade nativa)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || (isTauri && isAndroid)) return;
    const upd = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--kb', `${kb > 80 ? kb : 0}px`);
      document.documentElement.classList.toggle('kb-open', kb > 80);
    };
    vv.addEventListener('resize', upd);
    vv.addEventListener('scroll', upd);
    upd();
    return () => {
      vv.removeEventListener('resize', upd);
      vv.removeEventListener('scroll', upd);
    };
  }, []);

  // digitando (campo com foco): marca a página
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
    const on = (e: FocusEvent) => isField(e.target) && document.documentElement.classList.add('editing');
    const off = (e: FocusEvent) => isField(e.target) && !isField(e.relatedTarget) && document.documentElement.classList.remove('editing');
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
    };
  }, []);

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
        <DialogHost />
      </main>
      <Support />
      <PermissionsFirstRun />
      <LockScreen />
      <CommandPalette />
      <Toasts />
    </div>
  );
}
