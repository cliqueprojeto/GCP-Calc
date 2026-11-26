/** Primeiro uso: pede de uma vez as permissões (microfone e notificações) e guarda a escolha. */
import { useEffect, useState } from 'react';
import { Bell, Camera, Check, Mic, ShieldCheck, X } from 'lucide-react';
import { Modal } from './ui';
import { useData } from '../store/data';
import { micState, notifyState, requestAll, requestMic, requestNotify, type PermState } from '../lib/permissions';
import { useT } from '../i18n';

function StateTag({ s }: { s?: PermState }) {
  const t = useT();
  if (!s) return null;
  return <span className={`perm-state ps-${s}`}>{s === 'granted' ? <Check size={12} /> : s === 'denied' ? <X size={12} /> : null} {t(`perm.${s}`)}</span>;
}

export function PermissionsFirstRun() {
  const t = useT();
  const loaded = useData((s) => s.loaded);
  const perms = useData((s) => s.settings.permissions);
  const setSettings = useData((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (loaded && !perms?.asked) {
      const id = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(id);
    }
  }, [loaded, perms?.asked]);
  const save = (p: { mic?: PermState; notify?: PermState }) => setSettings({ permissions: { asked: true, ...p, at: Date.now() } });
  return (
    <Modal open={open} onClose={() => (save({ mic: perms?.mic, notify: perms?.notify }), setOpen(false))} title={t('perm.title')} className="perm-modal">
      <div className="perm-hero">
        <ShieldCheck size={30} />
        <p>{t('perm.intro')}</p>
      </div>
      <div className="perm-list">
        <div className="perm-item">
          <Mic size={18} />
          <div>
            <b>{t('perm.mic')}</b>
            <small>{t('perm.micWhy')}</small>
          </div>
        </div>
        <div className="perm-item">
          <Camera size={18} />
          <div>
            <b>{t('perm.camera')}</b>
            <small>{t('perm.cameraWhy')}</small>
          </div>
        </div>
        <div className="perm-item">
          <Bell size={18} />
          <div>
            <b>{t('perm.notify')}</b>
            <small>{t('perm.notifyWhy')}</small>
          </div>
        </div>
      </div>
      <p className="muted small">{t('perm.later')}</p>
      <div className="btn-row">
        <button className="btn" onClick={() => (save({}), setOpen(false))}>
          {t('perm.notNow')}
        </button>
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await requestAll();
            save(r);
            setBusy(false);
            setOpen(false);
          }}
        >
          <ShieldCheck size={15} /> {t('perm.allowAll')}
        </button>
      </div>
    </Modal>
  );
}

/** Seção das Configurações: situação de cada permissão e botão para pedir de novo. */
export function PermissionsSettings() {
  const t = useT();
  const setSettings = useData((s) => s.setSettings);
  const perms = useData((s) => s.settings.permissions);
  const [mic, setMic] = useState<PermState>();
  const [notify, setNotify] = useState<PermState>();
  useEffect(() => {
    void micState().then(setMic);
    void notifyState().then(setNotify);
  }, []);
  const update = (p: { mic?: PermState; notify?: PermState }) => setSettings({ permissions: { asked: true, ...perms, ...p, at: Date.now() } });
  return (
    <div className="perm-settings">
      <div className="perm-row">
        <Mic size={17} />
        <div>
          <b>{t('perm.mic')}</b>
          <small>{t('perm.micWhy')}</small>
        </div>
        <StateTag s={mic} />
        <button className="btn small" onClick={async () => { const s = await requestMic(); setMic(s); update({ mic: s }); }}>
          {t('perm.ask')}
        </button>
      </div>
      {(window as unknown as { GcpNative?: { permission?(n: string): string } }).GcpNative?.permission && (
        <div className="perm-row">
          <Camera size={17} />
          <div>
            <b>{t('perm.camera')}</b>
            <small>{t('perm.cameraWhy')}</small>
          </div>
          <StateTag s={(window as unknown as { GcpNative: { permission(n: string): string } }).GcpNative.permission('camera') === 'granted' ? 'granted' : 'prompt'} />
          <button className="btn small" onClick={() => (window as unknown as { GcpNative: { requestPermissions(): void } }).GcpNative.requestPermissions()}>
            {t('perm.ask')}
          </button>
        </div>
      )}
      <div className="perm-row">
        <Bell size={17} />
        <div>
          <b>{t('perm.notify')}</b>
          <small>{t('perm.notifyWhy')}</small>
        </div>
        <StateTag s={notify} />
        <button className="btn small" onClick={async () => { const s = await requestNotify(); setNotify(s); update({ notify: s }); }}>
          {t('perm.ask')}
        </button>
      </div>
      <p className="muted small">{t('perm.deniedHelp')}</p>
    </div>
  );
}
