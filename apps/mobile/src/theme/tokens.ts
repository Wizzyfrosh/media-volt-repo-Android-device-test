export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  raised: string;
  border: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  overlay: string;
}

/** Dark-first. Surfaces stay quiet so thumbnails and the one accent carry the screen. */
export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0B0D12',
    surface: '#151922',
    raised: '#1D2230',
    border: '#262C3B',
    primary: '#6C5CE7',
    primaryPressed: '#5A4BD1',
    onPrimary: '#FFFFFF',
    primarySoft: 'rgba(108,92,231,0.18)',
    success: '#2ECC71',
    successSoft: 'rgba(46,204,113,0.16)',
    danger: '#FF6B6B',
    dangerSoft: 'rgba(255,107,107,0.16)',
    text: '#F2F4F8',
    textSecondary: '#9AA3B5',
    textTertiary: '#7A8398',
    overlay: 'rgba(0,0,0,0.55)',
  },
  light: {
    bg: '#F4F6FB',
    surface: '#FFFFFF',
    raised: '#EEF1F7',
    border: '#E3E7F0',
    primary: '#5B4BD6',
    primaryPressed: '#4A3BC0',
    onPrimary: '#FFFFFF',
    primarySoft: 'rgba(91,75,214,0.12)',
    success: '#1A8F4C',
    successSoft: 'rgba(26,143,76,0.12)',
    danger: '#D63B3B',
    dangerSoft: 'rgba(214,59,59,0.10)',
    text: '#12141A',
    textSecondary: '#4F576A',
    textTertiary: '#646C80',
    overlay: 'rgba(18,20,26,0.40)',
  },
};

/** File categories. Each gets its own hue so the library reads at a glance. */
export type CategoryKey = 'videos' | 'audio' | 'images' | 'documents' | 'archives' | 'other';

export const categoryColors: Record<CategoryKey, string> = {
  videos: '#7C6CF0',
  audio: '#3DCB8B',
  images: '#F2677A',
  documents: '#F5B83D',
  archives: '#2BB5A8',
  other: '#5BA8F8',
};

/** Source brand colors, used only for small badges. */
export const sourceColors: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#161823',
  facebook: '#1877F2',
  twitter: '#1D9BF0',
  youtube: '#FF1F1F',
  snapchat: '#F2C200',
  web: '#6C5CE7',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  bodyLarge: { fontSize: 17, lineHeight: 24, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypeVariant = keyof typeof typography;

/** '#RRGGBB' + alpha (0..1) -> 'rgba(r,g,b,a)'. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`withAlpha expects #RRGGBB, got "${hex}"`);
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for '#RRGGBB'. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two '#RRGGBB' colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
