# yaagi
Yet Another AGI

## Dossier workflow

Canonical documentation entry points:
- `docs/architecture/system.md`
- `docs/ssot/index.md`
- `docs/features/F-*.md`

Bootstrap and maintenance commands:
- `node scripts/sync-index.mjs`
- `node scripts/lint-dossiers.mjs`
- `node scripts/coverage-audit.mjs`
- `node scripts/dependency-graph.mjs`

## Developer Runtime Notes

Canonical engineering decisions for the repo:
- package manager and command surface: `pnpm`
- runtime baseline: `Node.js 22 + TypeScript`
- default execution path for local TypeScript code: `node --experimental-strip-types`
- default test runner: `node:test`
- fast code verification: `pnpm test`
- containerized phase-0 smoke verification: `pnpm smoke:cell`

Repo-level ADRs:
- `docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md`
- `docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `docs/adr/ADR-2026-03-19-boot-dependency-contract.md`
