import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Keep repository-level linting focused on tracked Universal source. These
    // paths contain external tools, worktrees, dependencies, or generated output.
    ignores: [
      '.gstack/**',
      '.worktrees/**',
      'frontend/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/generated/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/.turbo/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  prettier
);
