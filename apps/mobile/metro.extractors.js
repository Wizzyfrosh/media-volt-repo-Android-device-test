const path = require('path');

/**
 * Where `@extractors-impl` points for a given flavor.
 * - direct: the real extractor client
 * - store: a no-op, so the real code is never reachable and never bundled
 */
function resolveExtractorsImpl(variant, root) {
  const file = variant === 'direct' ? 'impl/index.ts' : 'impl.noop.ts';
  return path.join(root, 'src', 'features', 'extractors', file);
}

function variantFromEnv(env = process.env) {
  return env.APP_VARIANT === 'direct' ? 'direct' : 'store';
}

module.exports = { resolveExtractorsImpl, variantFromEnv };
