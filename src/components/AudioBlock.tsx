/** Bloco de áudio: anotação de voz guardada na nota, com transcrição e conversão em cálculo. */
import { useEffect, useState } from 'react';
import { AudioLines, Mic } from 'lucide-react';
import type { Block } from '../lib/types';
import { useLang, useT, LOCALES } from '../i18n';

type AudioB = Extract<Block, { type: 'audio' }>;

export function AudioBlock({ block, onTranscribe }: { block: AudioB; onTranscribe(): void }) {
  const t = useT();
  const lang = useLang();
  const [url, setUrl] = useState('');
  useEffect(() => {
    // data URL → blob URL (o <audio> do Android toca melhor assim)
    let u = '';
    try {
      const [head, data] = block.src.split(',');
      const mime = head.match(/data:([^;]+)/)?.[1] ?? block.mime;
      const bin = atob(data);
      u = URL.createObjectURL(new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: mime }));
      setUrl(u);
    } catch {
      setUrl(block.src);
    }
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [block.src, block.mime]);
  const secs = Math.round(block.ms / 1000);
  return (
    <div className="audio-blk">
      <div className="audio-head">
        <span className="audio-ico">
          <AudioLines size={18} />
        </span>
        <div className="audio-meta">
          <b>{t('voice.memo')}</b>
          <small>
            {new Date(block.created).toLocaleString(LOCALES[lang], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </small>
        </div>
        <button className="btn small" onClick={onTranscribe}>
          <Mic size={14} /> {block.transcript ? t('voice.toCalc') : t('voice.transcribe')}
        </button>
      </div>
      {url && <audio controls preload="metadata" src={url} />}
      {block.transcript && <p className="audio-text">“{block.transcript}”</p>}
    </div>
  );
}
