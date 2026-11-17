/** SQLite caps the number of bound variables per statement, so large id lists run in chunks. */
export const CHUNK = 500;

export function chunk<T>(items: readonly T[], size: number = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/** Escapes LIKE wildcards so user search text is matched literally. Use with ESCAPE '\\'. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
