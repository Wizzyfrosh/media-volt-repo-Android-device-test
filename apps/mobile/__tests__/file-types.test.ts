import { detectCategory, extensionOf, mimeFromExtension } from '@/services/file-types';
import { baseName, joinPath, sanitizeName, splitName, uniqueName } from '@/services/naming';

describe('detectCategory', () => {
  it('trusts clear MIME types', () => {
    expect(detectCategory({ mime: 'video/mp4', name: 'x' })).toBe('videos');
    expect(detectCategory({ mime: 'audio/mpeg; charset=binary', name: 'x' })).toBe('audio');
    expect(detectCategory({ mime: 'image/png', name: 'x.bin' })).toBe('images');
    expect(detectCategory({ mime: 'application/pdf', name: 'x' })).toBe('documents');
    expect(detectCategory({ mime: 'text/csv', name: 'x' })).toBe('documents');
    expect(detectCategory({ mime: 'application/zip', name: 'x' })).toBe('archives');
  });

  it('falls back to the extension for generic MIME types', () => {
    expect(detectCategory({ mime: 'application/octet-stream', name: 'Movie.MKV' })).toBe('videos');
    expect(detectCategory({ mime: null, name: 'song.flac' })).toBe('audio');
    expect(detectCategory({ name: 'archive.7z' })).toBe('archives');
    expect(detectCategory({ name: 'sheet.xlsx' })).toBe('documents');
  });

  it('uses other when nothing matches', () => {
    expect(detectCategory({ name: 'installer.apk' })).toBe('other');
    expect(detectCategory({ name: 'noextension' })).toBe('other');
  });
});

describe('extensions and mime', () => {
  it('extracts lowercase extensions', () => {
    expect(extensionOf('a.PDF')).toBe('pdf');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('trailingdot.')).toBe('');
    expect(extensionOf('none')).toBe('');
  });

  it('maps extensions to MIME types', () => {
    expect(mimeFromExtension('MP4')).toBe('video/mp4');
    expect(mimeFromExtension('xyz')).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('removes path characters and control characters', () => {
    expect(sanitizeName('a/b\\c:d*e?"f<g>h|i.mp4')).toBe('a_b_c_d_e__f_g_h_i.mp4');
    expect(sanitizeName('bad\u0000name\n.txt')).toBe('bad_name_.txt');
  });

  it('cannot escape the library folder', () => {
    expect(sanitizeName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(sanitizeName('..')).toBe('file');
  });

  it('handles empty, dotted and spaced input', () => {
    expect(sanitizeName('')).toBe('file');
    expect(sanitizeName('   ')).toBe('file');
    expect(sanitizeName('  .hidden.txt ')).toBe('hidden.txt');
    expect(sanitizeName('name...')).toBe('name');
    expect(sanitizeName('a    b')).toBe('a b');
  });

  it('shortens long names but keeps the extension', () => {
    const out = sanitizeName(`${'x'.repeat(300)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});

describe('name helpers', () => {
  it('splits base and extension', () => {
    expect(splitName('report.final.pdf')).toEqual({ base: 'report.final', ext: '.pdf' });
    expect(splitName('README')).toEqual({ base: 'README', ext: '' });
  });

  it('gets the last path segment from paths and URIs', () => {
    expect(baseName('file:///data/user/0/app/cache/My%20Clip.mp4?x=1')).toBe('My Clip.mp4');
    expect(baseName('/a/b/c.txt')).toBe('c.txt');
    expect(baseName('/a/b/')).toBe('b');
  });

  it('joins paths with a single slash', () => {
    expect(joinPath('/lib/', '/a.txt')).toBe('/lib/a.txt');
    expect(joinPath('file:///lib', 'a.txt')).toBe('file:///lib/a.txt');
  });

  it('numbers duplicates until a free name is found', async () => {
    const taken = new Set(['a.mp4', 'a (1).mp4', 'a (2).mp4']);
    expect(await uniqueName('a.mp4', async (n) => taken.has(n))).toBe('a (3).mp4');
    expect(await uniqueName('b.mp4', async (n) => taken.has(n))).toBe('b.mp4');
    expect(await uniqueName('noext', async (n) => n === 'noext')).toBe('noext (1)');
  });
});
