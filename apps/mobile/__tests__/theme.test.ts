import { categoryColors, contrastRatio, palettes, withAlpha } from '@/theme/tokens';
import { resolveScheme } from '@/theme/ThemeProvider';

describe('theme tokens', () => {
  it.each(['dark', 'light'] as const)('%s palette meets WCAG AA for text', (scheme) => {
    const p = palettes[scheme];
    for (const bg of [p.bg, p.surface]) {
      expect(contrastRatio(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textTertiary, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('category colors are valid hex so tints can be derived', () => {
    for (const c of Object.values(categoryColors)) expect(withAlpha(c, 0.2)).toMatch(/^rgba\(/);
    expect(() => withAlpha('red', 0.5)).toThrow();
  });

  it('resolves system mode with a dark default', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
