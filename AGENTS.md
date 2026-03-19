# AGENTS.md

This repository uses the dossier protocol.

## Single sources of truth
- Global navigation index: `docs/ssot/index.md`
- Repo architecture overview: `docs/architecture/system.md`
- Per-feature canonical doc: `docs/features/F-*.md` (Feature Dossier)

## Planning backlog
- Candidate feature backlog: `docs/backlog/feature-candidates.md` (non-SSoT)

## Repo-level engineering contracts
- Canonical toolchain and runtime notes: `README.md`
- Cross-cutting ADRs: `docs/adr/ADR-*.md`

## Rules
1. Do not duplicate acceptance criteria text outside dossiers.
2. Start navigation from `docs/ssot/index.md`, then follow links into dossiers.
3. When implementing a feature, reference stable IDs:
   - Feature: `F-0001`
   - Acceptance criteria: `AC-F0001-01`
   - ADR block: `ADR-F0001-01`
   - Slice: `SL-F0001-01`
   - Task: `T-F0001-01`
4. Any behavior-changing change for `F-XXXX` must update the matching dossier:
   - Progress and links
   - Coverage map
   - Change log when requirements changed
5. Tests must reference AC IDs in test names or `// Covers:` comments.
6. `docs/backlog/feature-candidates.md` may contain `CF-*` candidate entries, but `docs/ssot/index.md` must list only real dossiers.
7. Before implementation, open the target dossier, any `depends_on` dossiers, the relevant architecture section, and applicable repo-level ADRs.
8. Deliver on the repository's canonical stack and runtime path from the first commit.
9. For changed source or test code, use the canonical quality gate order `format -> typecheck -> lint` via the root `pnpm` commands.
10. If a change affects runtime, startup, or deployment behavior, run both the fast verification path and the containerized smoke path.
11. If implementation reveals a missing prerequisite seam or a cross-cutting invariant, make the backlog/dossier/ADR realignment explicit before continuing.

## Common commands
- Format code: `pnpm format`
- Check formatting: `pnpm format:check`
- Typecheck: `pnpm typecheck`
- Lint code: `pnpm lint`
- Changed-code quality gate: `pnpm quality:fix`
- Automation quality gate: `pnpm quality:check`
- Run fast tests: `pnpm test`
- Run container smoke: `pnpm smoke:cell`
- Sync index: `node scripts/sync-index.mjs`
- Lint dossiers: `node scripts/lint-dossiers.mjs`
- Audit coverage: `node scripts/coverage-audit.mjs`
- Print dependency graph: `node scripts/dependency-graph.mjs`
