# Skill audit: F-0028 implementation session

Status: validated

## Summary

- Skills explicitly used or materially relevant: `unified-dossier-engineer`, `implementation-discipline`, `typescript-engineer`, `typescript-test-engineer`, `hono-engineer`, `git-engineer`, `spec-conformance-reviewer`, `code-reviewer`, `security-reviewer`, `retrospective-phase-analysis`.
- Overall assessment: the skill stack was sufficient and the control model worked, but several instructions rely on operator discipline rather than enforceable checks.
- Highest-impact gap: the independent-review rule needs an operational guard for artifact writer provenance.

## unified-dossier-engineer

What worked:

- Stage logs, step artifacts, review freshness, selected review bundle, and post-close hygiene gave a reliable final truth.
- The final `rpa_source_quality` fields correctly reported complete selected-bundle quality and no missing FAIL artifacts.
- Post-close hygiene caught stale affected-feature state and forced a final clean refresh.

What failed or was weak:

- The workflow allowed a parent-authored FAIL artifact to be recorded with external reviewer metadata. The rule existed socially, but not as a hard check.
- `review_events` capture reviewer id and thread id for selected artifacts, but not enough to prove the artifact writer was the reviewer process.
- The auto retrospective scan did not ingest validated stage logs by default, so it produced noisy trace-derived non-PASS candidates.

Recommended improvement:

- Add a review-artifact provenance field or audit trail that records the command actor/thread, and make `dossier-step-close` reject selected artifacts whose actor is not the reviewer thread.
- Make retrospective scan accept or auto-discover same-session stage logs when `rpa_source_identity.session_id` matches the trace.

## implementation-discipline

What worked:

- Fixes were mostly surgical and followed reviewer findings directly.
- The session avoided unrelated refactors and preserved feature scope after CF-029 was found out of scope.

What failed or was weak:

- Review readiness was declared before the state-machine negative matrix was mature.
- Several related invariants were fixed serially instead of being modeled together: idempotency, owner-routed side effects, terminal closure immutability, and canonical evidence readiness.

Recommended improvement:

- For stateful workflows, require an explicit "adjacent invariant matrix" before first external audit. The matrix must include replay, conflict, thrown owner seam, stale reader, terminal-state mutation, and cross-owner write cases.

## typescript-test-engineer

What worked:

- Final coverage was strong: focused support tests, full `pnpm test`, and container smoke passed.
- Regression tests were added for the defects reviewers found, including explicit terminal reopen and missing canonical evidence.

What failed or was weak:

- Tests chased review findings round by round instead of preventing the early review failures.
- The managed verification artifact initially lacked the full gate set needed by the spec.

Recommended improvement:

- For review-entry, generate the negative test inventory from the dossier ACs and pre-review risk families before the implementation is offered to auditors.
- Treat root gates plus full test/smoke evidence as part of the spec-review input, not as a later closure repair.

## spec-conformance-reviewer

What worked:

- Spec r07 correctly blocked incomplete verification evidence.
- Spec r09 correctly found that terminal closure preservation still violated canonical evidence readiness semantics.
- Spec r10 passed only after the final fix and fresh verification.

What failed or was weak:

- Spec review had to police verification packaging that should have been caught before audit launch.

Recommended improvement:

- Add a review intake checklist requiring the parent to hand the spec reviewer a single current verification artifact that includes every AC-mandated gate.

## code-reviewer

What worked:

- Code review repeatedly found real behavioral bugs in replay, side-effect ordering, durable failure handling, scalar merges, and terminal incident reopening.
- The final code PASS was on the same commit as spec/security PASS.

What failed or was weak:

- Multiple code review rounds show the implementer-side model of support incident state was incomplete.

Recommended improvement:

- Add a reusable checklist for support/action state machines: pre-claim, post-claim, side-effect before persist, side-effect after persist, conflict replay, rejected replay, and terminal mutation.

## security-reviewer

What worked:

- Security review caught meaningful issues early: forged owner-routed support actions, replay/conflict protection, and redaction gaps.
- Final security PASS included concrete evidence across support routes, auth classification, redaction, support-owned storage, and canonical refs.

What failed or was weak:

- Security-sensitive concerns overlapped with code/spec findings; earlier shared threat modeling would have reduced repeated rounds.

Recommended improvement:

- Before first audit, require a short threat model for operator support writes: who can trigger owner action, what is persisted before side effects, what gets redacted, and how replay is bounded.

## hono-engineer

What worked:

- Final protected route behavior stayed inside the existing Operator API namespace and kept support writes behind operator admission.

What failed or was weak:

- Route-level error mapping for service-thrown support failures was found late by code review.

Recommended improvement:

- Include first-attempt service failure mapping in route tests whenever a route wraps a durable service with request claims.

## git-engineer

What worked:

- Commits were split into meaningful implementation and process-closure commits.
- Final closure happened on a clean F-0028 worktree before later F-0029 changes.

What failed or was weak:

- The work spanned many commits and review rounds; the final narrative depends on dossier artifacts more than commit messages alone.

Recommended improvement:

- When a phase has more than two review-blocking fix commits, add a short closure summary in the stage log that maps commits to blocking findings.

## retrospective-phase-analysis

What worked:

- The CLI established a durable retro run directory and redacted sensitive absolute paths in the scan summary.
- The skill forced explicit phase boundary and data-quality statements.

What failed or was weak:

- Raw scan without explicit stage-log inclusion overreported trace-derived non-PASS candidates.

Recommended improvement:

- Improve scan heuristics so dossier-backed `rpa_source_quality.review_history_quality: complete` suppresses trace-only duplicate review signals.
