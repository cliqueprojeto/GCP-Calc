/** Tela de bloqueio (senha, digital, recuperação) e a seção Segurança das configurações. */
import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Eye, EyeOff, Fingerprint, KeyRound, Lock as LockIcon, ShieldCheck } from 'lucide-react';
import { useData, flushSave } from '../store/data';
import { toast, useUi } from '../store/ui';
import { biometricAvailable, biometricUnlock, checkPassword, checkRecovery, createLock, newRecoveryCode, type LockConfig } from '../lib/lock';
import { copyText, saveTextFile } from '../lib/platform';
import { Logo } from './Logo';
import { Field, Modal, Select, Toggle } from './ui';
import { useT } from '../i18n';

function PasswordInput({ value, onChange, placeholder, autoFocus, onEnter }: { value: string; onChange(v: string): void; placeholder?: string; autoFocus?: boolean; onEnter?(): void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-input">
      <input className="input" type={show ? 'text' : 'password'} value={value} placeholder={placeholder} autoFocus={autoFocus} autoComplete="current-password" onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} />
      <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="mostrar">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/** Mostra o código de recuperação com copiar/salvar e a confirmação "guardei". */
function RecoveryCode({ code, onDone }: { code: string; onDone(): void }) {
  const t = useT();
  const [ok, setOk] = useState(false);
  return (
    <div className="rec-code">
      <p>{t('lock.recoveryIntro')}</p>
      <div className="rec-box">{code}</div>
      <div className="btn-row">
        <button className="btn small" onClick={() => (copyText(code), toast(t('lock.copied'), 'ok'))}>
          <Copy size={14} /> {t('lock.copy')}
        </button>
        <button className="btn small" onClick={() => saveTextFile('gcp-calc-codigo-de-recuperacao.txt', `GCP-Calc — ${t('lock.recoveryTitle')}\n\n${code}\n`, [{ name: 'Texto', extensions: ['txt'] }])}>
          <Download size={14} /> {t('lock.saveFile')}
        </button>
      </div>
      <Toggle checked={ok} onChange={setOk} label={t('lock.saved')} />
      <div className="btn-row">
        <span style={{ flex: 1 }} />
        <button className="btn primary" disabled={!ok} onClick={onDone}>
          {t('lock.finish')}
        </button>
      </div>
    </div>
  );
}

export function LockScreen() {
  const t = useT();
  const lock = useData((s) => s.settings.lock);
  const setSettings = useData((s) => s.setSettings);
  const loaded = useData((s) => s.loaded);
  const unlocked = useUi((s) => s.unlocked);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'pw' | 'recover' | 'newpw' | 'code'>('pw');
  const [code, setCode] = useState('');
  const [pw2, setPw2] = useState('');
  const [newCode, setNewCode] = useState('');
  const [bio, setBio] = useState(false);
  const tried = useRef(false);
  const active = loaded && !!lock?.enabled && !unlocked;

  // bloqueia de novo depois de um tempo fora do app
  useEffect(() => {
    if (!lock?.enabled || !lock.autoLockMin) return;
    let hiddenAt = 0;
    const h = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > lock.autoLockMin! * 60_000) useUi.getState().set({ unlocked: false });
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [lock?.enabled, lock?.autoLockMin]);

  const tryBio = async () => {
    if (await biometricUnlock(t('lock.bioReason'))) useUi.getState().set({ unlocked: true });
  };
  useEffect(() => {
    if (!active) {
      tried.current = false;
      return;
    }
    void biometricAvailable().then((ok) => {
      setBio(ok && !!lock?.biometric);
      if (ok && lock?.biometric && !tried.current) {
        tried.current = true;
        void tryBio();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || !lock) return null;

  const submit = async () => {
    if (await checkPassword(lock, pw)) {
      setPw('');
      setErr('');
      useUi.getState().set({ unlocked: true });
    } else setErr(t('lock.wrong'));
  };

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <Logo size={64} />
        <h2>GCP-Calc</h2>
        {mode === 'pw' && (
          <>
            <p className="muted">{t('lock.enter')}</p>
            <PasswordInput value={pw} onChange={(v) => (setPw(v), setErr(''))} placeholder={t('lock.password')} autoFocus onEnter={submit} />
            {err && <p className="lock-err">{err}</p>}
            <button className="btn primary lock-go" onClick={submit} disabled={!pw}>
              <LockIcon size={15} /> {t('lock.unlock')}
            </button>
            {bio && (
              <button className="btn lock-go" onClick={tryBio}>
                <Fingerprint size={16} /> {t('lock.useBio')}
              </button>
            )}
            <button className="link" onClick={() => (setMode('recover'), setErr(''))}>
              {t('lock.forgot')}
            </button>
          </>
        )}
        {mode === 'recover' && (
          <>
            <p className="muted">{t('lock.recoverHint')}</p>
            <input className="input mono" value={code} placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus onChange={(e) => (setCode(e.target.value), setErr(''))} />
            {err && <p className="lock-err">{err}</p>}
            <button
              className="btn primary lock-go"
              onClick={async () => ((await checkRecovery(lock, code)) ? (setMode('newpw'), setErr('')) : setErr(t('lock.wrongCode')))}
            >
              <KeyRound size={15} /> {t('lock.verify')}
            </button>
            <button className="link" onClick={() => setMode('pw')}>
              {t('common.back')}
            </button>
          </>
        )}
        {mode === 'newpw' && (
          <>
            <p className="muted">{t('lock.newPwHint')}</p>
            <PasswordInput value={pw} onChange={setPw} placeholder={t('lock.newPassword')} autoFocus />
            <PasswordInput value={pw2} onChange={setPw2} placeholder={t('lock.repeat')} />
            {pw && pw2 && pw !== pw2 && <p className="lock-err">{t('lock.mismatch')}</p>}
            <button
              className="btn primary lock-go"
              disabled={pw.length < 4 || pw !== pw2}
              onClick={async () => {
                const c = newRecoveryCode();
                setSettings({ lock: await createLock(pw, c, lock) });
                await flushSave();
                setNewCode(c);
                setMode('code');
              }}
            >
              {t('lock.savePw')}
            </button>
          </>
        )}
        {mode === 'code' && <RecoveryCode code={newCode} onDone={() => (setPw(''), setPw2(''), setMode('pw'), useUi.getState().set({ unlocked: true }))} />}
      </div>
    </div>
  );
}

export function SecuritySettings() {
  const t = useT();
  const lock = useData((s) => s.settings.lock);
  const setSettings = useData((s) => s.setSettings);
  const [dialog, setDialog] = useState<'create' | 'change' | 'remove' | 'newcode' | null>(null);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setBioOk);
  }, []);
  const close = () => {
    setDialog(null);
    setCur('');
    setPw('');
    setPw2('');
    setErr('');
    setCode('');
  };
  const patch = (p: Partial<LockConfig>) => lock && setSettings({ lock: { ...lock, ...p } });
  const hasPw = !!lock?.hash;

  return (
    <div className="sec-settings">
      {!hasPw ? (
        <div className="sec-empty">
          <ShieldCheck size={26} />
          <p>{t('lock.intro')}</p>
          <button className="btn primary" onClick={() => setDialog('create')}>
            <KeyRound size={15} /> {t('lock.create')}
          </button>
        </div>
      ) : (
        <>
          <Toggle checked={!!lock?.enabled} onChange={(enabled) => patch({ enabled })} label={t('lock.askOnOpen')} hint={t('lock.askOnOpenHint')} />
          {bioOk && <Toggle checked={!!lock?.biometric} onChange={(biometric) => patch({ biometric })} label={t('lock.bioToggle')} hint={t('lock.bioHint')} />}
          <Field label={t('lock.autoLock')}>
            <Select
              value={lock?.autoLockMin ?? 0}
              onChange={(autoLockMin) => patch({ autoLockMin })}
              options={[0, 1, 5, 15, 60].map((n) => ({ value: n, label: n ? t('lock.afterMin', { n }) : t('lock.onlyOpen') }))}
            />
          </Field>
          <div className="btn-row">
            <button className="btn small" onClick={() => setDialog('change')}>
              {t('lock.change')}
            </button>
            <button className="btn small" onClick={() => setDialog('newcode')}>
              {t('lock.newCode')}
            </button>
            <button className="btn small danger-text" onClick={() => setDialog('remove')}>
              {t('lock.remove')}
            </button>
          </div>
          <p className="muted small">{t('lock.note')}</p>
        </>
      )}
      {dialog && (
        <Modal open onClose={close} title={t(dialog === 'create' ? 'lock.create' : dialog === 'change' ? 'lock.change' : dialog === 'remove' ? 'lock.remove' : 'lock.newCode')}>
          {code ? (
            <RecoveryCode code={code} onDone={close} />
          ) : (
            <div className="pw-form">
              {dialog !== 'create' && (
                <Field label={t('lock.current')}>
                  <PasswordInput value={cur} onChange={(v) => (setCur(v), setErr(''))} autoFocus />
                </Field>
              )}
              {(dialog === 'create' || dialog === 'change') && (
                <>
                  <Field label={t('lock.newPassword')} hint={t('lock.min')}>
                    <PasswordInput value={pw} onChange={setPw} autoFocus={dialog === 'create'} />
                  </Field>
                  <Field label={t('lock.repeat')}>
                    <PasswordInput value={pw2} onChange={setPw2} />
                  </Field>
                  {pw && pw2 && pw !== pw2 && <p className="lock-err">{t('lock.mismatch')}</p>}
                </>
              )}
              {err && <p className="lock-err">{err}</p>}
              <div className="btn-row">
                <span style={{ flex: 1 }} />
                <button className="btn" onClick={close}>
                  {t('common.close')}
                </button>
                <button
                  className={`btn ${dialog === 'remove' ? 'danger' : 'primary'}`}
                  disabled={(dialog === 'create' || dialog === 'change') && (pw.length < 4 || pw !== pw2)}
                  onClick={async () => {
                    if (dialog !== 'create' && lock && !(await checkPassword(lock, cur))) return setErr(t('lock.wrong'));
                    if (dialog === 'remove') {
                      setSettings({ lock: undefined });
                      await flushSave();
                      toast(t('lock.removed'), 'ok');
                      return close();
                    }
                    const c = newRecoveryCode();
                    const next = dialog === 'newcode' ? await createLock(cur, c, lock) : await createLock(pw, c, lock);
                    setSettings({ lock: { ...next, enabled: dialog === 'create' ? true : !!lock?.enabled } });
                    await flushSave();
                    useUi.getState().set({ unlocked: true });
                    setCode(c);
                  }}
                >
                  {dialog === 'remove' ? t('lock.remove') : t('common.save')}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
