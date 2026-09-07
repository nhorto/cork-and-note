// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'site/dist/*'],
  },
  {
    // Unit tests run under Jest in Node, not in the app runtime.
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    // Supabase Edge Functions run on Deno: remote URL imports and the Deno
    // global are expected, and the Node resolver cannot follow either.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
    rules: { 'import/no-unresolved': 'off' },
  },
  {
    // The site generator is a Node build script.
    files: ['site/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', console: 'readonly' } },
  },
]);
