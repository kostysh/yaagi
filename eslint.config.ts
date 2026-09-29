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
    files: ['packages/queue/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@polyphony/*/*',
                '!@polyphony/state/contracts',
                '!@polyphony/state/adapters',
                '!@polyphony/state/adapters/sqlite',
                '!@polyphony/queue/contracts',
                '!@polyphony/queue/ports',
                '!@polyphony/queue/adapters',
                '!@polyphony/queue/adapters/agenda',
                '!@polyphony/queue/storage',
                '!@polyphony/queue/storage/sqlite',
                '**/state/src/**',
                '**/state/dist/**',
                '**/core-types/src/**',
                '**/core-types/dist/**',
              ],
              message: 'Use only public package exports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/queue/src/contracts.ts', 'packages/queue/src/ports.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[importKind!="type"]',
          message: 'Portable boundaries must be type-only.',
        },
        {
          selector:
            'ImportDeclaration[source.value!="@polyphony/core-types"][source.value!="@polyphony/state/contracts"][source.value!="./contracts.js"]',
          message:
            'Portable boundaries cannot depend on vendor or runtime types.',
        },
        ...[
          'ImportExpression',
          'TSImportType',
          'TSImportEqualsDeclaration',
          'ExportAllDeclaration',
          'ExportNamedDeclaration[source]',
          "CallExpression[callee.name='require']",
        ].map((selector) => ({
          selector,
          message: 'No hidden imports or re-exports in portable boundaries.',
        })),
      ],
    },
  },
  {
    files: [
      'packages/queue/src/index.ts',
      'packages/queue/src/internal/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value!="@polyphony/core-types"][source.value!="@polyphony/state/contracts"][source.value!="zod"][source.value!="./contracts.js"][source.value!="../contracts.js"][source.value!="./ports.js"][source.value!="../ports.js"][source.value!="./internal/model.js"][source.value!="./internal/store.js"][source.value!="./model.js"]',
          message:
            'The neutral queue core cannot import Agenda, SQL, Node or private implementations.',
        },
        ...[
          'ImportExpression',
          'TSImportType',
          'TSImportEqualsDeclaration',
          'ExportAllDeclaration',
          'ExportNamedDeclaration[source]',
          "CallExpression[callee.name='require']",
        ].map((selector) => ({
          selector,
          message: 'No hidden backend imports or re-exports from the core.',
        })),
      ],
    },
  },
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
                '!@polyphony/state/adapters',
                '!@polyphony/state/adapters/sqlite',
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
    files: ['packages/state/src/contracts.ts'],
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
  {
    files: [
      'packages/state/src/index.ts',
      'packages/state/src/internal/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value!="@polyphony/core-types"][source.value!="zod"][source.value!="./contracts.js"][source.value!="../contracts.js"][source.value!="./internal/budget.js"][source.value!="./internal/errors.js"][source.value!="./errors.js"]',
          message:
            'The neutral core may only import its own neutral implementation and core-types/Zod.',
        },
        {
          selector: 'ImportExpression',
          message: 'No backend/runtime loading in the neutral core.',
        },
        {
          selector: 'TSImportType',
          message: 'No hidden backend types in the core.',
        },
        {
          selector: 'TSImportEqualsDeclaration',
          message: 'No import assignments in the core.',
        },
        {
          selector: 'ExportAllDeclaration',
          message: 'No backend re-exports from the core.',
        },
        {
          selector: 'ExportNamedDeclaration[source]',
          message: 'No backend re-exports from the core.',
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: 'No require in the core.',
        },
      ],
    },
  },
] satisfies Linter.Config[];
