import type { Linter } from "eslint";
import tseslint from "typescript-eslint";

const noSourceDependencySyntax = [
  {
    selector: "ImportDeclaration",
    message: "core-types source must not import dependencies.",
  },
  {
    selector: "ImportExpression",
    message: "core-types source must not use dynamic imports.",
  },
  {
    selector: "TSImportType",
    message: "core-types source must not use import types.",
  },
  {
    selector: "TSImportEqualsDeclaration",
    message: "core-types source must not use TypeScript import assignments.",
  },
  {
    selector: "ExportAllDeclaration",
    message: "core-types source must not re-export dependencies.",
  },
  {
    selector: "ExportNamedDeclaration[source]",
    message: "core-types source must not re-export dependencies.",
  },
  {
    selector: "CallExpression[callee.name='require']",
    message: "core-types source must not require dependencies.",
  },
  {
    selector:
      "CallExpression[callee.object.name='module'][callee.property.name='require']",
    message: "core-types source must not require dependencies.",
  },
];

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["packages/core-types/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...noSourceDependencySyntax],
    },
  },
] satisfies Linter.Config[];
