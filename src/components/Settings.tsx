import { PermissionsSettings } from './Permissions';
import { SecuritySettings } from './Lock';
import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Calculator,
  Check,
  CloudUpload,
  Coins,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Globe,
  HardDrive,
  Heart,
  Info,
  KeyRound,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Info as InfoIcon,
  Tags,
  Trash2,
  Type,
  GitBranch,
  ShieldCheck,
  Mic,
  BookOpen,
  FileJson,
} from 'lucide-react';
import { Card, Field, Select, Toggle } from './ui';
import { useData, activeTags } from '../store/data';
import { toast, useUi } from '../store/ui';
import { useLang, useT, LOCALES } from '../i18n';
import { THEMES, resolveTheme, SYN_KEYS, FONTS, type ThemeGroup, type SynKey } from '../lib/themes';
import { CURRENCIES } from '../engine/currencies';
import { useRates } from '../lib/rates';
import { PROVIDERS, providerMeta, testProvider, guessProvider } from '../ai/providers';
import { APP_VERSION, isMobile, isTauri, openUrl, pickTextFile, platformInfo, saveTextFile, uid } from '../lib/platform';
import { resetMicPosition } from './VoiceFab';
import { DriveGuide, parseGoogleClientJson } from './DriveGuide';
import { RELEASES_URL, REPO, canAutoInstall, downloadAndInstall } from '../lib/updater';
import { runUpdateCheck, useUpdateStore } from './UpdateBanner';
import { connect, disconnect, backupNow, listBackups, restoreBackup, syncNow, verifyPassphraseAgainstCloud, hasBuiltInClient, clientConfig, type CloudFile } from '../cloud/cloud';
import { useSync, SYNC_DELAYS, syncSoon } from '../cloud/autosync';
import { seal, open as openSealed, type Sealed } from '../cloud/crypto';
import type { AiProvider, DataDoc, UpdateFrequency } from '../lib/types';
import { Logo } from './Logo';
import { DEV_URL } from './Sidebar';
import { useEvalContext, formatOptions } from '../lib/calcContext';
import { evaluateLine, newDocState } from '../engine/evaluate';
import { formatValue } from '../engine/value';

type Section = 'general' | 'calc' | 'currency' | 'ai' | 'backup' | 'security' | 'permissions' | 'updates' | 'about';

