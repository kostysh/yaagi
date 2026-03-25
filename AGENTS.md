# AGENTS.md

This repository uses the `dossier-engineer` skill.
This file contains repo-specific overlays only.

## Single sources of truth
- Global navigation index: `docs/ssot/index.md`
- Repo architecture overview: `docs/architecture/system.md`
- Per-feature canonical doc: `docs/features/F-*.md` (Feature Dossier)

## Planning backlog
- Candidate feature backlog: `docs/backlog/feature-candidates.md` (non-SSoT)

## Repo-level engineering contracts
- Canonical toolchain and runtime notes: `README.md`
- Cross-cutting ADRs: `docs/adr/ADR-*.md`

## Repo-specific overlays
1. Before `spec-compact`, `plan-slice`, `implementation`, `change-proposal`, or `next-step`, ingest this file, the relevant architecture section, and applicable repo-level ADRs.
2. Deliver on the repository's canonical stack and runtime path from the first commit; the canonical source for that path is `README.md`.
3. For changed source or test code, use the canonical quality gate order `format -> typecheck -> lint` via the root `pnpm` commands, where `format` is the Biome formatting pass and `lint` is the composite Biome + ESLint lint gate.
4. If a change affects runtime, startup, or deployment behavior, run both the fast verification path and the containerized smoke path.
5. If implementation reveals a missing prerequisite seam or a cross-cutting invariant, make the backlog/dossier/ADR realignment explicit before continuing.
6. Before starting `spec-compact` or `plan-slice`, perform and surface an explicit assessment of whether Codex Plan mode is needed. If planning mode is required, ask using the canonical skill prompt in the user's language and wait for the user's decision. After any accepted Plan mode phase, the normal dossier step artifacts and checks are still required.
7. Keep this file overlay-only. Default dossier workflow, independent-review rules, and step-closure protocol live in the `dossier-engineer` skill and should not be duplicated here unless this repository intentionally tightens them.

## Common commands
- Format code: `pnpm format`
- Check formatting: `pnpm format:check`
- Typecheck: `pnpm typecheck`
- Lint code: `pnpm lint`
- Changed-code quality gate: `pnpm quality:fix`
- Automation quality gate: `pnpm quality:check`
- Run fast tests: `pnpm test`
- Run container smoke: `pnpm smoke:cell`
- Audit repo debt markers: `pnpm debt:audit`
- Audit changed-scope debt markers: `pnpm debt:audit:changed`
- Refresh index: `node scripts/index-refresh.mjs`
- Sync index only: `node scripts/sync-index.mjs`
- Lint dossiers: `node scripts/lint-dossiers.mjs`
- Audit coverage: `node scripts/coverage-audit.mjs`
- Print dependency graph: `node scripts/dependency-graph.mjs`
- Resolve next action: `node scripts/next-step.mjs`
- Verify step bundle: `node scripts/dossier-verify.mjs --step implementation --changed-only`
- Persist review: `node scripts/review-artifact.mjs --dossier docs/features/F-0001-foo.md --step implementation --verdict PASS`
- Close step: `node scripts/dossier-step-close.mjs --dossier docs/features/F-0001-foo.md --step implementation --verify-artifact ... --review-artifact ...`
