# Problem matrix by skill: F-0028 implementation session

Status: validated

| ID | Problem | Skill containing the problem | Proposed fix |
|---|---|---|---|
| PM-01 | Parent-authored FAIL review artifact violated independent-review workflow; final selected PASS artifacts were auditor-authored, but the schema cannot prove writer provenance. | `unified-dossier-engineer` | Add writer-thread provenance to `review-artifact`; make `dossier-step-close` reject selected artifacts when writer thread differs from reviewer thread without an explicit degraded-review exception. |
| PM-02 | Implementation entered external review before the support incident replay/state-machine negative matrix was complete. | `implementation-discipline` | Require an adjacent-invariant matrix before review for stateful flows: replay, conflict, owner seam throw, canonical reader failure, terminal mutation, and cross-owner write. |
| PM-03 | Tests were added reactively across several code-review FAIL rounds instead of being derived from the spec/risk matrix before first audit. | `typescript-test-engineer` | Generate review-entry tests from ACs and pre-review risk families; block audit launch until the matrix has direct test refs or explicit non-applicability notes. |
| PM-04 | Spec review had to catch missing closure verification evidence for root gates, full tests, and smoke. | `spec-conformance-reviewer` | Add a pre-spec-review evidence checklist and make managed verification require AC-mandated commands for protected route/side-effect changes. |
| PM-05 | Code review repeatedly found side-effect ordering and durable replay bugs that were not represented as a shared implementation model. | `code-reviewer` | Promote a reusable support/action state-machine checklist into implementation prompts and code-review prompts. |
| PM-06 | Security review found owner-action forgery and redaction gaps that overlapped with code/spec issues. | `security-reviewer` | Require a compact threat model before first audit for support operator writes, owner-routed actions, redaction, and replay boundaries. |
| PM-07 | Route-level service failure mapping for support paths was caught late. | `hono-engineer` | Add route tests for first-attempt service exceptions whenever a Hono route wraps durable request-claim services. |
| PM-08 | Package-manager/sandbox explanation was imprecise, creating operator confusion around whether `pnpm` was installed or only unavailable in the shell. | `node-engineer` / `typescript-engineer` | Use a standard diagnostic sequence: `command -v`, package-manager version, PATH echo, and sandbox/permission classification before reinstall guidance. |
| PM-09 | Retrospective scan overreported trace-derived non-PASS candidates because it did not ingest validated stage logs by default. | `retrospective-phase-analysis` | Auto-bind stage logs with matching session id or provide a first-class `--stage-log` workflow and suppress trace-only duplicates when `rpa_source_quality` is complete. |
| PM-10 | Commit history alone was not enough to understand many review-blocking loops. | `git-engineer` | When a phase has multiple review-fix commits, require a stage-log closure table mapping commit -> blocker -> artifact -> resolving test. |

## Highest priority changes

1. Enforce reviewer artifact writer provenance.
2. Add a stateful side-effect negative matrix before first implementation audit.
3. Make full closure verification evidence a review-entry requirement, not a post-review repair.

## Validation metadata

- agent_validated: true
- validated_scope: F-0028 implementation session through process-complete closure, excluding later F-0029 dirty work and the retrospective generation turn
- residual_confidence: medium
- validated_at: 2026-04-29T15:14:04.825Z
- validation_notes: Validated against the session trace, implementation stage log/state, step artifact, final managed verification, final PASS reviews, selected FAIL review artifacts, commits, and post-close hygiene. Final closure evidence is high confidence; early review writer provenance is medium confidence because the violation is known from trace/operator correction while the review schema does not encode command actor identity.
