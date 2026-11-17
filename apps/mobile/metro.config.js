const { getDefaultConfig } = require('expo/metro-config');
const { resolveExtractorsImpl, variantFromEnv } = require('./metro.extractors');

const config = getDefaultConfig(__dirname);
const variant = variantFromEnv();

// Separate Metro caches per flavor, so switching never serves a stale bundle.
config.cacheVersion = `mediavault-${variant}`;

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@extractors-impl') {
    return { type: 'sourceFile', filePath: resolveExtractorsImpl(variant, __dirname) };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
