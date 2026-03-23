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
9. For changed source or test code, use the canonical quality gate order `format -> typecheck -> lint` via the root `pnpm` commands, where `format` is the Biome formatting pass and `lint` is the composite Biome + ESLint lint gate.
10. If a change affects runtime, startup, or deployment behavior, run both the fast verification path and the containerized smoke path.
11. If implementation reveals a missing prerequisite seam or a cross-cutting invariant, make the backlog/dossier/ADR realignment explicit before continuing.
12. During request execution, you may spawn sub-agents when this is justified by the task and likely to accelerate delivery; always assess whether delegation is actually useful before doing so.
13. If a spawned sub-agent has completed its task and is no longer needed, stop it promptly so it does not continue consuming resources.
14. The repository operates under a no-technical-debt rule. Here, a "step" means a completed dossier workflow unit (`feature-intake`, `spec-compact`, `plan-slice`, `implementation`) or a user-approved implementation increment/slice when delivery is intentionally split across turns.
15. For every completed step, run an explicit technical-debt review of the changed scope, then re-check that debt against related dependencies and adjacent seams to surface hidden debt. This debt review happens after the step's local checks and before the mandatory independent review gate is considered complete.
16. Any technical debt discovered during that review must end with an explicit, recorded resolution path before the step is considered complete: eliminate it immediately, realign the relevant dossier/backlog/ADR, or record a user-approved follow-up in the canonical artifact for that debt class with stable references and dependencies.
17. Canonical follow-up artifacts for unresolved debt are fixed: use the existing feature dossier when the debt belongs to an intaken feature, `docs/backlog/feature-candidates.md` when it exposes a not-yet-intaken seam, and `docs/adr/ADR-*.md` when it is cross-cutting. Chat-only or TODO-only follow-ups do not satisfy this rule.
18. Before starting `spec-compact` or `plan-slice`, perform and surface an explicit assessment of whether Codex Plan mode is needed. Use Plan mode only as a preparatory decision phase, never as a substitute for the dossier step itself.
19. If that assessment concludes Plan mode is needed, do not continue the dossier step immediately. Ask the user exactly: `For the following reasons, <description of reasons>, it is recommended to use planning mode at this step before the workflow dossier step <step name>. If you agree, enable planning mode.` Then stop and wait for the user's decision. Only after the user agrees may Plan mode be used.
20. If that assessment concludes Plan mode is not needed, state that decision briefly in the user update that begins the step, then continue in the normal mutating workflow.
21. After any accepted Plan mode phase, only the canonical artifacts and checks that are otherwise required for the actual dossier step remain mandatory. Plan mode itself does not create or replace dossier/backlog/ADR/index obligations.

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
- Sync index: `node scripts/sync-index.mjs`
- Lint dossiers: `node scripts/lint-dossiers.mjs`
- Audit coverage: `node scripts/coverage-audit.mjs`
- Print dependency graph: `node scripts/dependency-graph.mjs`
