import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { extractHttpUrl } from '@/utils/url';

/** Looks for a link on the clipboard whenever the screen gains focus. */
export function useClipboardLink(enabled: boolean) {
  const [link, setLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLink(null);
      return;
    }
    try {
      // iOS shows a paste prompt when reading text, but not when only asking if a URL exists.
      if (Platform.OS === 'ios' && !(await Clipboard.hasUrlAsync())) {
        setLink(null);
        return;
      }
      setLink(extractHttpUrl(await Clipboard.getStringAsync()));
    } catch {
      setLink(null);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { link, dismiss: () => setLink(null), refresh };
}
