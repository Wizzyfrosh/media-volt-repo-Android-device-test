import { useEffect, useState } from 'react';
import { loadExtractors } from '@/features/extractors/load';
import type { ExtractorModule } from '@/features/extractors/types';

/** The extractor module for this build, or null while it loads. The store build gets a disabled no-op. */
export function useExtractors(): ExtractorModule | null {
  const [mod, setMod] = useState<ExtractorModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadExtractors().then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return mod;
}
