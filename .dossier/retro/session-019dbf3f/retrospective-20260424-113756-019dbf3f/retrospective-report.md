# Retrospective: session 019dbf3f

Status: validated by agent after CLI scaffold

## Scope

- Session id: `019dbf3f-4287-7722-9adb-c3ec2482111e`
- Trace boundary: `--until-line 4913`, ending at `2026-04-24T15:44:01.993Z`
- Trace window: `2026-04-24T11:37:56.845Z` to `2026-04-24T15:44:01.993Z`
- Analyzed work: `CF-024` backlog drift correction, `CF-027 / F-0025` feature-intake, spec-compact, plan-slice, implementation, post-implementation backlog refresh/source-review closure.
- Excluded work: retrospective generation itself.

The CLI `scan` output is retained as raw evidence in `scan-summary.json`, but its scaffold was insufficient: it found dossier activity and candidate stage-log paths, yet reported `Stage logs analyzed: 0`. This report corrects that by manually validating the `F-0025` logs, reviews, verification artifacts, step-close artifacts, source-review artifacts, and commits.

## Executive Summary

The session finished in a good product state: `CF-027 / F-0025` is implemented and closed, backlog status is clean, source reviews are closed, lifecycle drift is zero, and the remaining queue is `CF-025 -> CF-019 -> CF-026`.

The main cost was not the happy-path dossier workflow. The cost was repeated late discovery of fail-closed edge cases during implementation review: explicit consultant DENY semantics, conflicting admission replay, freshness timestamp handling, and concurrent active-scope activation. External reviews caught real defects, but they caught them late.

The earlier `CF-024` drift was a process/runtime incident, not only an operator mistake. It produced a concrete `unified-dossier-engineer` issue and backlog correction, and the later `CF-027` closure benefited from the new lifecycle reconciliation behavior.

The second process gap is post-close refresh. The backlog became ideal only after the operator asked for refresh/attention review. That check should be part of the canonical end-of-implementation closure, not a memory-based follow-up.

## Evidence

- `CF-024` skill issue: installed `unified-dossier-engineer/docs/issues/improvement-proposal-20260424-1.md`
- `CF-027` dossier: `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`
- Stage logs:
  - `.dossier/logs/feature-intake/F-0025--fc-F-0025-mocvfju6.md`
  - `.dossier/logs/spec-compact/F-0025--fc-F-0025-mocvfju6--spec-compact-b8ee70c8.md`
  - `.dossier/logs/plan-slice/F-0025--fc-F-0025-mocvfju6--plan-slice-fcd03351.md`
  - `.dossier/logs/implementation/F-0025--fc-F-0025-mocvfju6--implementation-d62cc82d.md`
- Final implementation step close: `.dossier/steps/F-0025/implementation-step-close.json`
- Final implementation reviews:
  - `.dossier/reviews/F-0025/implementation-spec-conformance-review.json`
  - `.dossier/reviews/F-0025/implementation-code-review.json`
  - `.dossier/reviews/F-0025/implementation-security-review.json`
- Source reviews closed after refresh:
  - `.dossier/backlog/source-review/sr-101e300d-dc80-4a8b-a11d-0a3f1849f368.json`
  - `.dossier/backlog/source-review/sr-5aadc3ce-b323-4a75-a0f0-fcd540516f87.json`
  - `.dossier/backlog/source-review/sr-5b9f63ff-21ce-440c-a3a3-7416945dde4f.json`
  - `.dossier/backlog/source-review/sr-ef27eeb6-7dfa-408b-a240-1712dd407575.json`

## Timeline

- `2026-04-24T11:37Z` to `2026-04-24T12:12Z`: investigated `CF-024` drift, confirmed `planned` came from the `F-0024` plan-slice actualization path, recorded a skill/runtime issue, and corrected backlog truth. Relevant commits include `33cee47`, `8a713e4`, and `2dd54dc`.
- `2026-04-24T12:12Z` to `2026-04-24T12:36Z`: ran `feature-intake` for `CF-027`. First external review failed because the dossier and log were scaffold-thin; remediation filled the boundary and closed intake.
- `2026-04-24T12:37Z` to `2026-04-24T12:49Z`: completed `spec-compact`; lifecycle moved to `specified`.
- `2026-04-24T13:06Z` to `2026-04-24T13:14Z`: completed `plan-slice`; lifecycle moved to `planned`.
- `2026-04-24T13:19Z` to `2026-04-24T15:25Z`: implemented `F-0025`. Delivery required several review/fix rounds before final PASS from spec, code, and security reviewers at commit `2b9e8f8`.
- `2026-04-24T15:37Z` to `2026-04-24T15:41Z`: refreshed backlog sources, reviewed four source-review items, acked them as `no_backlog_change`, and committed `2f967d1`.

