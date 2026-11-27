/**
 * Anotar por voz: grava, transcreve (ditado ao vivo ou IA) e transforma em linhas de cálculo
 * com prévia, para inserir no bloco — e, se quiser, organizar e guardar o áudio na nota.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ListTree, Loader2, Mic, Pause, RefreshCw, Square, Trash2 } from 'lucide-react';
import { Modal, Toggle } from './ui';
import { evaluateDocument, newDocState } from '../engine/evaluate';
import { currencySymbol, formatValue, type EvalContext, type FormatOptions } from '../engine/value';
import { audioProviders, blobToDataUrl, canLiveDictate, canRecord, MAX_RECORD_MS, Recorder, transcribe, type Recording } from '../lib/voice';
import { dictationGoal, dictationItems } from '../lib/dictation';
import { classifyTerm, type Kind } from '../engine/vocab';
import { offlineAvailable, transcribeOffline } from '../lib/whisper';
import { useData } from '../store/data';
import { toast, useUi } from '../store/ui';
import { nextStep, orderedProviders } from '../ai/assist';
import { useT } from '../i18n';

export interface VoiceResult {
  lines: string[];
  /** itens com a classificação receita/despesa (para entrarem na seção que já existe) */
  items: { line: string; tone?: Kind }[];
  organize: boolean;
  transcript: string;
  audio?: { src: string; mime: string; ms: number; transcript: string };
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export function VoiceCapture({ ctx, fmt, noteContext, existing, onDone, onClose }: { ctx: EvalContext; fmt: FormatOptions; noteContext: string; existing?: { blob: Blob; ms: number; transcript?: string }; onDone(r: VoiceResult): void; onClose(): void }) {
  const t = useT();
  const settings = useData((s) => s.settings);
  const setSettings = useData((s) => s.setSettings);
  const [phase, setPhase] = useState<'idle' | 'rec' | 'work' | 'review'>(existing ? 'work' : 'idle');
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [rec, setRec] = useState<Recording | null>(existing ? { blob: existing.blob, mime: existing.blob.type, ms: existing.ms, live: existing.transcript ?? '' } : null);
  const [transcript, setTranscript] = useState(existing?.transcript ?? '');
  const [lines, setLines] = useState('');
  const [status, setStatus] = useState('');
  const [usedAi, setUsedAi] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const keep = settings.keepAudio !== false;
  const providers = orderedProviders(settings.ai.providers, settings.ai.active);
  const audioAi = audioProviders(settings.ai.providers);
  const [offline, setOffline] = useState<boolean | null>(null);
  const [translate, setTranslate] = useState(false);
  useEffect(() => {
    void offlineAvailable().then(setOffline);
  }, []);

  const toneMap = useRef(new Map<string, Kind | undefined>());
  const toLines = async (text: string) => {
    const items = dictationItems(text, ctx.lang, { decimal: ctx.decimal, symbol: currencySymbol(useData.getState().settings.baseCurrency, fmt) });
    toneMap.current = new Map(items.map((x) => [x.line, x.tone]));
    const offline = items.map((x) => x.line);
    setLines(offline.join('\n'));
    setUsedAi(false);
    if (!providers.length || !text.trim()) return;
    setStatus(t('voice.organizing'));
    try {
      const step = await nextStep(providers, { lang: ctx.lang, decimal: ctx.decimal, baseCurrency: settings.baseCurrency, goal: dictationGoal(text, ctx.lang), noteContext, turns: [], inline: true });
      if (step.type === 'result' && step.lines.length) {
        setLines(step.lines.filter((l) => l.trim()).join('\n'));
        setUsedAi(true);
      }
    } catch {
      /* fica a conversão sem IA */
    } finally {
      setStatus('');
    }
  };

  const process = async (r: Recording) => {
    setPhase('work');
    let text = translate ? '' : transcript || r.live;
    // 1º Whisper embutido (offline); 2º IA configurada
    if (!text && (await offlineAvailable())) {
      setStatus(t('voice.offlineWorking'));
      try {
        text = await transcribeOffline(r.blob, ctx.lang, {
          translate,
          onStatus: (s) => setStatus(s === 'loading' ? t('voice.offlineLoading') : s === 'working' ? t('voice.offlineWorking') : `${t('voice.offlineLoading')} ${s}%`),
        });
      } catch (e) {
        console.warn('whisper', e);
      }
    }
    if (!text && audioAi.length) {
      setStatus(t('voice.transcribing'));
      try {
        text = await transcribe(settings.ai.providers, r.blob, ctx.lang);
      } catch (e) {
        toast(`${t('voice.transcribeFail')}: ${String((e as Error)?.message || e).slice(0, 140)}`, 'error');
      }
    }
    setTranscript(text);
    await toLines(text);
    setStatus('');
    setPhase('review');
  };

  // áudio já salvo na nota: transcreve direto
  useEffect(() => {
    if (existing && rec) void process(rec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'rec') return;
    const id = setInterval(() => {
      const ms = recorder.current?.elapsed ?? 0;
      setElapsed(ms);
      if (ms >= MAX_RECORD_MS) void stop();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => recorder.current?.cancel(), []);

  const start = async () => {
    if (!canRecord()) return toast(t('voice.unsupported'), 'error');
    const r = new Recorder(ctx.lang, setLevel, setLive);
    try {
      await r.start();
    } catch {
      toast(t('voice.micDenied'), 'error');
      return;
    }
    recorder.current = r;
    setLive('');
    setTranscript('');
    setPhase('rec');
  };

  const stop = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const out = await r.stop();
    setRec(out);
    await process(out);
  };

  const preview = useMemo(() => {
    const doc = evaluateDocument(lines, ctx, newDocState());
    return lines.split('\n').map((l, i) => ({ l, r: doc.lines[i] }));
  }, [lines, ctx]);

  const finish = async (organize: boolean) => {
    const out = lines.split('\n').filter((l) => l.trim());
    let audio: VoiceResult['audio'];
    if (keep && rec && !existing) audio = { src: await blobToDataUrl(rec.blob), mime: rec.mime, ms: rec.ms, transcript };
    const overall = classifyTerm(transcript);
    const items = out.map((line) => ({ line, tone: toneMap.current.get(line) ?? classifyTerm(line) ?? overall }));
    onDone({ lines: out, items, organize, audio, transcript });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={t('voice.title')} className="voice-modal">
      {phase === 'idle' && (
        <div className="voice-idle">
          <button className="voice-big" onClick={start} aria-label={t('voice.start')}>
            <Mic size={34} />
          </button>
          <p>{t('voice.idleHint')}</p>
          <p className="muted small">
            {offline ? t('voice.offlineOk') : canLiveDictate() ? t('voice.liveOk') : audioAi.length ? t('voice.aiOk', { name: audioAi[0].name }) : t('voice.noAi')}
          </p>
          {offline && ctx.lang !== 'en' && <Toggle checked={translate} onChange={setTranslate} label={t('voice.translate')} />}
          {!offline && !audioAi.length && !canLiveDictate() && (
            <button className="link" onClick={() => (useUi.getState().go({ kind: 'settings', section: 'ai' }), onClose())}>
              {t('voice.setupAi')}
            </button>
          )}
        </div>
      )}
      {phase === 'rec' && (
        <div className="voice-rec">
          <div className="voice-meter">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ height: `${8 + Math.max(0, level * 100 - Math.abs(12 - i) * 6)}%` }} />
            ))}
          </div>
          <div className="voice-time">
            <span className="rec-dot" /> {mmss(elapsed)} <small>/ {mmss(MAX_RECORD_MS)}</small>
          </div>
          {live && <p className="voice-live">{live}</p>}
          <div className="btn-row center">
            <button className="btn" onClick={() => (recorder.current?.cancel(), recorder.current = null, setPhase('idle'))}>
              <Trash2 size={15} /> {t('voice.discard')}
            </button>
            <button className="btn primary" onClick={stop}>
              <Square size={14} /> {t('voice.stop')}
            </button>
          </div>
        </div>
      )}
      {phase === 'work' && (
        <div className="voice-work">
          <Loader2 size={26} className="spin" />
          <p>{status || t('voice.transcribing')}</p>
        </div>
      )}
      {phase === 'review' && (
        <div className="voice-review">
          {rec && <audio controls src={URL.createObjectURL(rec.blob)} className="voice-audio" />}
          <label className="voice-label">{t('voice.transcript')}</label>
          <textarea className="input voice-text" rows={3} value={transcript} placeholder={audioAi.length || canLiveDictate() ? '' : t('voice.typeHere')} onChange={(e) => setTranscript(e.target.value)} />
          <div className="btn-row">
            <button className="btn small" onClick={() => void toLines(transcript)} disabled={!transcript.trim() || !!status}>
              {status ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} {t('voice.reconvert')}
            </button>
            <span className="muted small">{status || (usedAi ? t('voice.byAi') : t('voice.offline'))}</span>
          </div>
          <label className="voice-label">{t('voice.lines')}</label>
          <div className="voice-lines">
            <textarea className="input mono" rows={Math.min(10, Math.max(3, preview.length))} value={lines} onChange={(e) => setLines(e.target.value)} />
            <div className="voice-res">
              {preview.map(({ r }, i) => (
                <div key={i} className={r?.tone ? 'tone-' + r.tone : ''}>
                  {r?.kind === 'value' && r.value ? formatValue(r.value, fmt) : ' '}
                </div>
              ))}
            </div>
          </div>
          {!existing && rec && <Toggle checked={keep} onChange={(keepAudio) => setSettings({ keepAudio })} label={t('voice.keep')} />}
          <div className="btn-row">
            <button className="btn" onClick={() => (setPhase('idle'), setRec(null), setLines(''), setTranscript(''))}>
              {existing ? <Pause size={15} /> : <Mic size={15} />} {existing ? t('common.close') : t('voice.again')}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn" disabled={!lines.trim()} onClick={() => finish(true)}>
              <ListTree size={15} /> {t('voice.insertOrganize')}
            </button>
            <button className="btn primary" disabled={!lines.trim() && !(keep && rec)} onClick={() => finish(false)}>
              <Check size={15} /> {t('voice.insert')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
