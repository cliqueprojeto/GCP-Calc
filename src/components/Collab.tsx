/** Colaboração em tempo real: compartilhar nota/pasta, entrar por link, presença e configurações. */
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileText, Folder, Link2, LogIn, Radio, Server, Share2, Users, Wifi, WifiOff, X } from 'lucide-react';
import { Card, Field, Modal } from './ui';
import { askConfirm } from './Dialogs';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { copyText } from '../lib/platform';
import { useT } from '../i18n';
import type { Note, Share } from '../lib/types';
import { createShare, inviteLink, joinShare, parseInvite, stopShare, useCollab, type Invite } from '../collab/manager';

function useShareFor(note: Note) {
  const shares = useData((s) => s.shares);
  return useMemo(
    () => shares.find((x) => !x.deleted && ((x.kind === 'note' && x.targetId === note.id) || (x.kind === 'folder' && !!note.folderId && x.targetId === note.folderId))),
    [shares, note.id, note.folderId],
  );
}

/** Selo "Ao vivo" no cabeçalho da nota, com quem está online. */
export function LiveBadge({ note, onOpen }: { note: Note; onOpen(): void }) {
  const t = useT();
  const sh = useShareFor(note);
  const pres = useCollab((s) => (sh ? s[sh.id] : undefined));
  if (!sh) return null;
  const n = pres?.peers.length ?? 0;
  const online = pres?.status === 'online' || pres?.relay === 'online';
  const names = (pres?.peers ?? []).map((p) => p.name).filter(Boolean);
  return (
    <button className={`live-badge ${n ? 'on' : online ? 'ready' : ''}`} onClick={onOpen} title={n ? t('collab.withNames', { names: names.join(', ') || String(n) }) : t('collab.waiting')}>
      <span className="live-dot" />
      {t('collab.live')}
      {n > 0 && <b>· {n + 1}</b>}
    </button>
  );
}

