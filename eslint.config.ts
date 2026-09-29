import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

const noSourceDependencySyntax = [
  {
    selector: 'ImportDeclaration',
    message: 'core-types source must not import dependencies.',
  },
  {
    selector: 'ImportExpression',
    message: 'core-types source must not use dynamic imports.',
  },
  {
    selector: 'TSImportType',
    message: 'core-types source must not use import types.',
  },
  {
    selector: 'TSImportEqualsDeclaration',
    message: 'core-types source must not use TypeScript import assignments.',
  },
  {
    selector: 'ExportAllDeclaration',
    message: 'core-types source must not re-export dependencies.',
  },
  {
    selector: 'ExportNamedDeclaration[source]',
    message: 'core-types source must not re-export dependencies.',
  },
  {
    selector: "CallExpression[callee.name='require']",
    message: 'core-types source must not require dependencies.',
  },
  {
    selector:
      "CallExpression[callee.object.name='module'][callee.property.name='require']",
    message: 'core-types source must not require dependencies.',
  },
];

export default [
  {
    ignores: ['**/dist/**', '**/.test-dist/**', '**/node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['packages/core-types/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...noSourceDependencySyntax],
    },
  },
  {
    files: ['packages/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@polyphony/*/*',
                '!@polyphony/state/contracts',
                '!@polyphony/state/sqlite',
                '!@polyphony/state/node',
                '**/core-types/**',
              ],
              message: 'Use only public package exports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/state/src/contracts.ts', 'packages/state/src/sqlite.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[importKind!="type"]',
          message: 'Contracts must be type-only.',
        },
        {
          selector: 'ImportDeclaration[source.value!="@polyphony/core-types"]',
          message: 'Contracts may only depend on core-types.',
        },
        {
          selector: 'ImportExpression',
          message: 'No runtime imports in contracts.',
        },
        {
          selector: 'TSImportType',
          message: 'No hidden import types in contracts.',
        },
        {
          selector: 'TSImportEqualsDeclaration',
          message: 'No import assignments in contracts.',
        },
        {
          selector: 'ExportAllDeclaration',
          message: 'No re-exports in contracts.',
        },
        {
          selector: 'ExportNamedDeclaration[source]',
          message: 'No re-exports in contracts.',
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: 'No require in contracts.',
        },
      ],
    },
  },
] satisfies Linter.Config[];
