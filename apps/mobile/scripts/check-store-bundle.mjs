#!/usr/bin/env node
/**
 * Proves the store flavor ships no extractor code.
 * Exports a production Android bundle for each flavor and looks for the marker
 * string that only exists in src/features/extractors/impl/.
 *   store  -> marker must be ABSENT
 *   direct -> marker must be PRESENT (otherwise this check proves nothing)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MARKER = 'MV_EXTRACTORS_IMPL_PRESENT';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function bundleContainsMarker(variant) {
  const out = mkdtempSync(join(tmpdir(), `mv-${variant}-`));
  try {
    execFileSync(
      'npx',
      ['expo', 'export', '--platform', 'android', '--output-dir', out, '--no-minify', '--no-bytecode', '--clear'],
      { stdio: 'inherit', env: { ...process.env, APP_VARIANT: variant, CI: '1' } },
    );
    return walk(out)
      .filter((f) => /\.(hbc|js|bundle)$/.test(f))
      .some((f) => readFileSync(f).includes(MARKER));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const direct = bundleContainsMarker('direct');
const store = bundleContainsMarker('store');

console.log(`direct bundle contains extractor marker: ${direct}`);
console.log(`store  bundle contains extractor marker: ${store}`);

if (!direct) {
  console.error('FAIL: marker missing from the direct bundle, so this check cannot be trusted.');
  process.exit(1);
}
if (store) {
  console.error('FAIL: extractor code leaked into the store bundle.');
  process.exit(1);
}
console.log('OK: the store bundle contains no extractor code.');
