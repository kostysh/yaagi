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

## State model
- Dossier workflow maturity lives in dossier frontmatter `status`.
- Coverage enforcement lives in dossier frontmatter `coverage_gate`.
- Review freshness lives in `.dossier/reviews/*`.
- Step closure lives in `.dossier/steps/*`.
- Do not overload one field to mean multiple state machines.

## Rules
1. Do not duplicate acceptance criteria text outside dossiers.
2. Start navigation from `docs/ssot/index.md`, then follow links into dossiers.
3. When implementing a feature, reference stable IDs:
   - Feature: `F-0001`
   - Acceptance criteria: `AC-F0001-01`
   - ADR block: `ADR-F0001-01`
   - Slice: `SL-F0001-01`
   - Task: `T-F0001-01`
4. Any behavior-changing PR for `F-XXXX` must update the matching dossier:
   - Progress and links
   - Coverage map
   - Change log when requirements changed
5. Tests must reference AC IDs in test names or `// Covers:` comments.
6. `docs/backlog/feature-candidates.md` may contain `CF-*` candidate entries, but `docs/ssot/index.md` must list only real dossiers.
7. Before `spec-compact`, `plan-slice`, `implementation`, `change-proposal`, or `next-step`, ingest this file, the relevant architecture section, and applicable repo-level ADRs.
8. Deliver on the repository's canonical stack and runtime path from the first commit.
9. For changed source or test code, use the canonical quality gate order `format -> typecheck -> lint` via the root `pnpm` commands, where `format` is the Biome formatting pass and `lint` is the composite Biome + ESLint lint gate.
10. If a change affects runtime, startup, or deployment behavior, run both the fast verification path and the containerized smoke path.
11. If implementation reveals a missing prerequisite seam or a cross-cutting invariant, make the backlog/dossier/ADR realignment explicit before continuing.
12. During request execution, you may spawn sub-agents when this is justified by the task and likely to accelerate delivery; always assess whether delegation is actually useful before doing so.
13. If a spawned sub-agent has completed its task and is no longer needed, stop it promptly so it does not continue consuming resources.
14. The repository operates under a no-technical-debt rule. Here, a "step" means a completed dossier workflow unit (`feature-intake`, `spec-compact`, `plan-slice`, `implementation`, `change-proposal`) or a user-approved implementation increment/slice when delivery is intentionally split across turns.
15. For every mutating step: run local checks, perform explicit debt review on the changed scope, run `pnpm debt:audit:changed` when the changed scope is known, re-check dependencies and adjacent seams, then run `node scripts/dossier-verify.mjs`, then run independent review, persist the verdict via `node scripts/review-artifact.mjs`, then close the step via `node scripts/dossier-step-close.mjs`.
16. After `implementation`, review is not complete unless it explicitly covers completeness against dossier/slices/approved changes, code review, and security review. Marker debt audit does not replace these checks.
17. Do not claim a step is complete unless the matching `.dossier/steps/<feature>/<step>.json` artifact says `process_complete: true`.
18. If executable dossier sections change on a `planned`, `in_progress`, or `done` dossier, run `node scripts/contract-drift-audit.mjs` and record whether code, test, or runtime follow-up is required.
19. Any technical debt discovered during debt review must end with an explicit, recorded resolution path before the step is considered complete: eliminate it immediately, realign the relevant dossier/backlog/ADR, or record a user-approved follow-up in the canonical artifact for that debt class with stable references and dependencies.
20. Canonical follow-up artifacts for unresolved debt are fixed: use the existing feature dossier when the debt belongs to an intaken feature, `docs/backlog/feature-candidates.md` when it exposes a not-yet-intaken seam, and `docs/adr/ADR-*.md` when it is cross-cutting. Chat-only or TODO-only follow-ups do not satisfy this rule.
21. Before starting `spec-compact` or `plan-slice`, perform and surface an explicit assessment of whether Codex Plan mode is needed. Use Plan mode only as a preparatory decision phase, never as a substitute for the dossier step itself.
22. If that assessment concludes Plan mode is needed, do not continue the dossier step immediately. Ask the user exactly: `For the following reasons, <description of reasons>, it is recommended to use planning mode at this step before the workflow dossier step <step name>. If you agree, enable planning mode.` Then stop and wait for the user's decision.
23. If that assessment concludes Plan mode is not needed, state that decision briefly in the user update that begins the step, then continue in the normal mutating workflow.
24. After any accepted Plan mode phase, only the canonical artifacts and checks that are otherwise required for the actual dossier step remain mandatory. Plan mode itself does not create or replace dossier/backlog/ADR/index obligations.

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