export function SettingsView({ initial }: { initial?: string }) {
  const t = useT();
  const [sec, setSec] = useState<Section>((initial as Section) || 'general');
  useEffect(() => {
    if (initial) setSec(initial as Section);
  }, [initial]);
  const NAV: { id: Section; icon: JSX.Element; label: string }[] = [
    { id: 'general', icon: <Palette size={16} />, label: t('settings.general') },
    { id: 'calc', icon: <Calculator size={16} />, label: t('settings.calc') },
    { id: 'currency', icon: <Coins size={16} />, label: t('settings.currency') },
    { id: 'ai', icon: <Bot size={16} />, label: t('settings.ai') },
    { id: 'backup', icon: <CloudUpload size={16} />, label: t('settings.backup') },
    { id: 'security', icon: <KeyRound size={16} />, label: t('lock.section') },
    { id: 'permissions', icon: <ShieldCheck size={16} />, label: t('perm.section') },
    { id: 'updates', icon: <RefreshCw size={16} />, label: t('settings.updates') },
    { id: 'about', icon: <Info size={16} />, label: t('settings.about') },
  ];
  return (
    <div className="page settings">
      <div className="eyebrow">
        GCP-CALC
      </div>
      <h1>{t('settings.title')}</h1>
      <p className="page-sub">{t('settings.subtitle')}</p>
      <div className="set-layout">
        <nav className="set-nav">
          {NAV.map((n) => (
            <button key={n.id} className={sec === n.id ? 'on' : ''} onClick={() => setSec(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div className="set-body">
          {sec === 'general' && <General />}
          {sec === 'security' && (
            <Card icon={<KeyRound size={18} />} title={t('lock.section')} subtitle={t('lock.sectionSub')}>
              <SecuritySettings />
            </Card>
          )}
          {sec === 'permissions' && (
            <Card icon={<ShieldCheck size={18} />} title={t('perm.section')} subtitle={t('perm.sectionSub')}>
              <PermissionsSettings />
            </Card>
          )}
          {sec === 'calc' && <CalcSettings />}
          {sec === 'currency' && <CurrencySettings />}
          {sec === 'ai' && <AiSettings />}
          {sec === 'backup' && <BackupSettings />}
          {sec === 'updates' && <UpdateSettings />}
          {sec === 'about' && <About />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ geral

const SAMPLE = ['# Orçamento', 'aluguel = R$ 1.850', 'Mercado: 620 + 15%', '5 km em milhas  // conversão', 'hoje + 30 dias', 'sqrt(144) * aluguel'];

function General() {
  const t = useT();
  const { settings, setSettings } = useData();
  const ctx = useEvalContext();
  const fmt = formatOptions(ctx);
  const current = resolveTheme(settings.theme, settings.customTheme);
  const overrides = settings.synColors[current.id] ?? {};
  const groups: { id: ThemeGroup; label: string }[] = [
    { id: 'premium-dark', label: t('theme.premiumDark') },
    { id: 'premium-light', label: t('theme.premiumLight') },
    { id: 'editor', label: t('theme.editor') },
    { id: 'dark', label: t('theme.dark') },
    { id: 'light', label: t('theme.light') },
  ];
  const setSyn = (k: SynKey, v: string | null) =>
    setSettings((s) => {
      const cur = { ...(s.synColors[current.id] ?? {}) };
      if (v) cur[k] = v;
      else delete cur[k];
      return { synColors: { ...s.synColors, [current.id]: cur } };
    });
  const sample = useMemo(() => {
    const st = newDocState();
    return SAMPLE.map((l) => evaluateLine(l, ctx, st));
  }, [ctx]);

  return (
    <>
      <Card icon={<Globe size={18} />} title={t('settings.language')} subtitle={t('settings.languageHint')}>
        <Select
          value={settings.lang}
          onChange={(lang) => setSettings({ lang })}
          options={[
            { value: 'auto', label: t('settings.langAuto') },
            { value: 'pt', label: 'Português (Brasil)' },
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      </Card>

      <Card icon={<Palette size={18} />} title={t('settings.theme')} subtitle={t('settings.themeHint')}>
        {groups.map((g) => (
          <div key={g.id} className="theme-group">
            <div className="tg-label">{g.label}</div>
            <div className="theme-grid">
              {THEMES.filter((x) => x.group === g.id).map((th) => (
                <button key={th.id} className={`theme-chip ${settings.theme === th.id ? 'on' : ''}`} onClick={() => setSettings({ theme: th.id })} title={th.name}>
                  <span className="tc-swatch" style={{ background: th.vars['--bg'] }}>
                    <i style={{ background: th.syn.num }} />
                    <i style={{ background: th.syn.op }} />
                    <i style={{ background: th.syn.res }} />
                  </span>
                  <span className="tc-name">{th.name}</span>
                  {settings.theme === th.id && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="theme-grid">
          <button className={`theme-chip ${settings.theme === 'system' ? 'on' : ''}`} onClick={() => setSettings({ theme: 'system' })}>
            <span className="tc-swatch split" />
            <span className="tc-name">{t('theme.system')}</span>
          </button>
          <button className={`theme-chip ${settings.theme === 'custom' ? 'on' : ''}`} onClick={() => setSettings({ theme: 'custom' })}>
            <span className="tc-swatch" style={{ background: settings.customTheme.accent }} />
            <span className="tc-name">{t('theme.custom')}</span>
          </button>
        </div>
        {settings.theme === 'custom' && (
          <div className="custom-theme">
            <Toggle checked={settings.customTheme.dark} onChange={(dark) => setSettings((s) => ({ customTheme: { ...s.customTheme, dark } }))} label={t('theme.darkMode')} />
            <div className="color-row">
              {(['bg', 'panel', 'text', 'accent', 'accent2'] as const).map((k) => (
                <label key={k} className="color-field">
                  <input type="color" value={settings.customTheme[k]} onChange={(e) => setSettings((s) => ({ customTheme: { ...s.customTheme, [k]: e.target.value } }))} />
                  <span>{t(`theme.c.${k}` as 'theme.c.bg')}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        icon={<Type size={18} />}
        title={t('settings.syntax')}
        subtitle={t('settings.syntaxHint', { theme: current.name })}
        actions={
          Object.keys(overrides).length > 0 && (
            <button className="btn sm" onClick={() => setSettings((s) => ({ synColors: { ...s.synColors, [current.id]: {} } }))}>
              <RotateCcw size={14} /> {t('settings.syntaxReset')}
            </button>
          )
        }
      >
        <div className="syntax-preview">
          {SAMPLE.map((l, i) => (
            <div key={i} className="sp-line">
              <span className="sp-src">
                {sample[i].segments.map((s, j) => (
                  <span key={j} className={`s-${s.cls}`}>
                    {s.text}
                  </span>
                ))}
              </span>
              <span className="sp-res">{sample[i].value ? formatValue(sample[i].value!, fmt) : ''}</span>
            </div>
          ))}
        </div>
        <div className="syn-grid">
          {SYN_KEYS.map((k) => (
            <label key={k} className={`syn-field ${overrides[k] ? 'custom' : ''}`}>
              <input type="color" value={toHex(overrides[k] || current.syn[k])} onChange={(e) => setSyn(k, e.target.value)} />
              <span className={`s-${k === 'res' ? 'num' : k}`} style={{ color: `var(--syn-${k})` }}>
                {t(`syn.${k}` as 'syn.num')}
              </span>
              {overrides[k] && (
                <button className="icon-btn xs" onClick={() => setSyn(k, null)} title={t('settings.syntaxReset')}>
                  <RotateCcw size={11} />
                </button>
              )}
            </label>
          ))}
        </div>
      </Card>

      <Card icon={<Type size={18} />} title={t('settings.editor')} subtitle={t('settings.editorHint')}>
        <div className="grid3">
          <Field label={t('settings.font')}>
            <Select value={settings.font} onChange={(font) => setSettings({ font })} options={FONTS.map((f) => ({ value: f.id, label: f.name }))} />
          </Field>
          <Field label={t('settings.fontSize')}>
            <Select value={settings.fontSize} onChange={(fontSize) => setSettings({ fontSize })} options={[13, 14, 15, 16, 17, 18, 20, 22, 24].map((n) => ({ value: n, label: `${n}px` }))} />
          </Field>
          <Field label={t('settings.keypad')}>
            <Select
              value={settings.keypad}
              onChange={(keypad) => setSettings({ keypad })}
              options={[
                { value: 'auto', label: t('settings.keypadAuto') },
                { value: 'on', label: t('settings.keypadOn') },
              ]}
            />
          </Field>
          {isMobile && (
            <button className="btn sm" onClick={() => (resetMicPosition(), toast(t('settings.micReset'), 'ok'))}>
              <Mic size={14} /> {t('settings.micResetBtn')}
            </button>
          )}
        </div>
        <Toggle checked={settings.lineNumbers} onChange={(lineNumbers) => setSettings({ lineNumbers })} label={t('settings.lineNumbers')} />
        <Toggle checked={settings.autoFormat !== false} onChange={(autoFormat) => setSettings({ autoFormat })} label={t('settings.autoFormat')} />
        <Toggle checked={settings.autocomplete !== false} onChange={(autocomplete) => setSettings({ autocomplete })} label={t('settings.autocomplete')} />
      </Card>
    </>
  );
}


/** Converte qualquer cor CSS simples para #rrggbb (o seletor nativo só aceita hex). */
function toHex(c: string) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).replace(/./g, (x) => x + x);
  try {
    const el = document.createElement('div');
    el.style.color = c;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color.match(/\d+/g);
    el.remove();
    if (rgb) return '#' + rgb.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
  } catch {
    /* fallback */
  }
  return '#888888';
}

// ---------------------------------------------------------------- cálculo

function CalcSettings() {
  const t = useT();
  const { settings, setSettings } = useData();
  return (
    <>
      <Card icon={<Calculator size={18} />} title={t('settings.numbers')} subtitle={t('settings.numbersHint')}>
        <div className="grid2">
          <Field label={t('settings.decimal')}>
            <Select
              value={settings.decimal}
              onChange={(decimal) => setSettings({ decimal })}
              options={[
                { value: 'auto', label: t('settings.decimalAuto') },
                { value: 'comma', label: t('settings.decimalComma') },
                { value: 'dot', label: t('settings.decimalDot') },
              ]}
            />
          </Field>
          <Field label={t('settings.precision')}>
            <Select value={settings.precision} onChange={(precision) => setSettings({ precision })} options={[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
          <Field label={t('settings.angle')}>
            <Select
              value={settings.angle}
              onChange={(angle) => setSettings({ angle })}
              options={[
                { value: 'deg', label: t('settings.degrees') },
                { value: 'rad', label: t('settings.radians') },
              ]}
            />
          </Field>
          <Field label={t('settings.dateOrder')}>
            <Select
              value={settings.dateOrder}
              onChange={(dateOrder) => setSettings({ dateOrder })}
              options={[
                { value: 'auto', label: t('settings.auto') },
                { value: 'dmy', label: 'DD/MM/AAAA' },
                { value: 'mdy', label: 'MM/DD/YYYY' },
              ]}
            />
          </Field>
        </div>
        <Toggle checked={settings.grouping} onChange={(grouping) => setSettings({ grouping })} label={t('settings.grouping')} hint={t('settings.groupingHint')} />
      </Card>
      <Card icon={<Info size={18} />} title={t('settings.syntaxGuide')} subtitle={t('settings.syntaxGuideHint')}>
        <div className="guide">
          {(t('guide.lines') as string).split('\n').map((l, i) => {
            const [a, b] = l.split('|');
            return (
              <div key={i} className="guide-row">
                <code>{a}</code>
                <span>{b}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// ----------------------------------------------------------------- moedas

function CurrencySettings() {
  const t = useT();
  const lang = useLang();
  const { settings, setSettings, tags, upsertTag, deleteTag } = useData();
  const rates = useRates();
  const li = lang === 'pt' ? 0 : lang === 'en' ? 1 : 2;
  const curOptions = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label[li]}` }));
  const [fav, setFav] = useState('');
  return (
    <>
      <Card icon={<Coins size={18} />} title={t('settings.currency')} subtitle={t('settings.currencyHint')}>
        <div className="grid2">
          <Field label={t('settings.baseCurrency')}>
            <Select value={settings.baseCurrency} onChange={(baseCurrency) => setSettings({ baseCurrency })} options={curOptions} />
          </Field>
          <Field label={t('settings.dollarMeans')}>
            <Select value={settings.dollar} onChange={(dollar) => setSettings({ dollar })} options={curOptions.filter((c) => ['USD', 'CAD', 'AUD', 'ARS', 'MXN', 'CLP', 'COP', 'NZD', 'SGD', 'HKD'].includes(c.value))} />
          </Field>
          <Field label={t('settings.currencyPosition')}>
            <Select
              value={settings.currencyPosition}
              onChange={(currencyPosition) => setSettings({ currencyPosition })}
              options={[
                { value: 'auto', label: t('settings.auto') },
                { value: 'before', label: 'R$ 10,00' },
                { value: 'after', label: '10,00 €' },
              ]}
            />
          </Field>
          <Field label={t('settings.ratesMaxAge')}>
            <Select value={settings.ratesMaxAge} onChange={(ratesMaxAge) => setSettings({ ratesMaxAge })} options={[1, 3, 6, 12, 24].map((h) => ({ value: h, label: t('settings.hours', { n: h }) }))} />
          </Field>
        </div>
        <Toggle checked={settings.ratesOnOpen} onChange={(ratesOnOpen) => setSettings({ ratesOnOpen })} label={t('settings.ratesOnOpen')} hint={t('settings.ratesOnOpenHint')} />
        <div className="rates-box">
          <div>
            <b>{rates.fetched ? t('rates.updatedAt', { when: new Date(rates.fetched).toLocaleString(LOCALES[lang]) }) : t('rates.never')}</b>
            <small>
              {rates.source || '—'} · {t('rates.count', { n: Object.keys(rates.rates).length })}
            </small>
            {rates.status === 'error' && <small className="danger">{rates.error}</small>}
          </div>
          <button className="btn" onClick={() => rates.refresh(true)}>
            <RefreshCw size={15} className={rates.status === 'loading' ? 'spin' : ''} /> {t('rates.refreshNow')}
          </button>
        </div>
        <Field label={t('settings.favorites')} hint={t('settings.favoritesHint')}>
          <div className="chips-edit">
            {settings.favoriteCurrencies.map((c) => (
              <span key={c} className="chip static">
                {c}
                <button onClick={() => setSettings({ favoriteCurrencies: settings.favoriteCurrencies.filter((x) => x !== c) })}>×</button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const c = fav.trim().toUpperCase();
                if (c && !settings.favoriteCurrencies.includes(c)) setSettings({ favoriteCurrencies: [...settings.favoriteCurrencies, c] });
                setFav('');
              }}
            >
              <input className="input sm" value={fav} onChange={(e) => setFav(e.target.value)} placeholder="+ CHF" maxLength={6} />
            </form>
          </div>
        </Field>
      </Card>

      <Card
        icon={<Tags size={18} />}
        title={t('tags.title')}
        subtitle={t('tags.subtitle')}
        actions={
          <button className="btn sm primary" onClick={() => upsertTag({ id: uid(), name: 'tag' + (activeTags(tags).length + 1), alias: 'USD' })}>
            <Plus size={14} /> {t('tags.add')}
          </button>
        }
      >
        {!activeTags(tags).length && <p className="muted">{t('tags.empty')}</p>}
        <div className="tags-list">
          {activeTags(tags).map((tag) => (
            <div key={tag.id} className="tag-row">
              <span className="tag-hash">#</span>
              <input className="input sm" value={tag.name} onChange={(e) => upsertTag({ ...tag, name: e.target.value.replace(/[^\p{L}\p{N}_]/gu, '') })} />
              <Select
                value={tag.alias ? 'alias' : 'rate'}
                onChange={(m) => upsertTag(m === 'alias' ? { ...tag, alias: tag.alias || 'USD', rate: undefined, of: undefined } : { ...tag, alias: undefined, rate: tag.rate ?? 1, of: tag.of ?? settings.baseCurrency })}
                options={[
                  { value: 'alias', label: t('tags.alias') },
                  { value: 'rate', label: t('tags.custom') },
                ]}
              />
              {tag.alias ? (
                <Select value={tag.alias} onChange={(alias) => upsertTag({ ...tag, alias })} options={curOptions} />
              ) : (
                <span className="tag-rate">
                  1 = <input className="input sm num" type="number" step="any" value={tag.rate ?? 1} onChange={(e) => upsertTag({ ...tag, rate: parseFloat(e.target.value) || 0 })} />
                  <Select value={tag.of ?? settings.baseCurrency} onChange={(of) => upsertTag({ ...tag, of })} options={curOptions} />
                </span>
              )}
              <input className="input sm sym" value={tag.symbol ?? ''} placeholder={t('tags.symbol')} onChange={(e) => upsertTag({ ...tag, symbol: e.target.value })} />
              <button className="icon-btn" onClick={() => deleteTag(tag.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="field-hint">{t('tags.example')}</p>
      </Card>
    </>
  );
}

// --------------------------------------------------------------------- IA

function AiSettings() {
  const t = useT();
  const { settings, setSettings } = useData();
  const ai = settings.ai;
  const [testing, setTesting] = useState<string | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const save = (providers: AiProvider[], active = ai.active) => setSettings({ ai: { ...ai, providers, active } });
  const update = (id: string, p: Partial<AiProvider>) => save(ai.providers.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const test = async (p: AiProvider) => {
    setTesting(p.id);
    try {
      const r = await testProvider(p);
      update(p.id, r);
      toast(t('ai.testOk', { n: r.models?.length ?? 0 }), 'ok');
    } catch (e) {
      toast(t('ai.testFail', { error: String((e as Error)?.message || e).slice(0, 140) }), 'error');
    } finally {
      setTesting(null);
    }
  };
  return (
    <>
      <Card
        icon={<Bot size={18} />}
        title={t('ai.title')}
        subtitle={t('ai.subtitle')}
        actions={
          <button
            className="btn sm primary"
            onClick={() => {
              const id = uid();
              save([...ai.providers, { id, kind: 'anthropic', name: 'Anthropic', apiKey: '' }], ai.active ?? id);
            }}
          >
            <Plus size={14} /> {t('ai.add')}
          </button>
        }
      >
        {!ai.providers.length && <p className="muted">{t('ai.empty')}</p>}
        {ai.providers.map((p) => {
          const meta = providerMeta(p.kind);
          return (
            <div key={p.id} className={`ai-prov ${ai.active === p.id ? 'active' : ''}`}>
              <div className="ai-row">
                <label className="radio">
                  <input type="radio" checked={ai.active === p.id} onChange={() => save(ai.providers, p.id)} />
                  {t('ai.use')}
                </label>
                <Select value={p.kind} onChange={(kind) => update(p.id, { kind, name: providerMeta(kind).name, models: undefined, model: undefined, baseUrl: undefined })} options={PROVIDERS.map((x) => ({ value: x.kind, label: x.name }))} />
                <button className="icon-btn" onClick={() => save(ai.providers.filter((x) => x.id !== p.id), ai.active === p.id ? ai.providers.find((x) => x.id !== p.id)?.id : ai.active)}>
                  <Trash2 size={15} />
                </button>
              </div>
              {meta.needsKey && (
                <Field
                  label={
                    <>
                      <KeyRound size={13} /> {t('ai.key')}{' '}
                      {meta.keyUrl && (
                        <button className="link" onClick={() => openUrl(meta.keyUrl)}>
                          {t('ai.getKey')} <ExternalLink size={11} />
                        </button>
                      )}
                    </>
                  }
                >
                  <div className="input-group">
                    <input
                      className="input"
                      type={show[p.id] ? 'text' : 'password'}
                      value={p.apiKey}
                      placeholder={meta.hint}
                      onChange={(e) => {
                        const k = e.target.value;
                        const g = guessProvider(k);
                        update(p.id, g && g !== p.kind && !p.apiKey ? { apiKey: k, kind: g, name: providerMeta(g).name } : { apiKey: k });
                      }}
                    />
                    <button className="icon-btn" onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}>
                      {show[p.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              )}
              {(p.kind === 'ollama' || p.kind === 'custom' || p.baseUrl) && (
                <Field label={t('ai.baseUrl')}>
                  <input className="input" value={p.baseUrl ?? ''} placeholder={meta.baseUrl} onChange={(e) => update(p.id, { baseUrl: e.target.value })} />
                </Field>
              )}
              <div className="ai-row">
                <Field label={t('ai.model')}>
                  {p.models?.length ? (
                    <Select value={p.model ?? p.models[0]} onChange={(model) => update(p.id, { model })} options={p.models.map((m) => ({ value: m, label: m }))} />
                  ) : (
                    <input className="input" value={p.model ?? ''} placeholder={t('ai.modelAuto')} onChange={(e) => update(p.id, { model: e.target.value })} />
                  )}
                </Field>
                <button className="btn" disabled={testing === p.id || (meta.needsKey && !p.apiKey)} onClick={() => test(p)}>
                  {testing === p.id ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} {t('ai.test')}
                </button>
              </div>
              {p.checkedAt && <small className="ok-text">✓ {t('ai.checked')}</small>}
            </div>
          );
        })}
      </Card>
      <Card icon={<InfoIcon size={18} />} title={t('ai.howTitle')} subtitle={t('ai.howText')} />
    </>
  );
}

// --------------------------------------------------------- backup e sync

const FILE_FORMAT = 'gcp-calc-backup';

function BackupSettings() {
  const t = useT();
  const lang = useLang();
  const { settings, setSettings, exportDoc, importDoc } = useData();
  const cloud = settings.cloud;
  const acc = cloud.accounts[0];
  const sync = useSync();
  const [busy, setBusy] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [guide, setGuide] = useState(false);
  const importClientJson = async () => {
    const f = await pickTextFile([{ name: 'JSON', extensions: ['json'] }]).catch(() => null);
    if (!f) return;
    const c = parseGoogleClientJson(f.text);
    if (!c) return toast(t('cloud.jsonInvalid'), 'error');
    setSettings((s) => ({ cloud: { ...s.cloud, googleClientId: c.clientId, googleClientSecret: c.clientSecret ?? '' } }));
    toast(c.kind === 'web' ? t('cloud.jsonWeb') : t('cloud.jsonOk'), c.kind === 'web' ? 'error' : 'ok');
    setGuide(false);
  };
  useEffect(() => {
    platformInfo().then((i) => setDataDir(i.data_dir));
  }, []);
  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try {
      await fn();
      if (ok) toast(ok, 'ok');
    } catch (e) {
      const m = String((e as Error)?.message || e);
      toast(m === 'missing-client-id' ? t('cloud.missingClient') : m === 'desktop-only' ? t('cloud.appOnly') : m.includes('wrong-passphrase') ? t('cloud.wrongPass') : m, 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportFile = async () => {
    const pw = prompt(t('file.passwordPrompt')) ?? '';
    const doc = exportDoc();
    const payload = pw ? { format: FILE_FORMAT, encrypted: true, sealed: await seal(pw, JSON.stringify(doc)) } : { format: FILE_FORMAT, encrypted: false, data: doc };
    const d = new Date().toISOString().slice(0, 10);
    const r = await saveTextFile(`GCP-Calc-backup-${d}.gcpcalc`, JSON.stringify(payload), [{ name: 'GCP-Calc', extensions: ['gcpcalc'] }]);
    if (r) toast(t('file.exported'), 'ok');
  };
  const importFile = async () => {
    const f = await pickTextFile([{ name: 'GCP-Calc', extensions: ['gcpcalc', 'json'] }]);
    if (!f) return;
    try {
      const o = JSON.parse(f.text);
      let doc: DataDoc;
      if (o.format === FILE_FORMAT && o.encrypted) doc = JSON.parse(await openSealed(prompt(t('file.passwordAsk')) ?? '', o.sealed as Sealed));
      else doc = o.data ?? o;
      if (!Array.isArray(doc.notes)) throw new Error('invalid');
      const replace = confirm(t('file.replaceConfirm'));
      importDoc(doc, replace ? 'replace' : 'merge');
      toast(t('file.imported', { n: doc.notes.length }), 'ok');
    } catch (e) {
      toast(String((e as Error).message).includes('wrong') ? t('cloud.wrongPass') : t('file.invalid'), 'error');
    }
  };

  const savePass = async () => {
    if (pass.length < 8) return toast(t('cloud.passShort'), 'error');
    await run('pass', async () => {
      if (acc) {
        const r = await verifyPassphraseAgainstCloud(pass);
        if (r === 'wrong') throw new Error('wrong-passphrase');
      }
      setSettings((s) => ({ cloud: { ...s.cloud, passphrase: pass } }));
      setPass('');
      syncSoon();
    }, t('cloud.passSaved'));
  };

  return (
    <>
      <Card icon={<HardDrive size={18} />} title={t('file.title')} subtitle={t('file.subtitle')}>
        <div className="btn-row">
          <button className="btn primary grad" onClick={exportFile}>
            <FileDown size={15} /> {t('file.export')}
          </button>
          <button className="btn" onClick={importFile}>
            <FileUp size={15} /> {t('file.import')}
          </button>
        </div>
        {dataDir && (
          <p className="field-hint mono">
            {t('file.localData')}: {dataDir}
          </p>
        )}
      </Card>

      <Card icon={<CloudUpload size={18} />} title={t('cloud.title')} subtitle={t('cloud.subtitle')}>
        <div className="provider-row">
          <div className="prov-logo gdrive">
            <svg viewBox="0 0 87.3 78" width="26" height="26">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
            </svg>
          </div>
          <div className="prov-info">
            <b>Google Drive</b>
            <small>{acc ? t('cloud.connectedAs', { email: acc.email ?? '—' }) : isTauri ? t('cloud.notConnected') : t('cloud.appOnly')}</small>
          </div>
          <div className="btn-row">
            {acc ? (
              <>
                <button className="btn sm" disabled={!!busy || !cloud.passphrase} onClick={() => run('sync', () => syncNow({}), t('cloud.synced'))}>
                  <RefreshCw size={14} className={busy === 'sync' || sync.status === 'syncing' ? 'spin' : ''} /> {t('cloud.syncNow')}
                </button>
                <button className="btn sm" disabled={!!busy || !cloud.passphrase} onClick={() => run('backup', backupNow, t('cloud.backedUp'))}>
                  <CloudUpload size={14} /> {t('cloud.backupNow')}
                </button>
                <button className="btn sm danger-text" onClick={() => confirm(t('cloud.disconnectConfirm')) && disconnect()}>
                  {t('cloud.disconnect')}
                </button>
              </>
            ) : (
              <button className="btn sm primary grad" disabled={!!busy || !isTauri} onClick={() => run('connect', connect, t('cloud.connected'))}>
                {busy === 'connect' ? <Loader2 size={14} className="spin" /> : <CloudUpload size={14} />} {t('cloud.connect')}
              </button>
            )}
          </div>
        </div>

        <div className="sub-card drive-setup">
          <div className="row-between">
            <b>{t('cloud.setupTitle')}</b>
            {clientConfig().clientId ? (
              <span className="pill ok">
                <Check size={12} /> {cloud.googleClientId ? t('cloud.ownReady') : t('cloud.builtInReady')}
              </span>
            ) : (
              <span className="pill warn">{t('cloud.needClient')}</span>
            )}
          </div>
          <p className="field-hint">{hasBuiltInClient() ? t('cloud.builtIn') : t('cloud.ownClient')}</p>
          <div className="btn-row">
            <button className="btn sm primary grad" onClick={() => setGuide(true)}>
              <BookOpen size={14} /> {t('cloud.guideBtn')}
            </button>
            <button className="btn sm" onClick={importClientJson}>
              <FileJson size={14} /> {t('cloud.importJson')}
            </button>
            <button className="btn sm" onClick={() => setAdvanced((a) => !a)}>
              <KeyRound size={14} /> {t('cloud.typeManually')}
            </button>
          </div>
          {cloud.googleClientId && (
            <small className="muted mono">
              {cloud.googleClientId.slice(0, 18)}…{cloud.googleClientId.slice(-28)}
              {' · '}
              <button className="link" onClick={() => setSettings((s) => ({ cloud: { ...s.cloud, googleClientId: '', googleClientSecret: '' } }))}>
                {t('cloud.clearClient')}
              </button>
            </small>
          )}
          {advanced && (
            <div className="grid1">
              <Field label="Google OAuth Client ID">
                <input className="input mono" value={cloud.googleClientId ?? ''} onChange={(e) => setSettings((s) => ({ cloud: { ...s.cloud, googleClientId: e.target.value.trim() } }))} placeholder="xxxx.apps.googleusercontent.com" />
              </Field>
              <Field label="Client secret">
                <input className="input mono" type="password" value={cloud.googleClientSecret ?? ''} onChange={(e) => setSettings((s) => ({ cloud: { ...s.cloud, googleClientSecret: e.target.value.trim() } }))} />
              </Field>
            </div>
          )}
        </div>
        <DriveGuide open={guide} onClose={() => setGuide(false)} onImport={() => void importClientJson()} githubUrl={`https://github.com/${REPO}/blob/main/docs/CLOUD-SETUP.md`} />

        <div className="sub-card">
          <Field label={<><KeyRound size={13} /> {t('cloud.passphrase')}</>} hint={cloud.passphrase ? t('cloud.passSet') : t('cloud.passHint')}>
            <div className="input-group">
              <input className="input" type="password" value={pass} placeholder={cloud.passphrase ? '••••••••' : t('cloud.passPlaceholder')} onChange={(e) => setPass(e.target.value)} />
              <button className="btn sm" onClick={savePass} disabled={!pass || busy === 'pass'}>
                {busy === 'pass' ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {t('common.save')}
              </button>
            </div>
          </Field>
        </div>

        <div className="sub-card">
          <Toggle checked={cloud.autoSync} onChange={(autoSync) => setSettings((s) => ({ cloud: { ...s.cloud, autoSync } }))} label={t('cloud.autoSync')} hint={t('cloud.autoSyncHint')} />
          <Field label={t('cloud.sendChanges')} hint={t('cloud.sendChangesHint')}>
            <Select
              value={cloud.syncDelay}
              onChange={(syncDelay) => setSettings((s) => ({ cloud: { ...s.cloud, syncDelay } }))}
              options={SYNC_DELAYS.map((d) => ({ value: d, label: t(`cloud.delay.${d}` as 'cloud.delay.30') }))}
            />
          </Field>
          {cloud.lastSync && <small className="muted">{t('cloud.lastSync', { when: new Date(cloud.lastSync).toLocaleString(LOCALES[lang]) })}</small>}
        </div>

        <div className="grid2">
          <Field label={t('cloud.autoBackup')}>
            <Select
              value={cloud.autoBackup}
              onChange={(autoBackup) => setSettings((s) => ({ cloud: { ...s.cloud, autoBackup } }))}
              options={[
                { value: 'off', label: t('common.off') },
                { value: 'daily', label: t('cloud.daily') },
                { value: 'weekly', label: t('cloud.weekly') },
              ]}
            />
          </Field>
          <Field label={t('cloud.keep')}>
            <Select value={cloud.keep} onChange={(keep) => setSettings((s) => ({ cloud: { ...s.cloud, keep } }))} options={[3, 5, 10, 20, 50].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
        </div>

        {acc && (
          <div className="sub-card">
            <div className="row-between">
              <b>{t('cloud.restore')}</b>
              <button className="btn sm" onClick={() => run('list', async () => setFiles(await listBackups()))}>
                <RefreshCw size={14} className={busy === 'list' ? 'spin' : ''} /> {t('cloud.listBackups')}
              </button>
            </div>
            {files && !files.length && <p className="muted">{t('cloud.noBackups')}</p>}
            {files?.map((f) => (
              <div key={f.id} className="backup-row">
                <span>{f.name}</span>
                <small>{new Date(f.modified).toLocaleString(LOCALES[lang])}</small>
                <button className="btn sm" onClick={() => confirm(t('cloud.restoreConfirm')) && run('restore', () => restoreBackup(f.id), t('cloud.restored'))}>
                  <RotateCcw size={14} /> {t('cloud.restoreBtn')}
                </button>
              </div>
            ))}
          </div>
        )}

      </Card>
    </>
  );
}

// ------------------------------------------------------------ atualizações

function UpdateSettings() {
  const t = useT();
  const lang = useLang();
  const { settings, setSettings } = useData();
  const upd = useUpdateStore();
  const [progress, setProgress] = useState<number | null>(null);
  const install = async () => {
    if (!upd.release) return;
    setProgress(0);
    try {
      await downloadAndInstall(upd.release, (r, total) => setProgress(total ? r / total : 0));
    } catch (e) {
      toast(String((e as Error)?.message || e), 'error');
    } finally {
      setProgress(null);
    }
  };
  const freq: { value: UpdateFrequency; label: string }[] = [
    { value: 'startup', label: t('upd.startup') },
    { value: 'daily', label: t('upd.daily') },
    { value: 'weekly', label: t('upd.weekly') },
    { value: 'biweekly', label: t('upd.biweekly') },
    { value: 'monthly', label: t('upd.monthly') },
    { value: 'never', label: t('upd.never') },
  ];
  return (
    <Card icon={<CloudUpload size={18} />} title={t('settings.updates')} subtitle={t('upd.subtitle')}>
      <div className="sub-card">
        <b>
          {t('upd.installed')}: {APP_VERSION}
        </b>
        <small className="muted">
          {upd.release ? t('upd.newAvailable', { v: upd.release.version }) : upd.last === 'error' ? t('upd.error') : t('upd.latest')}
          {settings.lastUpdateCheck ? ` · ${t('upd.lastCheck')} ${new Date(settings.lastUpdateCheck).toLocaleString(LOCALES[lang])}` : ''}
        </small>
      </div>
      <Field label={t('upd.check')}>
        <Select value={settings.updateFrequency} onChange={(updateFrequency) => setSettings({ updateFrequency })} options={freq} />
      </Field>
      {upd.release && (
        <div className="sub-card update-card">
          <b>
            {upd.release.name} · {upd.release.version}
          </b>
          <pre className="notes">{upd.release.notes.slice(0, 1200)}</pre>
          {progress !== null && (
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <div className="btn-row">
            {upd.release.asset ? (
              <button className="btn primary grad" onClick={install} disabled={progress !== null}>
                <Download size={15} /> {canAutoInstall(upd.release) ? t('upd.install') : t('upd.download')}
              </button>
            ) : (
              <button className="btn primary" onClick={() => openUrl(upd.release!.url)}>
                <ExternalLink size={15} /> {t('upd.openRelease')}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="row-between">
        <button className="btn" onClick={() => runUpdateCheck(true)} disabled={upd.checking}>
          <RefreshCw size={15} className={upd.checking ? 'spin' : ''} /> {t('upd.checkNow')}
        </button>
        <button className="link" onClick={() => openUrl(RELEASES_URL)}>
          <ExternalLink size={13} /> {t('upd.viewReleases')}
        </button>
      </div>
    </Card>
  );
}

// -------------------------------------------------------------------- sobre

function About() {
  const t = useT();
  return (
    <Card icon={<Info size={18} />} title={t('settings.about')}>
      <div className="about">
        <Logo size={84} />
        <div>
          <h2>GCP-Calc</h2>
          <p className="muted">
            {t('app.version')} {APP_VERSION} · GPL-3.0
          </p>
          <p>{t('about.text')}</p>
          <p>
            {t('app.developedBy')} <b>Bruno Albertini</b> |{' '}
            <button className="link" onClick={() => openUrl(DEV_URL)}>
              Gestão Cultural Pro <ExternalLink size={11} />
            </button>
          </p>
          <div className="btn-row">
            <button className="btn" onClick={() => openUrl(`https://github.com/${REPO}`)}>
              <GitBranch size={15} /> GitHub
            </button>
            <button className="btn heart" onClick={() => useUi.getState().set({ support: true })}>
              <Heart size={15} /> {t('sidebar.support')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
