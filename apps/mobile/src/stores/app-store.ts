import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kvStorage } from '@/services/storage';
import type { ThemeMode } from '@/theme/tokens';

export type LibraryView = 'grid' | 'list';
export type LibrarySort = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

interface AppState {
  onboarded: boolean;
  themeMode: ThemeMode;
  wifiOnly: boolean;
  clipboardDetection: boolean;
  libraryView: LibraryView;
  librarySort: LibrarySort;
  libraryDirection: SortDirection;
  completeOnboarding: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setWifiOnly: (value: boolean) => void;
  setClipboardDetection: (value: boolean) => void;
  setLibraryView: (view: LibraryView) => void;
  setLibrarySort: (sort: LibrarySort, direction: SortDirection) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      themeMode: 'dark',
      wifiOnly: false,
      clipboardDetection: true,
      libraryView: 'grid',
      librarySort: 'date',
      libraryDirection: 'desc',
      completeOnboarding: () => set({ onboarded: true }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setWifiOnly: (wifiOnly) => set({ wifiOnly }),
      setClipboardDetection: (clipboardDetection) => set({ clipboardDetection }),
      setLibraryView: (libraryView) => set({ libraryView }),
      setLibrarySort: (librarySort, libraryDirection) => set({ librarySort, libraryDirection }),
    }),
    {
      name: 'mediavault-app',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        themeMode: s.themeMode,
        wifiOnly: s.wifiOnly,
        clipboardDetection: s.clipboardDetection,
        libraryView: s.libraryView,
        librarySort: s.librarySort,
        libraryDirection: s.libraryDirection,
      }),
    },
  ),
);
