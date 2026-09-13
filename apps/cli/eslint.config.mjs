import { config } from '@jaja/eslint-config/base';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * CLI Node + Ink. O config base do monorepo usa o parser Babel (pensado para JS); aqui os arquivos
 * .ts/.tsx passam pelo parser do typescript-eslint, com as regras recomendadas e as globals do Node.
 */
export default tseslint.config(
  ...config,
  ...tseslint.configs.recommended.map((entry) => ({ ...entry, files: ['**/*.ts', '**/*.tsx'] })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  pluginReactHooks.configs.flat.recommended,
  { ignores: ['dist/**', 'bin/**'] },
);
