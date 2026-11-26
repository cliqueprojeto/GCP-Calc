import { create } from 'zustand';
import type { Turn } from '../ai/assist';

export type View = { kind: 'note'; id: string } | { kind: 'settings'; section?: string } | { kind: 'trash' } | { kind: 'templates' } | { kind: 'home' } | { kind: 'reminders' };

export interface Toast {
  id: number;
  text: string;
  kind?: 'ok' | 'error' | 'info';
}

interface UiState {
  view: View;
  sidebarOpen: boolean;
  support: boolean;
  palette: boolean;
  search: string;
  /** bloco de cálculo focado (para o teclado e o assistente) */
  focusBlock?: string;
  /** assistente aberto na nota (id do bloco depois do qual ele aparece) */
  assistant?: { noteId: string; afterBlock?: string; goal?: string; turns?: Turn[] };
  toasts: Toast[];
  go(v: View): void;
  set(p: Partial<UiState>): void;
  toast(text: string, kind?: Toast['kind']): void;
}

let tid = 0;

export const useUi = create<UiState>((set, get) => ({
  view: { kind: 'home' },
  sidebarOpen: false,
  support: false,
  palette: false,
  search: '',
  toasts: [],
  go(view) {
    set({ view, sidebarOpen: false });
  },
  set(p) {
    set(p);
  },
  toast(text, kind = 'info') {
    const id = ++tid;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 7000 : text.length > 60 ? 4500 : 2600);
  },
}));

export const toast = (text: string, kind?: Toast['kind']) => useUi.getState().toast(text, kind);
