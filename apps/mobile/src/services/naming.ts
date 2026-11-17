import { extensionOf } from './file-types';

const MAX_NAME = 120;

/** Cleans a user-visible name: no path characters, no control characters, bounded length. */
export function sanitizeName(raw: string): string {
  let name = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');

  if (name.length > MAX_NAME) {
    const ext = extensionOf(name);
    const keep = ext ? MAX_NAME - ext.length - 1 : MAX_NAME;
    const base = ext ? name.slice(0, name.length - ext.length - 1) : name;
    name = ext ? `${base.slice(0, keep).trimEnd()}.${ext}` : base.slice(0, keep).trimEnd();
  }
  return name === '' ? 'file' : name;
}

/** Splits "report.final.pdf" into { base: "report.final", ext: ".pdf" }. */
export function splitName(name: string): { base: string; ext: string } {
  const ext = extensionOf(name);
  if (!ext) return { base: name, ext: '' };
  return {
    base: name.slice(0, name.length - ext.length - 1),
    ext: name.slice(name.length - ext.length - 1),
  };
}

/** Last path segment of a path or URI, without the query string. */
export function baseName(path: string): string {
  const clean = path.split('?')[0] ?? path;
  const trimmed = clean.replace(/\/+$/, '');
  const decoded = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(decoded);
  } catch {
    return decoded;
  }
}

/**
 * "name.ext" -> "name (1).ext" -> "name (2).ext" ... until `taken` says the name is free.
 * `taken` should compare case-insensitively, like the database does.
 */
export async function uniqueName(
  desired: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await taken(desired))) return desired;
  const { base, ext } = splitName(desired);
  for (let n = 1; n <= 999; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base} (${Date.now().toString(36)})${ext}`;
}

/** Joins a directory and a name with exactly one slash. */
export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, '')}/${name.replace(/^\/+/, '')}`;
}
