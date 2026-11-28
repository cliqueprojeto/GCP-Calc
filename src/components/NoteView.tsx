import { Fragment, useMemo, useRef, useState, useEffect } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChartPie,
  Copy,
  CopyPlus,
  Download,
  FolderInput,
  Heading,
  Image,
  LayoutList,
  Minus,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Smile,
  Target,
  Trash2,
  TrendingUp,
  MessageSquareQuote,
  ListOrdered,
  FileText,
  FileImage,
  FileType,
  Presentation,
  Sheet,
  Sigma,
  LayoutTemplate,
  ListTree,
  ChartColumnBig,
  Mic,
  CodeXml,
  FileSpreadsheet,
  Radio,
  LogIn,
} from 'lucide-react';
import { SaveTemplateModal } from './TemplateDialogs';
import { OrganizeModal } from './OrganizeModal';
import { ImportModal } from './ImportModal';
import { VoiceFab } from './VoiceFab';
import { LiveBadge, ShareDialog } from './Collab';
import { CompareBlock } from './CompareBlock';
import { CodeBlock } from './CodeBlock';
import { AttachChooser, ReceiptViewer, ReceiptsStrip, attachFlow } from './Receipts';
import { AudioBlock } from './AudioBlock';
import { VoiceCapture, type VoiceResult } from './VoiceCapture';
import { dataUrlToBlob } from '../lib/voice';
import { insertIntoSections } from '../lib/smartInsert';
import { buildFormula } from '../lib/voiceFormulas';
import { fold } from '../engine/units';
import type { Suggestion } from './CalcEditor';
import { aggregateValues, commonValues, evaluateLine, newDocState, type DocState, type LineResult } from '../engine/evaluate';
import { formatValue, plainNumber } from '../engine/value';
import { formatOptions, useEvalContext } from '../lib/calcContext';
import { NoteIcon } from '../lib/icons';
import { copyText, isMobile, saveBinaryFile, saveTextFile, uid } from '../lib/platform';
import type { Attachment, Block, BlockType, Note } from '../lib/types';
import { useData } from '../store/data';
import { toast, useUi } from '../store/ui';
import { useT } from '../i18n';
import { CalcEditor } from './CalcEditor';
import { isTransient, nextStep, orderedProviders } from '../ai/assist';
import type { ExportFormat } from '../export';
import { evaluateNote, chartDataFor, type Evaluated } from '../lib/noteEval';
import { CalloutBlock, ChartBlock, DividerBlock, HeadingBlock, ImageBlock, ProgressBlock, StickerBlock, TickerBlock } from './Blocks';
import { IconPicker } from './IconPicker';
import { Assistant } from './Assistant';
import { Menu, MenuItem } from './ui';

/** chave estável de uma linha (para ligar comprovantes): o nome do lançamento ou o texto */
export function lineKey(text: string, results: { label?: string }[], i: number): string | undefined {
  const r = results[i];
  const raw = r?.label ?? text.split('\n')[i]?.trim();
  return raw ? fold(raw) : undefined;
}

export function newBlock(type: BlockType, settingsBase = 'BRL', favs: string[] = []): Block {
  const id = uid();
  switch (type) {
    case 'calc':
      return { id, type, text: '' };
    case 'heading':
      return { id, type, text: '', level: 2 };
    case 'image':
      return { id, type, src: '' };
    case 'chart':
      return { id, type, kind: 'bar', source: '' };
    case 'divider':
      return { id, type, style: 'line' };
    case 'callout':
      return { id, type, text: '', color: '#8b5cf6', icon: 'Lightbulb' };
    case 'sticker':
      return { id, type, emoji: 'Star', size: 56, align: 'center' };
    case 'progress':
      return { id, type, label: '', value: '', goal: '', color: '#10b981' };
    case 'ticker':
      return { id, type, codes: favs.filter((c) => c !== settingsBase).slice(0, 4) };
    case 'compare':
      return { id, type, sources: ['self'], only: 'all' };
    case 'audio':
      return { id, type, src: '', mime: 'audio/webm', ms: 0, created: Date.now() };
    case 'code':
      return { id, type, lang: 'python', code: '' };
  }
}

export function noteToText(note: Note, ev: Evaluated, fmt: ReturnType<typeof formatOptions>, md = false): string {
  const out: string[] = [md ? `# ${note.title}` : note.title, ''];
  for (const b of note.blocks) {
    if (b.type === 'calc') {
      const r = ev.perBlock.get(b.id)?.results ?? [];
      const lines = b.text.split('\n');
      const width = Math.min(48, Math.max(...lines.map((l) => l.length)) + 2);
      if (md) out.push('```');
      lines.forEach((l, i) => {
        const v = r[i]?.value;
        out.push(v && r[i].kind === 'value' ? `${l.padEnd(width)}= ${formatValue(v, fmt)}` : l);
      });
      if (md) out.push('```');
    } else if (b.type === 'heading') out.push((md ? '#'.repeat(b.level + 1) + ' ' : '') + b.text);
    else if (b.type === 'callout') out.push((md ? '> ' : '» ') + b.text);
    else if (b.type === 'divider') out.push(md ? '---' : '────────');
    out.push('');
  }
  return out.join('\n');
}