## Findings

### High: `CF-024` Lifecycle Drift

`F-0024` was done while the mapped backlog item `CF-024` was still `planned`. Queue/status could therefore present already delivered work as ready intake.

Root cause: the previous closure path did not mechanically require selected backlog item lifecycle reconciliation before authoritative step closure.

What worked: the incident was traced to a specific patch and commit, documented as a skill/runtime issue, externally reviewed, and corrected with a backlog patch.

Prevention: keep lifecycle reconciliation as a hard `dossier-step-close` gate and ensure `status`/`queue` expose drift before intake decisions.

### Medium: Feature-Intake Started Too Thin

The first `F-0025` intake review failed with two must-fix findings: scaffold-only boundary content and inaccurate stage-log narrative.

Root cause: the stage was moved toward closure before the dossier contained enough concrete scope facts for independent validation.

Prevention: feature-intake should not request external review until user problem, goal, non-goals, in-scope, out-of-scope, source inputs, and index-refresh evidence are populated.

### High: Implementation Edge Cases Were Found Late

The first delivery commit did not fully satisfy fail-closed policy governance semantics. Review/fix rounds found and closed these material issues:

- explicit consultant admission `deny` must persist as DENY and must not invoke the consultant;
- conflicting consultant admission replay must fail closed before invocation;
- missing `observedAt` with `maxEvidenceAgeMs` must fail closed as stale evidence;
- active-scope activation needs serialized read plus insert on the same PostgreSQL client path.

What worked: external review was valuable and caught real defects before final closure. Targeted regression tests were added as each blocker was fixed.

Root cause: the implementation plan had the right policy surface, but lacked a pre-review checklist for fail-closed and concurrency invariants.

Prevention: add a mandatory policy-governance implementation checklist covering explicit deny, duplicate/conflicting request ids, freshness evidence, persistence failures, and active-scope concurrency before the first implementation review.

### High Near-Miss: Concurrency Fix Risked Breaking Append-Only Semantics

During the active-scope activation fix, a database-constraint style solution was considered and rejected because it would have conflicted with append-only activation facts. The final fix used PostgreSQL advisory locking around active read plus insert.

Root cause: concurrency pressure made a local invariant easy to optimize incorrectly.

Prevention: before adding database constraints to decision/audit tables, require an explicit append-only model check: "does this constraint prevent historical facts from coexisting?"

### Medium: Post-Implementation Refresh Was Operator-Prompted

After implementation closure, source refresh surfaced four source reviews, including an architecture source review linked to all 28 backlog items. They were legitimate source-change reviews and were closed as `no_backlog_change`, but this happened only after the user explicitly asked for refresh/attention.

Final backlog state after review:

- total items: 28
- implemented: 25
- defined: 3
- planned: 0
- gaps: 0
- needs attention: 0
- open source reviews: 0
- lifecycle drift: 0

Prevention: implementation closure should end with a canonical `refresh -> status -> attention -> queue` check, or record equivalent structured evidence.

### Medium: Retrospective CLI Missed Stage Logs

The retrospective CLI identified stage-log paths as referenced, but did not include them because each was classified as `referenced_only`. The scaffold therefore said zero logs were analyzed and zero incidents existed.

Root cause: trace-to-stage-log inclusion is too conservative for active-session analysis.

Prevention: add an explicit `--feature-id` or `--include-stage-log` path, or treat referenced stage logs inside the selected trace boundary as candidate evidence requiring validation instead of excluding them from the report scaffold.

## Controls That Worked

- External review gates worked. They found real correctness and security-adjacent issues before final closure.
- `dossier-step-close` freshness/order checks prevented stale review closure once the final commit changed.
- Root quality gates and container smoke were appropriate for runtime and PostgreSQL behavior.
- The user-level insistence on zero attention before continuing prevented backlog debt from carrying into the next intake.

## Recommendations

1. P0: Add a policy-governance pre-review checklist for fail-closed semantics and concurrency invariants.
2. P0: Make post-implementation backlog refresh/status/attention/queue part of canonical closure.
3. P1: Improve retrospective CLI stage-log inclusion for active-session reviews.
4. P1: Preserve historical FAIL review artifacts instead of reusing the same review JSON path across multiple rounds.
5. P1: Make repeated `ready_for_close` transitions explain which review/fix round they supersede.
6. P2: Add lifecycle time breakdown fields: active coding, review wait, reround time, closure time.

## Verdict

Outcome: PASS with process findings.

The backlog is in a valid state and `CF-027 / F-0025` is correctly closed. The session exposed two workflow improvements that should be treated as real engineering work: make final backlog refresh non-optional, and move policy fail-closed edge-case checks before the first implementation review.
