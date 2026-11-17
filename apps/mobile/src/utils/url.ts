export interface ParsedUrl {
  href: string;
  host: string;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;
const HTTP_URL = /^https?:\/\/([^/?#:@\s]+)(?::\d{1,5})?(?:[/?#]\S*)?$/i;

/** Parses an http(s) link without relying on the platform URL class. */
export function parseHttpUrl(input: string | null | undefined): ParsedUrl | null {
  if (!input) return null;
  const href = input.trim();
  const match = HTTP_URL.exec(href);
  const host = match?.[1]?.toLowerCase();
  if (!host) return null;
  const looksLikeHost = host.includes('.') || host === 'localhost';
  if (!looksLikeHost || host.startsWith('.') || host.endsWith('.')) return null;
  return { href, host: host.replace(/^www\./, '') };
}

/** Finds the first http(s) link in free text, such as clipboard or shared text. */
export function extractHttpUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const found = URL_IN_TEXT.exec(text)?.[0];
  if (!found) return null;
  const trimmed = found.replace(/[),.;!?]+$/, '');
  return parseHttpUrl(trimmed)?.href ?? null;
}
