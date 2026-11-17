import { FEATURES } from '@/config/features';
import { DEMO, EMPTY, type DemoData } from '@/mocks/demo';

/** Sample data in development builds, empty data otherwise. Replaced by real repositories in Phase 1b. */
export function useDemoData(): DemoData {
  return FEATURES.demoData ? DEMO : EMPTY;
}
