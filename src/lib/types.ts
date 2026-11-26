import type { CurrencyTag } from '../engine/value';

export type Lang = 'pt' | 'en' | 'es';

export type ChartKind = 'bar' | 'pie' | 'donut' | 'line' | 'hbar';

export type Block =
  | { id: string; type: 'calc'; text: string }
  | { id: string; type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { id: string; type: 'image'; src: string; caption?: string; width?: number }
  | { id: string; type: 'chart'; kind: ChartKind; source: string; title?: string }
  | { id: string; type: 'divider'; style: 'line' | 'dots' | 'wave' | 'gradient' }
  | { id: string; type: 'callout'; text: string; color: string; icon: string }
  | { id: string; type: 'sticker'; emoji: string; size: number; align: 'left' | 'center' | 'right' }
  | { id: string; type: 'progress'; label: string; value: string; goal: string; color: string }
  | { id: string; type: 'ticker'; codes: string[] }
  /** relatório comparativo entre notas (ex.: orçamento do mês passado × este mês); "self" = a própria nota */
  | { id: string; type: 'compare'; sources: string[]; title?: string; only?: 'all' | 'sections' }
  /** anotação de voz gravada na nota (áudio compactado) com a transcrição */
  | { id: string; type: 'audio'; src: string; mime: string; ms: number; transcript?: string; created: number };

export type BlockType = Block['type'];

export interface Note {
  id: string;
  title: string;
  icon: string;
  color: string;
  folderId?: string;
  pinned?: boolean;
  created: number;
  updated: number;
  /** marca de exclusão (lixeira); some de vez depois de 30 dias */
  deleted?: number;
  /** esvaziada de vez (só a marca de exclusão permanece) */
  purged?: boolean;
  blocks: Block[];
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  updated: number;
  deleted?: number;
  collapsed?: boolean;
}

export interface Tag extends CurrencyTag {
  updated: number;
  deleted?: number;
}

export type AiProviderId = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'groq' | 'deepseek' | 'xai' | 'openrouter' | 'ollama' | 'custom';

export interface AiProvider {
  id: string;
  kind: AiProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
  checkedAt?: number;
}

export interface CloudAccount {
  provider: 'gdrive';
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  connectedAt: number;
}

export type UpdateFrequency = 'startup' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'never';

export interface CustomTheme {
  dark: boolean;
  bg: string;
  panel: string;
  text: string;
  accent: string;
  accent2: string;
}

export interface Settings {
  lang: 'auto' | Lang;
  theme: string;
  customTheme: CustomTheme;
  /** cores da sintaxe personalizadas, por tema (id do tema → tipo → cor) */
  synColors: Record<string, Record<string, string>>;
  font: string;
  fontSize: number;
  decimal: 'auto' | 'comma' | 'dot';
  grouping: boolean;
  precision: number;
  currencyPosition: 'auto' | 'before' | 'after';
  dollar: string;
  baseCurrency: string;
  favoriteCurrencies: string[];
  angle: 'deg' | 'rad';
  dateOrder: 'auto' | 'dmy' | 'mdy';
  ratesOnOpen: boolean;
  ratesMaxAge: number;
  lineNumbers: boolean;
  /** permissões pedidas no primeiro uso (microfone e notificações) e o que o usuário escolheu */
  permissions?: { asked: boolean; mic?: 'granted' | 'denied' | 'prompt' | 'unsupported'; notify?: 'granted' | 'denied' | 'prompt' | 'unsupported'; at?: number };
  /** manter o áudio na nota ao transcrever */
  keepAudio?: boolean;
  /** separadores e moeda automáticos ao digitar / dar Enter */
  autoFormat?: boolean;
  /** sugestões de variáveis, seções e funções enquanto digita */
  autocomplete?: boolean;
  keypad: 'auto' | 'on' | 'off';
  resultColors: boolean;
  ai: { providers: AiProvider[]; active?: string; inline: boolean };
  cloud: {
    accounts: CloudAccount[];
    googleClientId?: string;
    googleClientSecret?: string;
    /** frase-senha da criptografia (fica só neste aparelho) */
    passphrase?: string;
    autoSync: boolean;
    syncDelay: number;
    autoBackup: 'off' | 'daily' | 'weekly';
    keep: number;
    lastBackup?: number;
    lastSync?: number;
  };
  updateFrequency: UpdateFrequency;
  lastUpdateCheck: number;
  onboarded?: boolean;
}

export interface DataDoc {
  version: 1;
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  /** modelos criados pelo usuário (ou importados de outros usuários) */
  templates?: UserTemplate[];
  /** lembretes (contas a vencer, compromissos) */
  reminders?: Reminder[];
  /** central de notificações */
  inbox?: InboxItem[];
}

export type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly';

/** Lembrete: conta a vencer ou compromisso financeiro. */
export interface Reminder {
  id: string;
  title: string;
  /** valor como expressão ("R$ 150", "Aluguel * 1,1") */
  amount?: string;
  /** próximo vencimento (data e hora) */
  due: number;
  repeat: Repeat;
  /** avisar N dias antes (além do dia) */
  alertDays: number;
  noteId?: string;
  /** vencimentos já pagos/concluídos */
  paid?: number[];
  archived?: boolean;
  updated: number;
  deleted?: number;
}

/** Item da central de notificações. */
export interface InboxItem {
  id: string;
  reminderId?: string;
  noteId?: string;
  kind: 'before' | 'due' | 'overdue' | 'info';
  title: string;
  body: string;
  at: number;
  read?: boolean;
  archived?: boolean;
  updated: number;
  deleted?: number;
}

/** Modelo do usuário: a nota completa (blocos, gráficos, ícone e cores). */
export interface UserTemplate {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  blocks: Block[];
  author?: string;
  updated: number;
  deleted?: number;
}

export interface RatesDoc {
  /** unidades da moeda por 1 USD */
  rates: Record<string, number>;
  fetched: number;
  source: string;
  cryptoFetched?: number;
}
