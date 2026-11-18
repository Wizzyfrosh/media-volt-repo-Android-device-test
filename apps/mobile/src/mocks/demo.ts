/**
 * Sample data for screens that have no real data source yet. Only used when FEATURES.demoData is on
 * (development builds). Never ships in release.
 */

export interface DemoSource {
  id: string;
  name: string;
}

export interface DemoData {
  sources: DemoSource[];
}

export const DEMO: DemoData = {
  sources: [
    { id: 'instagram', name: 'Instagram' },
    { id: 'tiktok', name: 'TikTok' },
    { id: 'twitter', name: 'X' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'youtube', name: 'YouTube' },
    { id: 'snapchat', name: 'Snapchat' },
  ],
};

export const EMPTY: DemoData = { sources: [] };
