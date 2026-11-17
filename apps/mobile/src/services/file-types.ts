import type { FileCategory } from '@/db/types';

const BY_EXTENSION: Record<string, { category: FileCategory; mime: string }> = {
  // video
  mp4: { category: 'videos', mime: 'video/mp4' },
  m4v: { category: 'videos', mime: 'video/x-m4v' },
  mov: { category: 'videos', mime: 'video/quicktime' },
  mkv: { category: 'videos', mime: 'video/x-matroska' },
  webm: { category: 'videos', mime: 'video/webm' },
  avi: { category: 'videos', mime: 'video/x-msvideo' },
  '3gp': { category: 'videos', mime: 'video/3gpp' },
  flv: { category: 'videos', mime: 'video/x-flv' },
  wmv: { category: 'videos', mime: 'video/x-ms-wmv' },
  mpg: { category: 'videos', mime: 'video/mpeg' },
  mpeg: { category: 'videos', mime: 'video/mpeg' },
  // audio
  mp3: { category: 'audio', mime: 'audio/mpeg' },
  m4a: { category: 'audio', mime: 'audio/mp4' },
  aac: { category: 'audio', mime: 'audio/aac' },
  wav: { category: 'audio', mime: 'audio/wav' },
  flac: { category: 'audio', mime: 'audio/flac' },
  ogg: { category: 'audio', mime: 'audio/ogg' },
  opus: { category: 'audio', mime: 'audio/opus' },
  wma: { category: 'audio', mime: 'audio/x-ms-wma' },
  amr: { category: 'audio', mime: 'audio/amr' },
  // images
  jpg: { category: 'images', mime: 'image/jpeg' },
  jpeg: { category: 'images', mime: 'image/jpeg' },
  png: { category: 'images', mime: 'image/png' },
  gif: { category: 'images', mime: 'image/gif' },
  webp: { category: 'images', mime: 'image/webp' },
  heic: { category: 'images', mime: 'image/heic' },
  heif: { category: 'images', mime: 'image/heif' },
  bmp: { category: 'images', mime: 'image/bmp' },
  svg: { category: 'images', mime: 'image/svg+xml' },
  avif: { category: 'images', mime: 'image/avif' },
  // documents
  pdf: { category: 'documents', mime: 'application/pdf' },
  doc: { category: 'documents', mime: 'application/msword' },
  docx: {
    category: 'documents',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xls: { category: 'documents', mime: 'application/vnd.ms-excel' },
  xlsx: {
    category: 'documents',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  ppt: { category: 'documents', mime: 'application/vnd.ms-powerpoint' },
  pptx: {
    category: 'documents',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  txt: { category: 'documents', mime: 'text/plain' },
  md: { category: 'documents', mime: 'text/markdown' },
  csv: { category: 'documents', mime: 'text/csv' },
  rtf: { category: 'documents', mime: 'application/rtf' },
  odt: { category: 'documents', mime: 'application/vnd.oasis.opendocument.text' },
  ods: { category: 'documents', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  odp: { category: 'documents', mime: 'application/vnd.oasis.opendocument.presentation' },
  epub: { category: 'documents', mime: 'application/epub+zip' },
  // archives
  zip: { category: 'archives', mime: 'application/zip' },
  rar: { category: 'archives', mime: 'application/vnd.rar' },
  '7z': { category: 'archives', mime: 'application/x-7z-compressed' },
  tar: { category: 'archives', mime: 'application/x-tar' },
  gz: { category: 'archives', mime: 'application/gzip' },
  tgz: { category: 'archives', mime: 'application/gzip' },
  bz2: { category: 'archives', mime: 'application/x-bzip2' },
  xz: { category: 'archives', mime: 'application/x-xz' },
};

const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/rtf',
  'application/epub+zip',
  'application/json',
  'application/xml',
]);

const ARCHIVE_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  'application/x-xz',
]);

/** Lowercase extension without the dot. Empty string when there is none. */
export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

export function mimeFromExtension(ext: string): string | null {
  return BY_EXTENSION[ext.toLowerCase()]?.mime ?? null;
}

/**
 * Category from the MIME type when it is clear, otherwise from the file extension.
 * Servers often send generic types such as application/octet-stream, so the extension is the fallback.
 */
export function detectCategory(input: { mime?: string | null; name: string }): FileCategory {
  const mime = input.mime?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'images';
  if (
    mime.startsWith('text/') ||
    DOCUMENT_MIMES.has(mime) ||
    mime.startsWith('application/vnd.openxmlformats') ||
    mime.startsWith('application/vnd.oasis')
  ) {
    return 'documents';
  }
  if (ARCHIVE_MIMES.has(mime)) return 'archives';

  return BY_EXTENSION[extensionOf(input.name)]?.category ?? 'other';
}
