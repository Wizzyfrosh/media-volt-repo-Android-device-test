import { extractHttpUrl, parseHttpUrl } from '@/utils/url';
import { formatBytes, formatDuration } from '@/utils/format';

describe('parseHttpUrl', () => {
  it('accepts normal http and https links', () => {
    expect(parseHttpUrl('https://www.example.com/video/123?x=1')?.host).toBe('example.com');
    expect(parseHttpUrl('  http://files.example.org/a.mp4 ')?.href).toBe(
      'http://files.example.org/a.mp4',
    );
  });

  it('rejects other schemes, bare words and broken hosts', () => {
    for (const bad of [
      '',
      'hello',
      'ftp://example.com/a',
      'javascript:alert(1)',
      'https://',
      'https://nodot',
      'https://.com',
      'https://a b.com',
    ]) {
      expect(parseHttpUrl(bad)).toBeNull();
    }
  });
});

describe('extractHttpUrl', () => {
  it('finds a link inside shared text and trims trailing punctuation', () => {
    expect(extractHttpUrl('Look at this: https://example.com/watch?v=1, so good!')).toBe(
      'https://example.com/watch?v=1',
    );
    expect(extractHttpUrl('(https://example.com/a)')).toBe('https://example.com/a');
  });

  it('returns null when there is no link', () => {
    expect(extractHttpUrl('no link here')).toBeNull();
    expect(extractHttpUrl(null)).toBeNull();
  });
});

describe('format helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(9.56 * 1024 * 1024)).toBe('9.56 MB');
    expect(formatBytes(106.2 * 1024 ** 3)).toBe('106 GB');
  });

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
