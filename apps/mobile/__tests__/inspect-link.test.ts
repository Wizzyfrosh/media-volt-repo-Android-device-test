import {
  deriveFileName,
  inspectLink,
  LinkInspectError,
  parseContentDisposition,
} from '@/features/downloads/inspect-link';
import { extensionFromMime } from '@/services/file-types';

type Init = { method?: string; headers?: Record<string, string>; signal?: AbortSignal };
const res = (status: number, headers: Record<string, string> = {}, url?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
});

describe('parseContentDisposition', () => {
  it.each([
    ['attachment; filename="my clip.mp4"', 'my clip.mp4'],
    ['attachment; filename=plain.pdf', 'plain.pdf'],
    ["attachment; filename*=UTF-8''na%C3%AFve%20file.txt", 'naïve file.txt'],
    ['attachment; filename="ascii.txt"; filename*=UTF-8\'\'real%20name.txt', 'real name.txt'],
    ['attachment; filename="a \\"quoted\\" name.txt"', 'a "quoted" name.txt'],
    ['inline', null],
  ])('%s', (header, expected) => {
    expect(parseContentDisposition(header)).toBe(expected);
  });

  it('returns null for a missing header', () => {
    expect(parseContentDisposition(null)).toBeNull();
  });
});

describe('deriveFileName', () => {
  it('prefers the header, then the URL path, then the host', () => {
    expect(
      deriveFileName({
        disposition: 'attachment; filename="a.mp4"',
        finalUrl: 'https://x.com/b.mp4',
        mime: null,
      }),
    ).toBe('a.mp4');
    expect(
      deriveFileName({
        disposition: null,
        finalUrl: 'https://x.com/dir/My%20Song.mp3?token=1',
        mime: null,
      }),
    ).toBe('My Song.mp3');
    expect(
      deriveFileName({
        disposition: null,
        finalUrl: 'https://cdn.example.com/',
        mime: 'video/mp4',
      }),
    ).toBe('cdn_example_com.mp4');
  });

  it('adds an extension from the MIME type when the name has none', () => {
    expect(
      deriveFileName({
        disposition: null,
        finalUrl: 'https://x.com/download/123',
        mime: 'application/pdf',
      }),
    ).toBe('123.pdf');
    expect(extensionFromMime('image/jpeg; charset=x')).toBe('jpg');
    expect(extensionFromMime('application/x-unknown')).toBe('');
  });

  it('cleans unsafe names from the server', () => {
    expect(
      deriveFileName({
        disposition: 'attachment; filename="../../etc/passwd"',
        finalUrl: 'https://x.com/',
        mime: null,
      }),
    ).not.toMatch(/[\\/]/);
  });
});

describe('inspectLink', () => {
  it('reads name, type and size from a HEAD response', async () => {
    const fetchImpl = jest.fn(async () =>
      res(
        200,
        { 'content-type': 'video/mp4', 'content-length': '9560000', 'accept-ranges': 'bytes' },
        'https://cdn.x.com/v/clip.mp4',
      ),
    );
    const info = await inspectLink('https://x.com/clip', { fetchImpl });
    expect(info).toMatchObject({
      finalUrl: 'https://cdn.x.com/v/clip.mp4',
      fileName: 'clip.mp4',
      mime: 'video/mp4',
      sizeBytes: 9_560_000,
      acceptsRanges: true,
      kind: 'file',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to a one-byte ranged GET when the server refuses HEAD', async () => {
    const calls: Init[] = [];
    const fetchImpl = async (_u: string, init?: Init) => {
      calls.push(init ?? {});
      if (init?.method === 'HEAD') return res(405);
      return res(206, {
        'content-type': 'application/pdf',
        'content-length': '1',
        'content-range': 'bytes 0-0/52000',
      });
    };
    const info = await inspectLink('https://x.com/doc.pdf', { fetchImpl });
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    expect(calls[1]!.headers).toEqual({ Range: 'bytes=0-0' });
    expect(info).toMatchObject({
      sizeBytes: 52000,
      acceptsRanges: true,
      mime: 'application/pdf',
      fileName: 'doc.pdf',
    });
  });

  it('also falls back when HEAD throws', async () => {
    const fetchImpl = async (_u: string, init?: Init) => {
      if (init?.method === 'HEAD') throw new Error('connection reset');
      return res(200, { 'content-type': 'audio/mpeg', 'content-length': '300' });
    };
    expect((await inspectLink('https://x.com/a.mp3', { fetchImpl })).sizeBytes).toBe(300);
  });

  it('works out the type from the file name when the server sends a generic type', async () => {
    const fetchImpl = async () =>
      res(200, {
        'content-type': 'application/octet-stream',
        'content-disposition': 'attachment; filename="film.mkv"',
      });
    const info = await inspectLink('https://x.com/get?id=1', { fetchImpl });
    expect(info).toMatchObject({ mime: 'video/x-matroska', fileName: 'film.mkv', sizeBytes: null });
  });

  it('recognizes a web page, which is not a downloadable file', async () => {
    const fetchImpl = async () => res(200, { 'content-type': 'text/html; charset=utf-8' });
    expect((await inspectLink('https://x.com/watch?v=1', { fetchImpl })).kind).toBe('webpage');
  });

  it('rejects things that are not web links, without any request', async () => {
    const fetchImpl = jest.fn();
    await expect(inspectLink('ftp://x.com/a', { fetchImpl })).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
    await expect(inspectLink('not a link', { fetchImpl })).rejects.toBeInstanceOf(LinkInspectError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports the HTTP status when both attempts fail', async () => {
    const fetchImpl = async () => res(404);
    await expect(inspectLink('https://x.com/missing.mp4', { fetchImpl })).rejects.toMatchObject({
      code: 'HTTP',
      status: 404,
    });
  });

  it('reports a network error when the site cannot be reached', async () => {
    const fetchImpl = async () => {
      throw new Error('Network request failed');
    };
    await expect(inspectLink('https://x.com/a.mp4', { fetchImpl })).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('times out slow servers', async () => {
    const fetchImpl = (_u: string, init?: Init) =>
      new Promise<ReturnType<typeof res>>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(
      inspectLink('https://x.com/slow', { fetchImpl, timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
