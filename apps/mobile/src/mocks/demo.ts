import type { CategoryKey } from '@/theme';

/**
 * Sample data so screens can be reviewed before the data layer exists (Phase 1b/1c).
 * Only used when FEATURES.demoData is on (development builds). Never ships in release.
 */

export interface DemoSource {
  id: string;
  name: string;
  total: number;
}

export interface DemoFolder {
  id: string;
  name: string;
  items: number;
}

export interface DemoDocument {
  id: string;
  name: string;
  meta: string;
}

export interface DemoData {
  sources: DemoSource[];
  categoryCounts: Record<CategoryKey, number>;
  folders: DemoFolder[];
  documents: DemoDocument[];
  storage: { usedBytes: number; totalBytes: number; byCategory: Record<CategoryKey, number> };
}

const GB = 1024 ** 3;

export const DEMO: DemoData = {
  sources: [
    { id: 'instagram', name: 'Instagram', total: 120 },
    { id: 'tiktok', name: 'TikTok', total: 36 },
    { id: 'twitter', name: 'X', total: 12 },
    { id: 'facebook', name: 'Facebook', total: 331 },
    { id: 'youtube', name: 'YouTube', total: 18 },
    { id: 'snapchat', name: 'Snapchat', total: 7 },
  ],
  categoryCounts: { videos: 48, audio: 21, images: 134, documents: 37, archives: 6, other: 12 },
  folders: [
    { id: 'f1', name: 'Downloads', items: 13 },
    { id: 'f2', name: 'Instagram', items: 24 },
    { id: 'f3', name: 'Scans', items: 4 },
    { id: 'f4', name: 'Lectures', items: 7 },
    { id: 'f5', name: 'Podcasts', items: 9 },
    { id: 'f6', name: 'Receipts', items: 3 },
  ],
  documents: [
    { id: 'p1', name: 'Tenancy agreement.pdf', meta: 'PDF, 2.4 MB, today' },
    { id: 'p2', name: 'Scan 2026-11-14.pdf', meta: 'PDF, 860 KB, 2 days ago' },
    { id: 'p3', name: 'Budget.xlsx', meta: 'Spreadsheet, 312 KB, last week' },
  ],
  storage: {
    usedBytes: 106.2 * GB,
    totalBytes: 128 * GB,
    byCategory: {
      videos: 41.5 * GB,
      images: 24.8 * GB,
      audio: 9.3 * GB,
      documents: 4.1 * GB,
      archives: 8.7 * GB,
      other: 17.8 * GB,
    },
  },
};

export const EMPTY: DemoData = {
  sources: [],
  categoryCounts: { videos: 0, audio: 0, images: 0, documents: 0, archives: 0, other: 0 },
  folders: [],
  documents: [],
  storage: {
    usedBytes: 0,
    totalBytes: 0,
    byCategory: { videos: 0, audio: 0, images: 0, documents: 0, archives: 0, other: 0 },
  },
};
