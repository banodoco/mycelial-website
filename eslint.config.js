import js from '@eslint/js';
import globals from 'globals';

const ignoredMaterial = [
  '**/node_modules/**',
  '.desloppify/**',
  'archive/**',
  'assets/**',
  'docs/**',
  'journey-v6-plan/**',
  'static/**',
  'vendor/**',
  'runtime/**',
  'content/content-archive-deferred.js',
  'ownership/reasons.js',
];

export default [
  { ignores: ignoredMaterial },
  {
    files: ['mycelial/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Shared by the classic scripts loaded from mycelial/index.html.
        AstridCore: 'readonly',
        AstridDemo: 'readonly',
        AstridFlowers: 'readonly',
        AstridFlywheel: 'readonly',
        AstridMark: 'readonly',
        AstridMink: 'readonly',
        AstridPays: 'readonly',
        installDeckProgress: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: [
      '*.js',
      'content/**/*.js',
      'journey/**/*.js',
      'organism/**/*.js',
      'ownership/**/*.js',
      'tools/**/*.js',
      'tools/**/*.mjs',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Keep pre-existing dead-code findings visible without making the first
      // tooling-only change rewrite runtime modules.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-useless-assignment': 'warn',
    },
  },
];
