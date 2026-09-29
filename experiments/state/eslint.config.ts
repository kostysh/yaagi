import type { Linter } from "eslint";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "migrations/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/**", "@polyphony/*/*"],
              message:
                "Use public root exports of the existing core-types package only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["contracts.ts", "sqlite.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration:not([importKind='type'])",
          message: "Contracts are type-only.",
        },
        {
          selector: "ImportExpression",
          message: "Contracts must not load native code.",
        },
        {
          selector: "ExportAllDeclaration",
          message: "No indirect runtime exports from contracts.",
        },
        {
          selector: "ExportNamedDeclaration[source]",
          message: "No indirect runtime exports from contracts.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "node:*",
            "sqlite-vec",
            "drizzle-orm",
            "drizzle-orm/*",
            "./probe.js",
            "**/packages/**",
            "@polyphony/*/*",
          ],
        },
      ],
    },
  },
] satisfies Linter.Config[];
