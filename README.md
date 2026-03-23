# yaagi
Yet Another AGI

## Concept

`yaagi` is an implementation path for the Polyphony concept: one long-lived, identity-bearing agent with its continuity anchored outside any single model.

- Concept document: [English translation](docs/polyphony_concept.en.md), [canonical Russian original](docs/polyphony_concept.md)
- The agent lives through ticks, keeps a single timeline, and stores durable state in a PostgreSQL-based state kernel.
- Mastra is used as the reasoning and tooling substrate, while Polyphony Runtime keeps ownership of identity, memory, temporal continuity, and execution discipline.
- Local model services act as cognitive organs, not as separate personalities.
- The workspace, skills, and code body are Git-governed, while constitutional constraints define boot, recovery, and operating boundaries.
- The system is designed to grow in phases: from a local deployment cell, to a richer runtime, to workshop-driven model evolution and controlled body change.

## Basic Workflow

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
- local secret-bearing overrides: repo-root `.env.local` (gitignored), with checked-in shape in `.env.example`; canonical local-secret launch paths are `pnpm cell:up:local` and `pnpm smoke:cell:local`, while application code continues to read `process.env`
- default test runner: `node:test`
- canonical quality/style toolchain: `Biome + ESLint`
- fast code verification: `pnpm test`
- canonical changed-code flow: `pnpm quality:fix`
- canonical automation gate: `pnpm quality:check`
- minimum GitHub Actions testing workflow: `.github/workflows/test.yml` runs `pnpm quality:check` then `pnpm test` on `pull_request` and `push` to `master`
- containerized phase-0 smoke verification: `pnpm smoke:cell`
  runs a suite-scoped deployment-cell harness with deterministic runtime resets between individual scenarios inside each scenario family instead of per-test full `compose down/up`

Repo-level ADRs:
- `docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md`
- `docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `docs/adr/ADR-2026-03-19-boot-dependency-contract.md`
- `docs/adr/ADR-2026-03-19-quality-gate-sequence.md`
