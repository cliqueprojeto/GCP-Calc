import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, CreditCard, ExternalLink, Heart } from 'lucide-react';
import { Modal } from './ui';
import { Logo } from './Logo';
import { copyText, openUrl } from '../lib/platform';
import { toast, useUi } from '../store/ui';
import { useT } from '../i18n';
import { DEV_URL } from './Sidebar';

export const PIX_CODE =
  '00020126850014br.gov.bcb.pix0136e474b71b-7491-4eac-992f-632652e5a4eb0223DEV GESTAO CULTURAL PRO5204000053039865802BR5915BRUNO ALBERTINI6006BRASIL62200516ChromeExtensions63042B27';
export const STRIPE_URL = 'https://donate.stripe.com/fZu4gzeBSfhbd7451F6Ri00';

export function Support() {
  const t = useT();
  const { support, set } = useUi();
  const [qr, setQr] = useState('');
  const [showCode, setShowCode] = useState(false);
  useEffect(() => {
    if (support && !qr) QRCode.toDataURL(PIX_CODE, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#0f1b3d', light: '#ffffff' } }).then(setQr);
  }, [support, qr]);

  return (
    <Modal open={support} onClose={() => set({ support: false })} title={null as unknown as string} wide className="support">
      <div className="sup-eyebrow">
        <Heart size={13} /> {t('support.eyebrow')}
      </div>
      <h2 className="sup-title">{t('support.title')}</h2>
      <p className="sup-sub">{t('support.subtitle')}</p>

      <div className="sup-dev">
        <Logo size={58} />
        <div>
          <div className="sup-dev-name">
            {t('app.developedBy')} Bruno Albertini
          </div>
          <button className="link" onClick={() => openUrl(DEV_URL)}>
            Gestão Cultural Pro <ExternalLink size={12} />
          </button>
          <p>{t('support.free')}</p>
        </div>
      </div>

      <div className="sup-grid">
        <section className="sup-card">
          <div className="sup-label">PIX • {t('support.brazil')}</div>
          <div className="sup-qr">{qr ? <img src={qr} alt="QR Code PIX" /> : <div className="qr-skel" />}</div>
          <p className="muted center">{t('support.scan')}</p>
          <button
            className="btn primary block grad"
            onClick={() => {
              copyText(PIX_CODE);
              toast(t('support.pixCopied'), 'ok');
            }}
          >
            <Copy size={16} /> {t('support.copyPix')}
          </button>
          <button className="link sup-toggle" onClick={() => setShowCode((s) => !s)}>
            {showCode ? '▾' : '▸'} {t('support.showPix')}
          </button>
          {showCode && <code className="sup-code">{PIX_CODE}</code>}
        </section>

        <section className="sup-card">
          <div className="sup-label">STRIPE • {t('support.international')}</div>
          <div className="sup-heart">
            <Heart size={34} />
          </div>
          <h3>{t('support.title')}</h3>
          <p className="muted">{t('support.stripeText')}</p>
          <button className="btn block outline" onClick={() => openUrl(STRIPE_URL)}>
            <CreditCard size={16} /> {t('support.stripeButton')} <ExternalLink size={13} />
          </button>
          <button
            className="link"
            onClick={() => {
              copyText(STRIPE_URL);
              toast(t('support.stripeCopied'), 'ok');
            }}
          >
            <Copy size={13} /> {t('support.copyStripe')}
          </button>
          <p className="sup-note">{t('support.voluntary')}</p>
        </section>
      </div>
    </Modal>
  );
}
