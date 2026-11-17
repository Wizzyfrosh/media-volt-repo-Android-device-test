const { resolveExtractorsImpl, variantFromEnv } = require('./metro.extractors');

// Run both flavors:  pnpm test:variants
const variant = variantFromEnv();

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@extractors-impl$': resolveExtractorsImpl(variant, __dirname),
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
