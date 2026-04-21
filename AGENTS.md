# AGENTS.md

This repository uses the `unified-dossier-engineer` skill.
This file contains repo-specific overlays only.

## Single sources of truth
- Global navigation index: `docs/ssot/index.md`
- Repo architecture overview: `docs/architecture/system.md`
- Per-feature canonical doc: `docs/ssot/features/F-*.md` (Feature Dossier)

## Backlog workflow
- Backlog root: `.dossier/backlog/`
- Backlog shaping, task selection, readiness checks, source review, gaps, attention, and lifecycle actualization use the canonical unified `dossier-engineer` runtime
- Legacy planning inputs retained for migration and historical traceability: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`, `docs/notes/backlog-legacy/local-vllm-model-shortlist-2026-03-24.md`

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
7. Backlog and dossier automation must call the canonical installed skill scripts directly; checked-in local CLI copies or wrappers are not valid.
8. Dossier stage logs under `.dossier/logs/`, including package-based implementation logs, must be written in the operator's language for the current session.
9. Every task that writes, changes, or reviews code must use the `implementation-discipline` skill together with the relevant domain or review skill; this is repo-wide enforcement, not optional guidance.
10. Keep this file overlay-only. Default unified backlog/dossier workflow, independent-review rules, and step-closure protocol live in the `unified-dossier-engineer` skill and should not be duplicated here unless this repository intentionally tightens them.

## Skill automation
- Use the installed canonical `dossier-engineer` runtime from the `unified-dossier-engineer` skill directly.
- In repo docs, `dossier-engineer <command>` is shorthand for that installed skill runtime; absolute local paths are intentionally omitted.
- Do not restore checked-in wrappers, split-model launchers, or local CLI copies.

## Common commands
- Format code: `pnpm format`
- Check formatting: `pnpm format:check`
- Typecheck: `pnpm typecheck`
- Lint code: `pnpm lint`
- Changed-code quality gate: `pnpm quality:fix`
- Automation quality gate: `pnpm quality:check`
- Run fast tests: `pnpm test`
- Run container smoke: `pnpm smoke:cell`

## Skill command quick reference
- Audit repo debt markers: `dossier-engineer debt-audit`
- Audit changed-scope debt markers: `dossier-engineer debt-audit --changed-only`
- Backlog status: `dossier-engineer status`
- Backlog queue: `dossier-engineer queue`
- Backlog gaps: `dossier-engineer gaps`
- Backlog attention: `dossier-engineer attention`
- Backlog report: `dossier-engineer report`
- Refresh index: `dossier-engineer index-refresh`
- Sync index only: `dossier-engineer sync-index`
- Lint dossiers: `dossier-engineer lint-dossiers`
- Audit coverage: `dossier-engineer coverage-audit`
- Print dependency graph: `dossier-engineer dependency-graph`
- Resolve next action for one dossier: `dossier-engineer next-step --dossier docs/ssot/features/F-0001-foo.md`
- Verify step bundle: `dossier-engineer dossier-verify --step implementation --changed-only`
- Persist review: `dossier-engineer review-artifact --dossier docs/ssot/features/F-0001-foo.md --step implementation --verdict PASS`
- Close step: `dossier-engineer dossier-step-close --dossier docs/ssot/features/F-0001-foo.md --step implementation --verify-artifact ... --review-artifact ...`
