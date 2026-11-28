/**
 * Janelas de confirmação e de texto no visual do app, no lugar do confirm()/prompt() do
 * navegador (que mostram "site.com diz…" e não seguem o tema).
 *
 *   if (await askConfirm({ message: '…', danger: true })) …
 *   const senha = await askText({ title: '…', password: true })
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { KeyRound, TriangleAlert, CircleHelp } from 'lucide-react';
import { Modal } from './ui';
import { useT } from '../i18n';

interface Req {
  kind: 'confirm' | 'text';
  title?: string;
  message: ReactNode;
  ok?: string;
  cancel?: string;
  danger?: boolean;
  password?: boolean;
  placeholder?: string;
  resolve(v: unknown): void;
}

const useDialogs = create<{ q: Req[] }>(() => ({ q: [] }));
const push = (r: Omit<Req, 'resolve'>) =>
  new Promise<unknown>((resolve) => useDialogs.setState((s) => ({ q: [...s.q, { ...r, resolve }] })));

export const askConfirm = (o: { title?: string; message: ReactNode; ok?: string; cancel?: string; danger?: boolean }) => push({ kind: 'confirm', ...o }) as Promise<boolean>;
export const askText = (o: { title?: string; message?: ReactNode; ok?: string; password?: boolean; placeholder?: string }) =>
  push({ kind: 'text', message: o.message ?? '', ...o }) as Promise<string | null>;

export function DialogHost() {
  const t = useT();
  const req = useDialogs((s) => s.q[0]);
  const [val, setVal] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setVal('');
    if (req?.kind === 'text') setTimeout(() => input.current?.focus(), 60);
  }, [req]);
  if (!req) return null;
  const done = (v: unknown) => {
    req.resolve(v);
    useDialogs.setState((s) => ({ q: s.q.slice(1) }));
  };
  const cancel = () => done(req.kind === 'confirm' ? false : null);
  const Icon = req.kind === 'text' ? KeyRound : req.danger ? TriangleAlert : CircleHelp;
  return (
    <Modal open onClose={cancel} className="dlg">
      <div className={`dlg-body ${req.danger ? 'danger' : ''}`}>
        <span className="dlg-ico">
          <Icon size={22} />
        </span>
        <div className="dlg-text">
          {req.title && <h3>{req.title}</h3>}
          {req.message && <p>{req.message}</p>}
          {req.kind === 'text' && (
            <input
              ref={input}
              className="input"
              type={req.password ? 'password' : 'text'}
              value={val}
              placeholder={req.placeholder}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && done(val)}
            />
          )}
        </div>
      </div>
      <div className="btn-row dlg-actions">
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={cancel}>
          {req.cancel ?? t('common.cancel')}
        </button>
        <button className={`btn ${req.danger ? 'danger' : 'primary'}`} autoFocus={req.kind === 'confirm'} onClick={() => done(req.kind === 'confirm' ? true : val)}>
          {req.ok ?? t('common.ok')}
        </button>
      </div>
    </Modal>
  );
}
