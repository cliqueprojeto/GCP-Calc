import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useUi } from '../store/ui';

export function Modal({ open, onClose, title, children, wide, className }: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; wide?: boolean; className?: string }) {
  const openedAt = useRef(Date.now());
  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="modal-back"
      // o toque que abriu a janela não pode fechá-la (no Android o "clique" chega logo depois)
      onMouseDown={(e) => e.target === e.currentTarget && Date.now() - openedAt.current > 450 && onClose()}
    >
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="modal-head">
            <div className="modal-title">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange(v: boolean): void; label?: ReactNode; hint?: ReactNode }) {
  return (
    <label className="toggle-row">
      <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
      {label && (
        <span className="toggle-text">
          <span>{label}</span>
          {hint && <small>{hint}</small>}
        </span>
      )}
    </label>
  );
}

export function Select<T extends string | number>({ value, onChange, options, className }: { value: T; onChange(v: T): void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select
      className={'select ' + (className ?? '')}
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Card({ icon, title, subtitle, children, actions }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        {icon && <div className="card-icon">{icon}</div>}
        <div className="card-titles">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
      {children && <div className="card-body">{children}</div>}
    </section>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Menu suspenso simples ancorado num botão. */
export function Menu({ button, children, align = 'right' }: { button: (open: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {button(() => setOpen((o) => !o))}
      {open && <div className={`menu ${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button className={`menu-item ${danger ? 'danger' : ''}`} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
