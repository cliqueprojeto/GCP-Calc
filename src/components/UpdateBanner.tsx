import { create } from 'zustand';
import { checkForUpdate, isCheckDue, type ReleaseInfo } from '../lib/updater';

interface UpdState {
  release: ReleaseInfo | null;
  checking: boolean;
  last?: 'latest' | 'error' | 'available';
  error?: string;
}

export const useUpdateStore = create<UpdState>(() => ({ release: null, checking: false }));

export const useUpdate = () => useUpdateStore((s) => s.release);

export async function runUpdateCheck(force = false) {
  if (!force && !isCheckDue()) return;
  useUpdateStore.setState({ checking: true });
  const r = await checkForUpdate();
  useUpdateStore.setState({
    checking: false,
    last: r.status,
    release: r.status === 'available' ? r.release : null,
    error: r.status === 'error' ? r.error : undefined,
  });
}
