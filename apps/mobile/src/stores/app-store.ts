import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kvStorage } from '@/services/storage';
import type { ThemeMode } from '@/theme/tokens';

interface AppState {
  onboarded: boolean;
  themeMode: ThemeMode;
  wifiOnly: boolean;
  clipboardDetection: boolean;
  completeOnboarding: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setWifiOnly: (value: boolean) => void;
  setClipboardDetection: (value: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      themeMode: 'dark',
      wifiOnly: false,
      clipboardDetection: true,
      completeOnboarding: () => set({ onboarded: true }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setWifiOnly: (wifiOnly) => set({ wifiOnly }),
      setClipboardDetection: (clipboardDetection) => set({ clipboardDetection }),
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
      }),
    },
  ),
);
