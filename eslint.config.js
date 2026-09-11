// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'site/dist/*', '.jest-cache/*', '.claude/**', '.vision-bench/**'],
  },
  {
    // Unit tests run under Jest in Node, not in the app runtime — so they get
    // both the Jest globals and CommonJS/Node ones (a test that walks the repo
    // to lint theme tokens legitimately needs `require` and `__dirname`).
    files: ['__tests__/**/*.js', 'test-utils/**/*.js', 'jest.setup.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
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