export function NoteView({ note }: { note: Note }) {
  const t = useT();
  const ctx = useEvalContext();
  const fmt = useMemo(() => formatOptions(ctx), [ctx]);
  const { updateNote, updateBlock, trashNote, duplicateNote, folders, settings } = useData();
  const ui = useUi();
  const [iconFor, setIconFor] = useState<null | 'note' | string>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const reminders = useData((s) => s.reminders);
  // comprovantes
  const [viewer, setViewer] = useState<{ blockId: string; index: number } | null>(null);
  const [chooser, setChooser] = useState<{ blockId: string; line?: string } | null>(null);
  const addAttachments = (blockId: string, list: Attachment[]) =>
    updateNote(note.id, (n) => {
      const blk = n.blocks.find((x) => x.id === blockId);
      if (blk?.type === 'calc') blk.attachments = [...(blk.attachments ?? []), ...list];
    });
  const startAttach = (blockId: string, line?: string) => {
    // no celular: câmera ou arquivo; no computador: direto para os arquivos
    if (isMobile) setChooser({ blockId, line });
    else void attachFlow(false, line, (l) => addAttachments(blockId, l), t);
  };
  const labelOfAttachment = (blockId: string) => (a: Attachment) => {
    if (!a.line) return undefined;
    const blk = note.blocks.find((x) => x.id === blockId);
    const res = ev.perBlock.get(blockId)?.results ?? [];
    if (blk?.type !== 'calc') return undefined;
    const lines = blk.text.split('\n');
    const i = lines.findIndex((_, k) => lineKey(blk.text, res, k) === a.line);
    return i >= 0 ? res[i]?.label ?? lines[i].trim().slice(0, 30) : undefined;
  };
  useEffect(() => {
    if (!ui.attachRequest || Date.now() - ui.attachRequest > 1500) return;
    const blockId = ui.focusBlock && note.blocks.some((x) => x.id === ui.focusBlock && x.type === 'calc') ? ui.focusBlock : nearestCalc();
    if (!blockId) return;
    const blk = note.blocks.find((x) => x.id === blockId) as Extract<Block, { type: 'calc' }>;
    const ta = document.querySelector<HTMLTextAreaElement>(`.calc[data-block="${blockId}"] .calc-input`);
    const idx = ta ? ta.value.slice(0, ta.selectionStart).split('\n').length - 1 : 0;
    startAttach(blockId, lineKey(blk.text, ev.perBlock.get(blockId)?.results ?? [], idx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.attachRequest]);
  // teclado de operadores: 🎤 grava, 📷 anexa comprovante
  useEffect(() => {
    if (ui.voiceRequest && Date.now() - ui.voiceRequest < 1500) void openVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.voiceRequest]);
  const [organizing, setOrganizing] = useState<string | null>(null);
  const [importing, setImporting] = useState<{ after?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [voice, setVoice] = useState<{ target?: string; audio?: Extract<Block, { type: 'audio' }>; blob?: Blob } | null>(null);
  /** bloco de cálculo mais próximo (o anterior; se não houver, o primeiro) */
  const nearestCalc = (id?: string) => {
    const idx = id ? note.blocks.findIndex((x) => x.id === id) : note.blocks.length - 1;
    const before = [...note.blocks.slice(0, idx + 1)].reverse().find((x) => x.type === 'calc');
    return (before ?? note.blocks.find((x) => x.type === 'calc'))?.id;
  };
  const openVoice = async (target?: string, audio?: Extract<Block, { type: 'audio' }>) => {
    if (audio?.src) setVoice({ target, audio, blob: await dataUrlToBlob(audio.src) });
    else setVoice({ target: target ?? (ui.focusBlock && note.blocks.some((x) => x.id === ui.focusBlock && x.type === 'calc') ? ui.focusBlock : nearestCalc()) });
  };
  const onVoiceDone = (r: VoiceResult) => {
    const n = useData.getState().notes.find((x) => x.id === note.id);
    if (!n) return;
    let target = n.blocks.find((x) => x.id === voice?.target && x.type === 'calc');
    if (!target && r.lines.length) {
      const nb = newBlock('calc');
      insertAfter(voice?.audio?.id, nb);
      target = nb;
    }
    let placedMsg = '';
    if (target && target.type === 'calc' && r.lines.length) {
      const cur = (useData.getState().notes.find((x) => x.id === note.id)?.blocks.find((x) => x.id === target!.id) as { text: string } | undefined)?.text ?? '';
      // cada item vai para a seção que já existe (#Despesas, #Receitas…), na última linha antes do total
      const secNames = {
        income: knownNames.sections.find((x) => x.tone === 'income')?.name ?? t('rem.secIncome'),
        expense: knownNames.sections.find((x) => x.tone === 'expense')?.name ?? t('rem.secExpense'),
      };
      const res = insertIntoSections(cur, ev.perBlock.get(target.id)?.results ?? [], r.items.length ? r.items : r.lines.map((line) => ({ line })), secNames);
      updateBlock(note.id, target.id, { text: res.text });
      placedMsg = res.placed.map((p) => `#${p.name} +${p.n}`).join(' · ');
      if (res.skipped) placedMsg = (placedMsg ? placedMsg + ' · ' : '') + t('voice.skipped', { n: res.skipped });
    }
    if (voice?.audio && r.transcript) updateBlock(note.id, voice.audio.id, { transcript: r.transcript });
    if (r.audio) {
      const ab: Block = { id: uid(), type: 'audio', ...r.audio, created: Date.now() };
      updateNote(note.id, (nn) => {
        const i = target ? nn.blocks.findIndex((x) => x.id === target!.id) : nn.blocks.length - 1;
        nn.blocks.splice(i + 1, 0, ab);
      });
    }
    toast(placedMsg ? `${t('voice.done')}: ${placedMsg}` : t('voice.done'), 'ok');
    if (r.organize && target) setTimeout(() => setOrganizing(target!.id), 50);
  };
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  // avaliação de todos os blocos de cálculo da nota, em ordem, com variáveis compartilhadas
  const ev: Evaluated = useMemo(() => evaluateNote(note, ctx, fmt), [note, ctx, fmt]);
  // nomes da nota para o autocompletar: variáveis/rótulos (com valor) e seções #
  const known: Suggestion[] = useMemo(() => {
    const out: Suggestion[] = [];
    for (const [, { results }] of ev.perBlock)
      for (const r of results) {
        if (r.kind === 'header' && r.section && !/\s/.test(r.section)) out.push({ kind: 'section', insert: '#' + r.section.replace(/\s+/g, ''), tone: r.tone });
        else if (r.kind === 'value' && r.label && !r.label.includes('#') && /^[\p{L}_][\p{L}\p{N}_ ]*$/u.test(r.label)) out.push({ kind: 'var', insert: r.label, value: r.value, tone: r.tone });
      }
    return out.reverse();
  }, [ev]);
  const knownNames = useMemo(
    () => ({ sections: known.filter((k) => k.kind === 'section').map((k) => ({ name: k.insert.slice(1), tone: k.tone })), vars: known.filter((k) => k.kind === 'var').map((k) => k.insert) }),
    [known],
  );
  const chartData = (b: Extract<Block, { type: 'chart' }>) => chartDataFor(note, b, ev, ctx);

  const insertAfter = (afterId: string | undefined, b: Block) => {
    updateNote(note.id, (n) => {
      const idx = afterId ? n.blocks.findIndex((x) => x.id === afterId) : n.blocks.length - 1;
      n.blocks.splice(idx + 1, 0, b);
    });
    setLastAdded(b.id);
  };

  const addBlock = (type: BlockType, afterId?: string) => {
    const b = newBlock(type, settings.baseCurrency, settings.favoriteCurrencies);
    if (b.type === 'chart') {
      const idx = afterId ? note.blocks.findIndex((x) => x.id === afterId) : note.blocks.length - 1;
      const prevCalc = [...note.blocks.slice(0, idx + 1)].reverse().find((x) => x.type === 'calc');
      b.source = prevCalc?.id ?? '';
    }
    insertAfter(afterId, b);
    if (type === 'sticker') setIconFor(b.id);
    if (b.type === 'compare') {
      // começa comparando com a nota parecida mais recente (ex.: o orçamento do mês passado)
      const others = useData.getState().notes.filter((n) => !n.deleted && n.id !== note.id).sort((a, c) => c.updated - a.updated);
      const word = fold(note.title.split(/\s+/)[0] ?? '');
      const similar = others.find((n) => word && fold(n.title).startsWith(word)) ?? others.find((n) => n.icon === note.icon) ?? others[0];
      if (similar) b.sources = [similar.id, 'self'];
    }
  };

  const moveBlock = (id: string, dir: -1 | 1) =>
    updateNote(note.id, (n) => {
      const i = n.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (j < 0 || j >= n.blocks.length) return;
      [n.blocks[i], n.blocks[j]] = [n.blocks[j], n.blocks[i]];
    });

  const removeBlock = (id: string) =>
    updateNote(note.id, (n) => {
      n.blocks = n.blocks.filter((b) => b.id !== id);
      if (!n.blocks.some((b) => b.type === 'calc')) n.blocks.push(newBlock('calc'));
    });

  const insertLines = (lines: string[]) => {
    const target = note.blocks.find((b) => b.id === (ui.assistant?.afterBlock ?? ui.focusBlock) && b.type === 'calc') ?? [...note.blocks].reverse().find((b) => b.type === 'calc');
    if (!target || target.type !== 'calc') return;
    const text = target.text.replace(/\s+$/, '');
    updateBlock(note.id, target.id, { text: (text ? text + '\n\n' : '') + lines.join('\n') });
    toast(t('assist.inserted'), 'ok');
  };

  const blockSum = (id: string) => {
    const r = ev.perBlock.get(id)?.results ?? [];
    // só para blocos de um grupo (sem títulos/linhas em branco entre valores) e sem totais próprios
    const first = r.findIndex((x) => x.kind === 'value');
    let last = -1;
    r.forEach((x, i) => x.kind === 'value' && (last = i));
    if (first < 0 || r.slice(first, last + 1).some((x) => x.kind === 'empty' || x.kind === 'header' || x.aggregate)) return null;
    const vals = r.filter((x) => x.kind === 'value' && x.value && !x.aggregate && !x.value.date && !x.value.pct).map((x) => x.value!);
    if (vals.length < 2) return null;
    try {
      return { sum: aggregateValues(vals, 'sum', ctx), avg: aggregateValues(vals, 'avg', ctx), count: vals.length };
    } catch {
      return null;
    }
  };

  const INSERTS: { type: BlockType; icon: JSX.Element; label: string }[] = [
    { type: 'calc', icon: <Calculator size={15} />, label: t('block.calc') },
    { type: 'heading', icon: <Heading size={15} />, label: t('block.heading') },
    { type: 'chart', icon: <ChartPie size={15} />, label: t('block.chart') },
    { type: 'progress', icon: <Target size={15} />, label: t('block.progress') },
    { type: 'ticker', icon: <TrendingUp size={15} />, label: t('block.ticker') },
    { type: 'compare', icon: <ChartColumnBig size={15} />, label: t('block.compare') },
    { type: 'code', icon: <CodeXml size={15} />, label: t('block.code') },
    { type: 'callout', icon: <MessageSquareQuote size={15} />, label: t('block.callout') },
    { type: 'image', icon: <Image size={15} />, label: t('block.image') },
    { type: 'sticker', icon: <Smile size={15} />, label: t('block.sticker') },
    { type: 'divider', icon: <Minus size={15} />, label: t('block.divider') },
  ];

  const InsertMenu = ({ after, big }: { after?: string; big?: boolean }) => (
    <Menu
      align="left"
      button={(toggle) =>
        big ? (
          <button className="add-block" onClick={toggle}>
            <Plus size={16} /> {t('block.add')}
          </button>
        ) : (
          <button className="ins-btn" onClick={toggle} title={t('block.add')}>
            <Plus size={14} />
          </button>
        )
      }
    >
      {(close) => (
        <>
          {INSERTS.map((it) => (
            <MenuItem
              key={it.type}
              icon={it.icon}
              onClick={() => {
                addBlock(it.type, after);
                close();
              }}
            >
              {it.label}
            </MenuItem>
          ))}
          <MenuItem
            icon={<FileSpreadsheet size={15} />}
            onClick={() => {
              setImporting({ after });
              close();
            }}
          >
            {t('imp.menu')}
          </MenuItem>
          <MenuItem
            icon={<ListOrdered size={15} />}
            onClick={() => {
              ui.set({ assistant: { noteId: note.id, afterBlock: after } });
              close();
            }}
          >
            {t('assist.title')}
          </MenuItem>
        </>
      )}
    </Menu>
  );

  const exportNote = async (md: boolean) => {
    const text = noteToText(note, ev, fmt, md);
    const name = (note.title || 'GCP-Calc').replace(/[\\/:*?"<>|]+/g, '-');
    await saveTextFile(`${name}.${md ? 'md' : 'txt'}`, text, [{ name: md ? 'Markdown' : 'Text', extensions: [md ? 'md' : 'txt'] }]);
  };

  const runExport = async (format: ExportFormat | 'xlsx-all' | 'png' | 'pdf-screen') => {
    toast(t('note.exporting'));
    try {
      if (format === 'png' || format === 'pdf-screen') {
        if (!noteRef.current) return;
        const { snapshotPng, snapshotPdf } = await import('../export/snapshot');
        const { fileBase } = await import('../export/model');
        const png = format === 'png';
        const bytes = png ? await snapshotPng(noteRef.current) : await snapshotPdf(noteRef.current, note.title);
        const ext = png ? 'png' : 'pdf';
        const path = await saveBinaryFile(`${fileBase(note.title)}.${ext}`, bytes, [{ name: png ? 'PNG' : 'PDF', extensions: [ext] }], png ? 'image/png' : 'application/pdf');
        if (path) toast(t('note.exported'), 'ok');
        return;
      }
      const { exportNote: doExport, exportAllXlsx } = await import('../export');
      const path =
        format === 'xlsx-all'
          ? await exportAllXlsx(useData.getState().notes.filter((n) => !n.deleted))
          : await doExport(note, format as ExportFormat);
      if (path) toast(t('note.exported'), 'ok');
    } catch (e) {
      console.error(e);
      toast(t('note.exportFail', { error: String((e as Error)?.message || e).slice(0, 120) }), 'error');
    }
  };

  /** "/ia pergunta" + Enter: a IA responde direto na nota, substituindo a linha do comando. */
  const runInlineAi = async (blockId: string, lineIndex: number, question: string) => {
    const st = useData.getState();
    const providers = orderedProviders(st.settings.ai.providers, st.settings.ai.active);
    if (!providers.length) {
      toast(t('inline.noAi'), 'error');
      return;
    }
    const placeholder = `// ${t('inline.thinking')}… ${question}`;
    const original = `/ia ${question}`;
    const replaceLine = (find: string, lines: string[]) => {
      const n = useData.getState().notes.find((x) => x.id === note.id);
      const b = n?.blocks.find((x) => x.id === blockId);
      if (!b || b.type !== 'calc') return;
      const arr = b.text.split('\n');
      let i = arr.findIndex((l) => l.trim() === find);
      if (i < 0) i = Math.min(lineIndex, arr.length - 1);
      arr.splice(i, 1, ...lines);
      updateBlock(note.id, blockId, { text: arr.join('\n') });
    };
    // marca a linha como "calculando" enquanto a IA responde
    {
      const arr = (note.blocks.find((x) => x.id === blockId) as { text: string }).text.split('\n');
      arr[lineIndex] = placeholder;
      updateBlock(note.id, blockId, { text: arr.join('\n') });
    }
    try {
      const step = await nextStep(providers, { lang: ctx.lang, decimal: ctx.decimal, baseCurrency: st.settings.baseCurrency, goal: question, noteContext: ev.context, turns: [], inline: true }, undefined, (m) =>
        toast(t('assist.fallback', { model: m })),
      );
      if (step.type === 'result') {
        replaceLine(placeholder, [`// IA: ${question}`, ...step.lines.filter((l) => l.trim() !== '')]);
        toast(t('inline.done'), 'ok');
      } else {
        // a IA precisa de um dado essencial: continua no assistente, já com a pergunta dela
        replaceLine(placeholder, [`// IA: ${question}`]);
        ui.set({ assistant: { noteId: note.id, afterBlock: blockId, goal: question, turns: [{ step }] } });
        toast(t('inline.asked'));
      }
    } catch (e) {
      replaceLine(placeholder, [original]);
      toast(isTransient(e) ? t('assist.busy') : `${t('assist.error')}: ${String((e as Error)?.message || e).slice(0, 160)}`, 'error');
    }
  };

  const assistantHere = ui.assistant?.noteId === note.id;
  const assistantAfter = assistantHere ? (ui.assistant?.afterBlock ?? note.blocks[note.blocks.length - 1]?.id) : undefined;

  const iconTargetBlock = iconFor && iconFor !== 'note' ? note.blocks.find((b) => b.id === iconFor) : undefined;

  return (
    <div className="note" ref={noteRef} style={{ '--note-color': note.color } as React.CSSProperties}>
      <header className="note-head">
        <button className="note-icon" onClick={() => setIconFor('note')} title={t('note.changeIcon')} style={{ color: note.color }}>
          <NoteIcon name={note.icon} size={30} />
        </button>
        <input className="note-title" value={note.title} placeholder={t('note.untitled')} onChange={(e) => updateNote(note.id, (n) => void (n.title = e.target.value))} />
        <div className="note-actions">
          <LiveBadge note={note} onOpen={() => setSharing(true)} />
          <button className="icon-btn" title={note.pinned ? t('note.unpin') : t('note.pin')} onClick={() => updateNote(note.id, (n) => void (n.pinned = !n.pinned))}>
            {note.pinned ? <PinOff size={17} /> : <Pin size={17} />}
          </button>
          <button className="icon-btn accent" title={t('assist.title')} onClick={() => ui.set({ assistant: assistantHere ? undefined : { noteId: note.id } })}>
            <ListOrdered size={17} />
          </button>
          <Menu
            button={(toggle) => (
              <button className="icon-btn" onClick={toggle} title={t('common.more')}>
                <MoreHorizontal size={18} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<Radio size={15} />} onClick={() => (setSharing(true), close())}>
                  {t('collab.menu')}
                </MenuItem>
                <MenuItem icon={<LogIn size={15} />} onClick={() => (ui.set({ joinRequest: { at: Date.now() } }), close())}>
                  {t('collab.joinTitle')}
                </MenuItem>
                <div className="menu-sep" />
                <MenuItem
                  icon={<Copy size={15} />}
                  onClick={() => {
                    copyText(noteToText(note, ev, fmt));
                    toast(t('note.copiedAll'), 'ok');
                    close();
                  }}
                >
                  {t('note.copyAll')}
                </MenuItem>
                <div className="menu-sep" />
                <div className="menu-label">
                  <Download size={13} /> {t('note.export')}
                </div>
                <MenuItem icon={<FileImage size={15} />} onClick={() => (runExport('png'), close())}>
                  {t('note.exportPng')}
                </MenuItem>
                <MenuItem icon={<FileText size={15} />} onClick={() => (runExport('pdf-screen'), close())}>
                  {t('note.exportPdfScreen')}
                </MenuItem>
                <MenuItem icon={<FileText size={15} />} onClick={() => (runExport('pdf'), close())}>
                  {t('note.exportPdf')}
                </MenuItem>
                <MenuItem icon={<FileType size={15} />} onClick={() => (runExport('docx'), close())}>
                  {t('note.exportDocx')}
                </MenuItem>
                <MenuItem icon={<Presentation size={15} />} onClick={() => (runExport('pptx'), close())}>
                  {t('note.exportPptx')}
                </MenuItem>
                <MenuItem icon={<Sheet size={15} />} onClick={() => (runExport('xlsx'), close())}>
                  {t('note.exportXlsx')}
                </MenuItem>
                <MenuItem icon={<Sheet size={15} />} onClick={() => (runExport('xlsx-all'), close())}>
                  {t('note.exportXlsxAll')}
                </MenuItem>
                <MenuItem icon={<Download size={15} />} onClick={() => (exportNote(false), close())}>
                  {t('note.exportTxt')}
                </MenuItem>
                <MenuItem icon={<Download size={15} />} onClick={() => (exportNote(true), close())}>
                  {t('note.exportMd')}
                </MenuItem>
                <MenuItem icon={<LayoutTemplate size={15} />} onClick={() => (setSavingTpl(true), close())}>
                  {t('tpl.saveAs')}
                </MenuItem>
                <MenuItem
                  icon={<CopyPlus size={15} />}
                  onClick={() => {
                    const id = duplicateNote(note.id);
                    if (id) ui.go({ kind: 'note', id });
                    close();
                  }}
                >
                  {t('note.duplicate')}
                </MenuItem>
                <div className="menu-sep" />
                <div className="menu-label">
                  <FolderInput size={13} /> {t('note.moveTo')}
                </div>
                <MenuItem icon={<LayoutList size={15} />} onClick={() => (updateNote(note.id, (n) => void delete n.folderId), close())}>
                  {t('sidebar.noFolder')}
                </MenuItem>
                {folders
                  .filter((f) => !f.deleted)
                  .map((f) => (
                    <MenuItem key={f.id} icon={<NoteIcon name={f.icon} size={15} color={f.color} />} onClick={() => (updateNote(note.id, (n) => void (n.folderId = f.id)), close())}>
                      {f.name}
                    </MenuItem>
                  ))}
                <div className="menu-sep" />
                <MenuItem
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() => {
                    trashNote(note.id);
                    ui.go({ kind: 'home' });
                    toast(t('note.trashed'));
                    close();
                  }}
                >
                  {t('note.trash')}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      <div className="blocks">
        {note.blocks.map((b, idx) => {
          const set = (p: Partial<Block>) => updateBlock(note.id, b.id, p);
          let body: JSX.Element;
          switch (b.type) {
            case 'calc': {
              const e = ev.perBlock.get(b.id);
              body = (
                <CalcEditor
                  blockId={b.id}
                  text={b.text}
                  results={e?.results ?? []}
                  firstLine={e?.firstLine ?? 1}
                  fmt={fmt}
                  onChange={(text) => set({ text })}
                  autoFocus={lastAdded === b.id}
                  onAiCommand={(line, q) => runInlineAi(b.id, line, q)}
                  known={known}
                  formulaFor={(i) => {
                    const r = e?.results[i];
                    const line = b.text.split('\n')[i] ?? '';
                    if (!r || !line.trim() || ['header', 'comment', 'empty', 'command'].includes(r.kind)) return null;
                    // só frases (pedidos), não contas já escritas
                    if (r.kind === 'value' && !/^\s*(faça|faca|faz|calcule|calcula|quanto|quanta|qual|mostre|mostra|quero|coloque|crie|gere|me d[êe]|calculate|show|what|how|make|calcula|cu[aá]nto|muestra)\b/i.test(line)) return null;
                    if (/[=:#]/.test(line)) return null;
                    const f = buildFormula(line, knownNames, ctx.lang);
                    return f && f !== line.trim() ? f : null;
                  }}
                  attachCount={(i) => {
                    const key = lineKey(b.text, e?.results ?? [], i);
                    return (b.attachments ?? []).filter((a) => a.line === key).length;
                  }}
                  onAttach={(i) => startAttach(b.id, lineKey(b.text, e?.results ?? [], i))}
                  onShowAttach={(i) => {
                    const key = lineKey(b.text, e?.results ?? [], i);
                    const list = b.attachments ?? [];
                    setViewer({ blockId: b.id, index: Math.max(0, list.findIndex((a) => a.line === key)) });
                  }}
                  hasReminder={(i) => {
                    const r = e?.results[i];
                    return !!r?.label && reminders.some((x) => !x.deleted && x.noteId === note.id && fold(x.title) === fold(r.label!));
                  }}
                  onReminder={(i) => {
                    const r = e?.results[i];
                    if (!r?.due || !r.label) return;
                    const ex = reminders.find((x) => !x.deleted && x.noteId === note.id && fold(x.title) === fold(r.label!));
                    if (ex) return ui.go({ kind: 'reminders' });
                    useData.getState().saveReminder({ id: uid(), title: r.label, amount: r.value ? formatValue(r.value, fmt) : undefined, due: r.due.at, repeat: r.due.monthly ? 'monthly' : 'none', alertDays: 2, noteId: note.id, blockId: b.id, kind: r.tone === 'income' ? 'income' : 'expense' });
                    toast(t('rem.createdFromLine', { title: r.label }), 'ok');
                  }}
                />
              );
              break;
            }
            case 'chart':
              body = <ChartBlock block={b} data={chartData(b)} fmt={fmt} onChange={set} />;
              break;
            case 'progress': {
              const p = ev.progress.get(b.id);
              body = <ProgressBlock block={b} value={p?.value?.value} goal={p?.goal?.value} fmt={fmt} onChange={set} />;
              break;
            }
            case 'ticker':
              body = <TickerBlock block={b} ctx={ctx} fmt={fmt} base={settings.baseCurrency} onChange={set} />;
              break;
            case 'callout':
              body = <CalloutBlock block={b} onChange={set} onPickIcon={() => setIconFor(b.id)} />;
              break;
            case 'image':
              body = <ImageBlock block={b} onChange={set} />;
              break;
            case 'divider':
              body = <DividerBlock block={b} onChange={set} />;
              break;
            case 'sticker':
              body = <StickerBlock block={b} onChange={set} onPick={() => setIconFor(b.id)} />;
              break;
            case 'heading':
              body = <HeadingBlock block={b} onChange={set} />;
              break;
            case 'compare':
              body = <CompareBlock note={note} block={b} ctx={ctx} fmt={fmt} ev={ev} onChange={set} />;
              break;
            case 'code':
              body = (
                <CodeBlock
                  block={b}
                  onChange={set}
                  onInsertAfter={(blocks) =>
                    updateNote(note.id, (n) => {
                      const i = n.blocks.findIndex((x) => x.id === b.id);
                      n.blocks.splice(i + 1, 0, ...blocks);
                    })
                  }
                />
              );
              break;
            case 'audio':
              body = <AudioBlock block={b} onTranscribe={() => openVoice(nearestCalc(b.id), b)} onChange={set} onRemove={() => removeBlock(b.id)} />;
              break;
          }
          const sum = b.type === 'calc' ? blockSum(b.id) : null;
          return (
            <Fragment key={b.id}>
              <div className={`block-wrap bt-${b.type}`} tabIndex={-1}>
                <div className="block-tools">
                  <InsertMenu after={b.id} />
                  <button className="ins-btn" disabled={idx === 0} onClick={() => moveBlock(b.id, -1)} title={t('block.up')}>
                    <ArrowUp size={13} />
                  </button>
                  <button className="ins-btn" disabled={idx === note.blocks.length - 1} onClick={() => moveBlock(b.id, 1)} title={t('block.down')}>
                    <ArrowDown size={13} />
                  </button>
                  {b.type === 'calc' && (
                    <>
                      <button className="ins-btn" onClick={() => openVoice(b.id)} title={t('voice.title')}>
                        <Mic size={13} />
                      </button>
                      <button className="ins-btn" onClick={() => setOrganizing(b.id)} title={t('org.title')}>
                        <ListTree size={13} />
                      </button>
                    </>
                  )}
                  <button className="ins-btn danger" onClick={() => removeBlock(b.id)} title={t('block.remove')}>
                    <Trash2 size={13} />
                  </button>
                </div>
                {body}
                {b.type === 'calc' && (
                  <ReceiptsStrip items={b.attachments ?? []} labelOf={labelOfAttachment(b.id)} onOpen={(i) => setViewer({ blockId: b.id, index: i })} onAdd={() => startAttach(b.id)} />
                )}
                {sum && (
                  <div className="block-sum">
                    <button
                      onClick={() => {
                        copyText(plainNumber(sum.sum, fmt));
                        toast(t('editor.copied', { value: formatValue(sum.sum, fmt) }), 'ok');
                      }}
                      title={t('editor.clickToCopy')}
                    >
                      <Sigma size={13} /> {formatValue(sum.sum, fmt)}
                    </button>
                    <span>
                      {t('note.avg')} {formatValue(sum.avg, fmt)} · {t('note.lines', { n: sum.count })}
                    </span>
                  </div>
                )}
              </div>
              {assistantAfter === b.id && (
                <Assistant
                  key={`as-${ui.assistant?.goal ?? ''}-${ui.assistant?.turns?.length ?? 0}`}
                  ctx={ctx}
                  noteState={ev.final}
                  noteContext={ev.context}
                  hasValues={ev.hasValues}
                  initialGoal={ui.assistant?.goal}
                  initialTurns={ui.assistant?.turns}
                  onInsert={(lines) => insertLines(lines)}
                  onAddChart={() => addBlock('chart', b.id)}
                  onClose={() => ui.set({ assistant: undefined })}
                />
              )}
            </Fragment>
          );
        })}
        <InsertMenu big />
      </div>

      {sharing && <ShareDialog note={note} onClose={() => setSharing(false)} />}
      {importing && (
        <ImportModal
          ctx={ctx}
          fmt={fmt}
          baseCurrency={settings.baseCurrency}
          onClose={() => setImporting(null)}
          onInsert={(text, title, asNote) => {
            if (asNote) {
              const calc: Block = { id: uid(), type: 'calc', text };
              const nid = useData.getState().createNote({ title, icon: 'FileSpreadsheet', color: '#16a34a', blocks: [calc] });
              ui.go({ kind: 'note', id: nid });
            } else {
              const b = newBlock('calc', settings.baseCurrency, settings.favoriteCurrencies);
              if (b.type === 'calc') b.text = text;
              insertAfter(importing.after, b);
            }
            toast(t('imp.done'), 'ok');
          }}
        />
      )}
      {organizing && (() => {
        const ob = note.blocks.find((x) => x.id === organizing);
        if (!ob || ob.type !== 'calc') return null;
        return (
          <OrganizeModal
            text={ob.text}
            results={ev.perBlock.get(ob.id)?.results ?? []}
            ctx={ctx}
            fmt={fmt}
            noteContext={ev.context}
            onApply={(text) => {
              updateBlock(note.id, ob.id, { text });
              toast(t('org.done'), 'ok');
            }}
            onClose={() => setOrganizing(null)}
          />
        );
      })()}
      {chooser && <AttachChooser open onClose={() => setChooser(null)} onPick={(camera) => void attachFlow(camera, chooser.line, (l) => addAttachments(chooser.blockId, l), t)} />}
      {viewer && (() => {
        const blk = note.blocks.find((x) => x.id === viewer.blockId);
        const items = blk?.type === 'calc' ? blk.attachments ?? [] : [];
        if (!items.length) return null;
        return (
          <ReceiptViewer
            items={items}
            index={Math.min(viewer.index, items.length - 1)}
            labelOf={labelOfAttachment(viewer.blockId)}
            onIndex={(index) => setViewer({ ...viewer, index })}
            onDelete={(a) =>
              updateNote(note.id, (n) => {
                const b2 = n.blocks.find((x) => x.id === viewer.blockId);
                if (b2?.type === 'calc') b2.attachments = (b2.attachments ?? []).filter((x) => x.id !== a.id);
              })
            }
            onClose={() => setViewer(null)}
          />
        );
      })()}
      {voice && (
        <VoiceCapture
          ctx={ctx}
          fmt={fmt}
          noteContext={ev.context}
          known={{
            sections: known.filter((k) => k.kind === 'section').map((k) => ({ name: k.insert.slice(1), tone: k.tone })),
            vars: known.filter((k) => k.kind === 'var').map((k) => k.insert),
          }}
          blockText={(note.blocks.find((x) => x.id === voice.target && x.type === 'calc') as { text?: string } | undefined)?.text ?? ''}
          existing={voice.audio && voice.blob ? { blob: voice.blob, ms: voice.audio.ms, transcript: voice.audio.transcript } : undefined}
          onDone={onVoiceDone}
          onClose={() => setVoice(null)}
        />
      )}
      <VoiceFab onTap={() => void openVoice()} label={t('voice.fabHint')} />
      {savingTpl && <SaveTemplateModal note={note} open onClose={() => setSavingTpl(false)} />}
      <IconPicker
        open={!!iconFor}
        onClose={() => setIconFor(null)}
        color={iconFor === 'note' ? note.color : iconTargetBlock?.type === 'callout' ? iconTargetBlock.color : undefined}
        onColor={
          iconFor === 'note'
            ? (c) => updateNote(note.id, (n) => void (n.color = c))
            : iconTargetBlock?.type === 'callout'
              ? (c) => updateBlock(note.id, iconTargetBlock.id, { color: c })
              : undefined
        }
        onPick={(icon) => {
          if (iconFor === 'note') updateNote(note.id, (n) => void (n.icon = icon));
          else if (iconTargetBlock?.type === 'callout') updateBlock(note.id, iconTargetBlock.id, { icon });
          else if (iconTargetBlock?.type === 'sticker') updateBlock(note.id, iconTargetBlock.id, { emoji: icon });
          setIconFor(null);
        }}
      />
    </div>
  );
}
