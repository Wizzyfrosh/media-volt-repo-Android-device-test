let counter = 0;

/** Short unique id for local rows and file names. Not a secret and not for security use. */
export function newId(now: number = Date.now()): string {
  counter = (counter + 1) % 46656; // 36^3
  const rand = Math.floor(Math.random() * 1679616) // 36^4
    .toString(36)
    .padStart(4, '0');
  return `${now.toString(36)}${counter.toString(36).padStart(3, '0')}${rand}`;
}