export function ShareDialog({ note, onClose }: { note: Note; onClose(): void }) {
  const t = useT();
  const folders = useData((s) => s.folders);
  const settings = useData((s) => s.settings);
  const setSettings = useData((s) => s.setSettings);
  const existing = useShareFor(note);
  const folder = note.folderId ? folders.find((f) => f.id === note.folderId && !f.deleted) : undefined;
  const [scope, setScope] = useState<Share['kind']>('note');
  const [mode, setMode] = useState<Share['mode']>(settings.collab?.relayUrl ? 'relay' : 'p2p');
  const [relay, setRelay] = useState(settings.collab?.relayUrl ?? '');
  const [name, setName] = useState(settings.collab?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<Share | undefined>(existing);
  useEffect(() => setShare(existing), [existing]);
  const pres = useCollab((s) => (share ? s[share.id] : undefined));
  const link = share ? inviteLink(share) : '';

  const create = async () => {
    if (mode === 'relay' && !/^(https?|wss?):\/\//i.test(relay.trim())) return toast(t('collab.relayInvalid'), 'error');
    setBusy(true);
    try {
      setSettings((s) => ({ collab: { ...s.collab, name: name.trim() || undefined, relayUrl: mode === 'relay' ? relay.trim() : s.collab?.relayUrl } }));
      const sh = scope === 'folder' && folder ? await createShare('folder', folder.id, folder.name, mode, relay.trim()) : await createShare('note', note.id, note.title || t('note.untitled'), mode, relay.trim());
      setShare(sh);
    } finally {
      setBusy(false);
    }
  };
  const copy = () => (copyText(link), toast(t('collab.copied'), 'ok'));
  const nativeShare = () => {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (nav.share) void nav.share({ title: 'GCP-Calc', text: t('collab.shareText', { name: share!.name }), url: link }).catch(() => undefined);
    else copy();
  };

  return (
    <Modal open onClose={onClose} title={<><Radio size={16} /> {t('collab.title')}</>} className="collab-modal">
      {!share ? (
        <div className="collab">
          <p className="field-hint">{t('collab.intro')}</p>
          <Field label={t('collab.what')}>
            <div className="collab-opts">
              <button className={scope === 'note' ? 'on' : ''} onClick={() => setScope('note')}>
                <FileText size={18} />
                <span>
                  <b>{t('collab.thisNote')}</b>
                  <small>{note.title || t('note.untitled')}</small>
                </span>
              </button>
              <button className={scope === 'folder' ? 'on' : ''} disabled={!folder} onClick={() => folder && setScope('folder')} title={folder ? '' : t('collab.noFolder')}>
                <Folder size={18} />
                <span>
                  <b>{t('collab.wholeFolder')}</b>
                  <small>{folder ? folder.name : t('collab.noFolder')}</small>
                </span>
              </button>
            </div>
          </Field>
          <Field label={t('collab.how')}>
            <div className="collab-opts col">
              <button className={mode === 'p2p' ? 'on' : ''} onClick={() => setMode('p2p')}>
                <Wifi size={18} />
                <span>
                  <b>{t('collab.p2p')}</b>
                  <small>{t('collab.p2pHint')}</small>
                </span>
              </button>
              <button className={mode === 'relay' ? 'on' : ''} onClick={() => setMode('relay')}>
                <Server size={18} />
                <span>
                  <b>{t('collab.relay')}</b>
                  <small>{t('collab.relayHint')}</small>
                </span>
              </button>
            </div>
          </Field>
          {mode === 'relay' && (
            <Field label={t('collab.relayUrl')} hint={t('collab.relayUrlHint')}>
              <input className="input mono" value={relay} placeholder="wss://sync.exemplo.com" onChange={(e) => setRelay(e.target.value)} />
            </Field>
          )}
          <Field label={t('collab.yourName')} hint={t('collab.yourNameHint')}>
            <input className="input" value={name} placeholder={t('collab.namePh')} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="btn-row">
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn primary grad" disabled={busy} onClick={create}>
              <Link2 size={15} /> {t('collab.createLink')}
            </button>
          </div>
        </div>
      ) : (
        <div className="collab">
          <div className="collab-status">
            {pres?.status === 'online' || pres?.relay === 'online' ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>
              {share.kind === 'folder' ? t('collab.sharingFolder', { name: share.name }) : t('collab.sharingNote', { name: share.name })} ·{' '}
              {share.mode === 'relay' ? t('collab.relay') : t('collab.p2p')}
            </span>
          </div>
          <div className="collab-peers">
            <Users size={15} />
            {pres?.peers.length ? (
              <span>{t('collab.onlineNow', { names: pres.peers.map((p) => p.name || '—').join(', ') })}</span>
            ) : (
              <span className="muted">{t('collab.nobody')}</span>
            )}
          </div>
          <Field label={t('collab.link')} hint={t('collab.linkHint')}>
            <div className="input-group">
              <input className="input mono" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn sm" onClick={copy}>
                <Copy size={14} /> {t('collab.copy')}
              </button>
            </div>
          </Field>
          <p className="field-hint">{share.mode === 'relay' ? t('collab.relayExplain') : t('collab.p2pExplain')}</p>
          <div className="btn-row">
            <button
              className="btn danger-text"
              onClick={async () => {
                if (await askConfirm({ message: t('collab.stopConfirm'), danger: true, ok: t('collab.stop') })) {
                  stopShare(share.id);
                  onClose();
                }
              }}
            >
              <X size={15} /> {t('collab.stop')}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn primary grad" onClick={nativeShare}>
              <Share2 size={15} /> {t('collab.send')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function JoinDialog({ initial, onClose, onJoined }: { initial?: string; onClose(): void; onJoined(sh: Share): void }) {
  const t = useT();
  const settings = useData((s) => s.settings);
  const setSettings = useData((s) => s.setSettings);
  const [text, setText] = useState(initial ?? '');
  const [name, setName] = useState(settings.collab?.name ?? '');
  const inv: Invite | null = parseInvite(text);
  const join = async () => {
    if (!inv) return toast(t('collab.badLink'), 'error');
    if (name.trim()) setSettings((s) => ({ collab: { ...s.collab, name: name.trim() } }));
    const sh = await joinShare(inv);
    toast(t('collab.joined', { name: sh.name }), 'ok');
    onJoined(sh);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={<><LogIn size={16} /> {t('collab.joinTitle')}</>} className="collab-modal">
      <div className="collab">
        <Field label={t('collab.pasteLink')}>
          <textarea className="input mono" rows={3} value={text} placeholder="https://cliqueprojeto.github.io/GCP-Calc/#join=…" onChange={(e) => setText(e.target.value)} />
        </Field>
        {inv && (
          <div className="collab-status">
            {inv.k === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
            <span>
              {inv.k === 'folder' ? t('collab.inviteFolder', { name: inv.n }) : t('collab.inviteNote', { name: inv.n })} · {inv.m === 'relay' ? t('collab.relay') : t('collab.p2p')}
            </span>
            <Check size={15} className="ok" />
          </div>
        )}
        <Field label={t('collab.yourName')} hint={t('collab.yourNameHint')}>
          <input className="input" value={name} placeholder={t('collab.namePh')} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="btn-row">
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn primary grad" disabled={!inv} onClick={join}>
            <LogIn size={15} /> {t('collab.join')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CollabSettings({ onJoin }: { onJoin(): void }) {
  const t = useT();
  const shares = useData((s) => s.shares.filter((x) => !x.deleted));
  const settings = useData((s) => s.settings);
  const setSettings = useData((s) => s.setSettings);
  const pres = useCollab();
  return (
    <Card icon={<Radio size={18} />} title={t('collab.settings')} subtitle={t('collab.settingsSub')}>
      <div className="grid2">
        <Field label={t('collab.yourName')} hint={t('collab.yourNameHint')}>
          <input className="input" value={settings.collab?.name ?? ''} placeholder={t('collab.namePh')} onChange={(e) => setSettings((s) => ({ collab: { ...s.collab, name: e.target.value } }))} />
        </Field>
        <Field label={t('collab.relayUrl')} hint={t('collab.relayDefaultHint')}>
          <input className="input mono" value={settings.collab?.relayUrl ?? ''} placeholder="wss://sync.exemplo.com" onChange={(e) => setSettings((s) => ({ collab: { ...s.collab, relayUrl: e.target.value.trim() || undefined } }))} />
        </Field>
      </div>
      <div className="row-between" style={{ marginTop: 12 }}>
        <b>{t('collab.myShares')}</b>
        <button className="btn sm" onClick={onJoin}>
          <LogIn size={14} /> {t('collab.joinTitle')}
        </button>
      </div>
      {!shares.length && <p className="muted">{t('collab.none')}</p>}
      {shares.map((sh) => {
        const p = pres[sh.id];
        return (
          <div key={sh.id} className="backup-row">
            <span>
              {sh.kind === 'folder' ? <Folder size={14} /> : <FileText size={14} />} {sh.name}
            </span>
            <small>
              {sh.mode === 'relay' ? t('collab.relay') : t('collab.p2p')} · {p?.peers.length ? t('collab.nOnline', { n: p.peers.length }) : t('collab.nobodyShort')}
              {sh.owner ? '' : ` · ${t('collab.joinedTag')}`}
            </small>
            <span className="btn-row">
              <button className="btn sm" onClick={() => (copyText(inviteLink(sh)), toast(t('collab.copied'), 'ok'))}>
                <Copy size={13} />
              </button>
              <button
                className="btn sm danger-text"
                onClick={async () => (await askConfirm({ message: t('collab.stopConfirm'), danger: true, ok: t('collab.stop') })) && stopShare(sh.id)}
              >
                <X size={13} />
              </button>
            </span>
          </div>
        );
      })}
    </Card>
  );
}
