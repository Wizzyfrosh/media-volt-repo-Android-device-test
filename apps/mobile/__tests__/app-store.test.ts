import { useAppStore } from '@/stores/app-store';

describe('app store', () => {
  it('starts un-onboarded, dark, with clipboard detection on', () => {
    const s = useAppStore.getState();
    expect(s.onboarded).toBe(false);
    expect(s.themeMode).toBe('dark');
    expect(s.clipboardDetection).toBe(true);
  });

  it('updates settings', () => {
    useAppStore.getState().completeOnboarding();
    useAppStore.getState().setThemeMode('light');
    useAppStore.getState().setWifiOnly(true);
    const s = useAppStore.getState();
    expect([s.onboarded, s.themeMode, s.wifiOnly]).toEqual([true, 'light', true]);
  });
});
