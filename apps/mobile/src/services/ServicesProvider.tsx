import * as SplashScreen from 'expo-splash-screen';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorState } from '@/components/ui';
import { openAppDatabase } from '@/db/client';
import { createRepositories, type Repositories } from '@/db/repositories';
import type { Db } from '@/db/types';
import { useTheme } from '@/theme';
import { createBackgroundTransport } from '@/features/downloads/adapters/background-downloader';
import { createExpoNetwork } from '@/features/downloads/adapters/expo-network';
import { DownloadEngine } from '@/features/downloads/engine';
import { concurrencyFor } from '@/features/downloads/limits';
import { useAppStore } from '@/stores/app-store';
import { createExpoFileSystem } from './adapters/expo-fs';
import { createExpoMediaExport } from './adapters/expo-media-export';
import { createExpoThumbnails } from './adapters/expo-thumbnails';
import { FileService } from './file-service';
import type { FileSystemPort } from './ports';

export interface Services extends Repositories {
  db: Db;
  fs: FileSystemPort;
  fileService: FileService;
  downloadEngine: DownloadEngine;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; services: Services }
  | { status: 'error'; message: string };

const ServicesContext = createContext<Services | null>(null);

async function boot(): Promise<Services> {
  const db = await openAppDatabase();
  const repos = createRepositories(db);
  const fs = createExpoFileSystem();
  const fileService = new FileService({
    repos,
    fs,
    thumbnails: createExpoThumbnails(fs),
    media: createExpoMediaExport(),
  });

  const downloadEngine = new DownloadEngine({
    downloads: repos.downloads,
    fileService,
    fs,
    transport: createBackgroundTransport(),
    network: createExpoNetwork(),
    getSettings: () => ({
      wifiOnly: useAppStore.getState().wifiOnly,
      // Pro (5 at once) arrives with billing in Phase 3b.
      concurrencyLimit: concurrencyFor(false),
    }),
    onError: (e) => console.warn('[downloads]', e),
  });
  await downloadEngine.init();
  useAppStore.subscribe((state, prev) => {
    if (state.wifiOnly !== prev.wifiOnly) void downloadEngine.applySettings();
  });

  return { db, fs, fileService, downloadEngine, ...repos };
}

/** Opens the database, then renders the app. The splash screen stays up until this is ready. */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    boot()
      .then((services) => {
        if (cancelled) return;
        setState({ status: 'ready', services });
        // Housekeeping: permanently remove anything that has sat in the trash for 30 days.
        void services.fileService.purgeExpiredTrash().catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.status !== 'loading') void SplashScreen.hideAsync();
  }, [state.status]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (state.status === 'ready') {
    return <ServicesContext.Provider value={state.services}>{children}</ServicesContext.Provider>;
  }
  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ErrorState
          title="MediaVault could not start"
          message={`Your files are safe. Close the app and open it again. (${state.message})`}
          onRetry={retry}
        />
      </View>
    );
  }
  return null;
}

export function useServices(): Services {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useServices must be used inside ServicesProvider');
  return value;
}
