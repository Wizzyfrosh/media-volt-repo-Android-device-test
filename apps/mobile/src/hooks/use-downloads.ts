import { useSyncExternalStore } from 'react';
import type { DownloadView } from '@/features/downloads/engine';
import { useServices } from '@/services/ServicesProvider';

/** The live download list. Re-renders when a download changes. */
export function useDownloads(): DownloadView[] {
  const { downloadEngine } = useServices();
  return useSyncExternalStore(downloadEngine.subscribe, downloadEngine.getSnapshot);
}
