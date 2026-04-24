# Skill Audit: session 019dbf3f

Status: validated by agent after CLI scaffold

## Scope

This audit covers skills used or materially implicated in the session ending at trace line `4913`.

The raw CLI scaffold over-reported some skills because it matched names in repository text. `doc`, `documentation`, and `playwright` were false positives for this retrospective and are not treated as active session skills.

## Summary

The useful skill stack was correct: `unified-dossier-engineer` controlled dossier/backlog workflow, `implementation-discipline` kept changes bounded, reviewer skills found real issues, and `git-engineer` kept the CF-027 history split into reviewable commits.

The weak point was not skill selection. The weak point was that some skill instructions left critical checks to late review instead of making them pre-review entry criteria.

## Skill Findings

### `unified-dossier-engineer`

What worked:

- The canonical stage sequence produced durable artifacts for intake, spec, plan, implementation, verification, review, and closure.
- Lifecycle reconciliation prevented the `CF-024` drift pattern from repeating on `CF-027`.
- Stage logs captured review rounds, commits, final review freshness, and required audit classes.

Gaps:

- Post-implementation source refresh is still outside the hard closure contract. The backlog reached the final clean state only after the operator asked for refresh/attention.
- Retrospective scan did not include stage logs even though the trace referenced them.
- Review rounds reuse stable artifact paths, so earlier FAIL details can be overwritten or reduced to `must_fix_count` in the stage state.

Recommended changes:

- Add a final backlog hygiene gate after implementation close: `refresh`, `status`, `attention`, and `queue`, or an equivalent structured closure artifact.
- Add first-class historical review-attempt artifacts or round ids.
- Extend retrospective support to include referenced stage logs for a selected feature/session.

### `implementation-discipline`

What worked:

- The implementation stayed inside the existing runtime, PostgreSQL, contract, and test seams.
- A risky database-constraint direction for active-scope activation was rejected before finalization.
- Each review blocker was closed with focused regression coverage.

Gap:

- The skill did not force an explicit invariant checklist before changing append-only decision facts.

Recommended change:

- Add an implementation prompt/checklist for persistence invariants: append-only facts, replay ids, fail-closed persistence errors, stale evidence, and concurrent activation.

### `spec-conformance-reviewer`

What worked:

- The first feature-intake review correctly failed scaffold-only scope content.
- Implementation review caught the explicit consultant DENY semantic gap.
- Final review tied AC coverage to concrete files and focused tests.

Gap:

- Spec review alone did not catch all runtime edge cases; code review later found replay/freshness/concurrency issues.

Recommended change:

- For policy/admission features, spec-conformance review prompts should require a small edge-case matrix: explicit allow, explicit deny, missing evidence, stale evidence, conflicting replay, persistence failure, and concurrent activation.

### `code-reviewer`

What worked:

- Code review found real blockers after apparently passing spec/security checks:
  - conflicting consultant admission replay;
  - missing freshness timestamp handling;
  - active-scope activation concurrency.
- Final PASS included targeted tests, typecheck, lint, and full `pnpm test`.

Gap:

- The review was effective but late. It acted as the main discovery mechanism for policy edge cases.

Recommended change:

- Promote recurring code-review findings into author-side pre-review checklists for this feature family.

### `security-reviewer`

What worked:

- The final review checked admission gating, no-remap boundaries, advisory-lock activation, canonical stimulus references, and fail-closed behavior.
- Security review was correctly required because the implementation changed policy enforcement and external consultant admission behavior.

Gap:

- Earlier security PASS did not eliminate later correctness blockers found by code review. That is acceptable, but the prompt should make replay, freshness, and activation races explicit for security-relevant policy gates.

Recommended change:

- Add replay/conflict/freshness/concurrency probes to security-review prompts when reviewing admission or policy activation features.

### `typescript-engineer`, `node-engineer`, `typescript-test-engineer`

What worked:

- TypeScript contracts, PostgreSQL stores, Node runtime service, and node:test coverage were aligned with the repo's existing style.
- Focused tests were used before broad gates.
- Final gates passed: format, typecheck, lint, full tests, and container smoke.

Gap:

- The first full `pnpm test` had a sandbox `listen EPERM` issue and required rerun outside sandbox. This was handled, but verification artifacts would be clearer if execution-environment failures were summarized instead of embedded in huge stdout blobs.

Recommended change:

- Verification artifacts should store a concise command summary and classify environment failures separately from product failures.

### `git-engineer`

What worked:

- Commits were split by stage and fix:
  - `0be3f24` initial implementation;
  - `533d6b8`, `e7f7ca4`, `9ccec40`, `2b9e8f8` targeted fixes;
  - `1a0f795` implementation close;
  - `2f967d1` source-review refresh.
- This made external review and rerounds tractable.

Gap:

- The session had many small correctness commits. That was appropriate under review pressure, but later retrospective reading depends heavily on stage logs to explain why each fix exists.

Recommended change:

- When a commit closes a review blocker, include the review class and blocker keyword in either the stage log or a structured remediation field.

### `retrospective-phase-analysis`

What worked:

- The skill correctly required a trace boundary before analyzing an active session.
- The default report directory and scan/report/skill-audit/logging-review flow were useful.

Gap:

- The CLI-generated Markdown was unsafe to use as-is. It reported no stage logs and no incidents despite the trace referencing relevant logs and review artifacts.

Recommended change:

- Make generated reports explicitly fail if dossier activity is detected but no stage logs were included, and provide the exact command to rerun with explicit artifact inclusion.

## Verdict

Skill use was broadly correct. The highest-value improvements are to `unified-dossier-engineer`, `implementation-discipline`, and reviewer prompts so that backlog hygiene and policy fail-closed checks move earlier in the workflow.
