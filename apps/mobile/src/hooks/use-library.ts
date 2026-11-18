import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { loadLibrary, type LibraryData, type LibraryQuery } from '@/features/library/query';
import { useServices } from '@/services/ServicesProvider';

export interface LibraryState {
  status: 'loading' | 'ready' | 'error';
  /** Kept while reloading, so the list does not flash empty after a change. */
  data: LibraryData | null;
  error: string | null;
  reload: () => void;
}

/** Library contents for a query. Reloads by itself whenever a file or folder changes. */
export function useLibrary(query: LibraryQuery): LibraryState {
  const { files, folders, fileService } = useServices();
  const version = useSyncExternalStore(fileService.subscribe, fileService.getVersion);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<LibraryState, 'reload'>>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadLibrary({ files, folders }, query)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState((s) => ({
            status: 'error',
            data: s.data,
            error: e instanceof Error ? e.message : 'Unknown error',
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [files, folders, query, version, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
