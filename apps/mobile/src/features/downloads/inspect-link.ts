import { extensionFromMime, extensionOf, mimeFromExtension } from '@/services/file-types';
import { baseName, sanitizeName } from '@/services/naming';
import { parseHttpUrl } from '@/utils/url';

export type LinkKind = 'file' | 'webpage';

export interface LinkInfo {
  /** The link the user pasted. */
  url: string;
  /** Where it ended up after redirects. This is what gets downloaded. */
  finalUrl: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  acceptsRanges: boolean;
  kind: LinkKind;
}

export type LinkInspectErrorCode = 'INVALID_URL' | 'NETWORK' | 'TIMEOUT' | 'HTTP';

export class LinkInspectError extends Error {
  constructor(
    readonly code: LinkInspectErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LinkInspectError';
  }
}

/** The subset of fetch's Response that we read, so tests can supply plain objects. */
interface ResponseLike {
  ok: boolean;
  status: number;
  url?: string;
  headers: { get(name: string): string | null };
}
type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<ResponseLike>;

/** Reads the file name from a Content-Disposition header. Prefers the UTF-8 form (RFC 5987). */
export function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)?'[^']*'([^;]+)/i.exec(header);
  if (star?.[1]) return decode(star[1].trim().replace(/^"|"$/g, ''));
  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, '$1');
  const bare = /filename\s*=\s*([^;]+)/i.exec(header);
  return bare?.[1] ? bare[1].trim() : null;
}

export function deriveFileName(input: {
  disposition: string | null;
  finalUrl: string;
  mime: string | null;
}): string {
  const fromHeader = parseContentDisposition(input.disposition);
  const fromPath = baseName(input.finalUrl.replace(/^https?:\/\/[^/]+/i, ''));
  // A host such as cdn.example.com must not be mistaken for a name with a ".com" extension.
  const host = (parseHttpUrl(input.finalUrl)?.host ?? 'download').replace(/\./g, '_');
  let name = sanitizeName(fromHeader ?? (fromPath || host));
  if (!extensionOf(name)) {
    const ext = extensionFromMime(input.mime);
    if (ext) name = `${name}.${ext}`;
  }
  return name;
}

function parseTotalFromContentRange(value: string | null): number | null {
  const m = /\/(\d+)\s*$/.exec(value ?? '');
  return m?.[1] ? Number(m[1]) : null;
}

function toInfo(url: string, res: ResponseLike): LinkInfo {
  const finalUrl = res.url || url;
  let mime = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || null;
  const disposition = res.headers.get('content-disposition');
  const fileName = deriveFileName({ disposition, finalUrl, mime });
  if (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream') {
    mime = mimeFromExtension(extensionOf(fileName)) ?? mime;
  }

  const rangeTotal = parseTotalFromContentRange(res.headers.get('content-range'));
  const length = Number(res.headers.get('content-length'));
  const sizeBytes =
    rangeTotal ?? (res.status !== 206 && Number.isFinite(length) && length > 0 ? length : null);

  return {
    url,
    finalUrl,
    fileName,
    mime,
    sizeBytes,
    acceptsRanges: res.status === 206 || /bytes/i.test(res.headers.get('accept-ranges') ?? ''),
    kind: mime === 'text/html' || mime === 'application/xhtml+xml' ? 'webpage' : 'file',
  };
}

export interface InspectOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

async function request(
  fetchImpl: FetchLike,
  url: string,
  init: { method: string; headers?: Record<string, string> },
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted)
      throw new LinkInspectError('TIMEOUT', 'The site took too long to answer.');
    throw new LinkInspectError('NETWORK', e instanceof Error ? e.message : 'Could not connect.');
  } finally {
    clearTimeout(timer);
    // Headers are all we need. Stop the body from downloading.
    setTimeout(() => controller.abort(), 0);
  }
}

/**
 * Asks the server what a link points to (name, type, size) without downloading it.
 * Tries HEAD first, then a one-byte ranged GET for servers that refuse HEAD.
 */
export async function inspectLink(url: string, opts: InspectOptions = {}): Promise<LinkInfo> {
  const parsed = parseHttpUrl(url);
  if (!parsed) throw new LinkInspectError('INVALID_URL', 'That is not a web link.');

  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const timeoutMs = opts.timeoutMs ?? 10_000;

  let head: ResponseLike | null = null;
  try {
    head = await request(fetchImpl, parsed.href, { method: 'HEAD' }, timeoutMs);
  } catch (e) {
    if (e instanceof LinkInspectError && e.code === 'TIMEOUT') throw e;
    // some servers drop HEAD requests entirely: fall through to the ranged GET
  }
  if (head?.ok) return toInfo(parsed.href, head);

  const get = await request(
    fetchImpl,
    parsed.href,
    { method: 'GET', headers: { Range: 'bytes=0-0' } },
    timeoutMs,
  );
  if (get.ok) return toInfo(parsed.href, get);

  const status = get.status || head?.status;
  throw new LinkInspectError('HTTP', `The site answered with error ${status}.`, status);
}
