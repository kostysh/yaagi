# Retrospective: F-0028 implementation session

Status: validated

## Executive summary

- Phase: `F-0028` implementation for `CF-026`, bounded from session start through process-complete closure at `2026-04-29T14:55:01.694Z`.
- Primary result: implementation closed successfully at commit `78652ba50b177668c0b2dbbbd21c9ed74ad6e8a9`; final process closure commit was `1e0ebe3 chore(dossier): close F-0028 implementation`.
- Final quality state: `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused support tests, full `pnpm test`, `pnpm smoke:cell`, managed `dossier-verify`, and post-close backlog hygiene all passed.
- Review result: the first implementation audit did not pass. The final bundle passed only after multiple FAIL rounds across spec, code, and security review.
- Main retrospective conclusion: independent review controls worked and caught real defects, but the phase reached review readiness too early several times. The expensive loop was caused by missing negative-matrix coverage for replay/terminal-state invariants and incomplete managed verification evidence before spec review.

## Scope and exclusions

Included:

- Feature-intake, spec-compact, plan-slice, and implementation execution for `F-0028`.
- Implementation code and docs touching support contracts, operator support routes, PostgreSQL support storage, canonical evidence refs, runbooks, and dossier artifacts.
- Review, verification, stage logs, step closure, and post-close backlog hygiene for `F-0028`.

Excluded:

- Later `F-0029` dirty working-tree artifacts created after the F-0028 boundary.
- Current retrospective-generation commands and artifacts except as report metadata.

## Evidence inventory

- Session trace: `<session-trace:019dd8ba>`, 7040 events inside boundary, 7 compaction events, no aborted turns.
- Stage log: `.dossier/logs/implementation/F-0028--fc-F-0028-mojwnhzd--implementation-861e0d58.md`.
- Stage state: `.dossier/stages/F-0028/implementation.json`.
- Step artifact: `.dossier/steps/F-0028/implementation.json`.
- Final verification: `.dossier/verification/F-0028/implementation-78652ba50b17.json`.
- Post-close hygiene: `.dossier/verification/F-0028/implementation-post-close-backlog-hygiene.json`.
- Final PASS reviews:
  - `.dossier/reviews/F-0028/implementation--spec-conformance-reviewer--r10--pass--78652ba50b17.json`.
  - `.dossier/reviews/F-0028/implementation--code-reviewer--r08--pass--78652ba50b17.json`.
  - `.dossier/reviews/F-0028/implementation--security-reviewer--r07--pass--78652ba50b17.json`.
- Key FAIL reviews:
  - `.dossier/reviews/F-0028/implementation--spec-conformance-reviewer--r07--fail--4cff15bbe24c.json`.
  - `.dossier/reviews/F-0028/implementation--code-reviewer--r07--fail--4cff15bbe24c.json`.
  - `.dossier/reviews/F-0028/implementation--spec-conformance-reviewer--r09--fail--91ea8d94ffcd.json`.

## Timeline

- `10:13Z`: session begins with backlog status and intake selection.
- `10:55Z`: `implementation` stage starts for `F-0028`.
- `11:33Z` to `14:39Z`: stage oscillates between `ready_for_close` and `blocked` as independent audits find implementation and evidence gaps.
- `14:18Z`: `91ea8d9 fix(support): keep terminal incident closure immutable` lands after code review flags terminal incident reopen.
- `14:29Z`: spec r09 fails because terminal-closure preservation runs before fresh canonical-evidence evaluation.
- `14:44Z`: `78652ba fix(support): validate terminal reopen evidence` lands and final verification artifact is regenerated.
- `14:48Z` to `14:52Z`: spec r10, code r10, and security r10 pass through independent reviewer artifacts.
- `14:52Z`: implementation step closes with review freshness `pass` and process-complete state.
- `15:08Z`: post-close backlog hygiene is clean after global refresh.

## Incidents

### RA-01: Review artifact authoring violation

- Severity: high.
- What happened: early FAIL review artifacts were logged by the parent instead of being written by the auditor process. The user caught the violation and corrected the workflow expectation.
- Impact: artifact metadata preserved reviewer identity, but the writer provenance was not trustworthy enough for the rule "auditor writes its own review artifact".
- Recovery: later review rounds were launched so auditors wrote their own artifacts. The final selected PASS bundle has reviewer agent ids and auditor-authored artifacts.
- Prevention: require a parent-side pre-close check that every selected review artifact was written from the reviewer thread, not merely labeled with a reviewer id.

### RA-02: Repeated review loops on replay and side-effect ordering

- Severity: high.
- Evidence: code-reviewer FAIL artifacts r01 through r07 and spec/security FAIL artifacts r01/r02.
- What happened: support incident open/update paths repeatedly missed edge cases around idempotency claims, target-bound replay identity, owner-routed action side effects, rejected request replay, scalar merge safety, and redaction.
- Impact: implementation reached audit before the negative matrix covered the critical state machine.
- Recovery: successive fixes added pre-side-effect update claims, idempotency-first replay, owner seam regression tests, durable requested-action records, and broader support free-text redaction.
- Prevention: for stateful support flows, build the review-entry matrix before first audit: duplicate request, conflicting request, owner seam throw before/after claim, canonical reader unavailable, terminal incident update, and cross-owner action attempt.

### RA-03: Managed verification evidence was incomplete for spec review

- Severity: high.
- Evidence: spec r07 FAIL on commit `4cff15bbe24c`.
- What happened: the managed implementation verification artifact did not include root gates, focused support tests, full `pnpm test`, and `pnpm smoke:cell` evidence required by AC-F0028-15.
- Impact: spec reviewer correctly blocked closure even though code had materially progressed.
- Recovery: verification was regenerated with full evidence and spec r08 passed.
- Prevention: run the full closure evidence checklist before requesting spec review for code-bearing implementation.

### RA-04: Terminal incident fix missed canonical evidence readiness

- Severity: high.
- Evidence: code r07 FAIL found terminal incident reopen; spec r09 FAIL found canonical evidence readiness was not recomputed after terminal preservation.
- What happened: the first terminal-state fix preserved terminal closure status, but still evaluated newly attached canonical refs against stale pre-store evidence.
- Impact: a terminal incident could retain closure while new missing/stale refs escaped the intended closure-readiness semantics.
- Recovery: `78652ba` changed terminal explicit reopen handling so terminal status is preserved while new canonical refs without freshness state are marked missing before readiness evaluation.
- Prevention: test adjacent invariants together, not one at a time: terminal closure immutability plus newly attached canonical evidence readiness.

### RA-05: Environment/tooling ambiguity around pnpm and managed test execution

- Severity: medium.
- What happened: the session hit confusion around `pnpm` availability in PATH and managed verification produced environment-sensitive failures before direct/escalated verification passed.
- Impact: operator trust cost and extra time. The underlying repo toolchain was valid, but the explanation was imprecise.
- Recovery: dependencies/toolchain were restored, direct commands passed, and final managed verification captured passing full test and smoke evidence.
- Prevention: when a tool is unavailable in a sandboxed shell, distinguish "not installed", "not in this shell PATH", and "blocked by sandbox permissions" before proposing remediation.

### RA-06: Post-close hygiene initially surfaced stale backlog/source-review state

- Severity: medium.
- Evidence: post-close hygiene required global refresh; final artifact is clean.
- What happened: closure had to reconcile stale post-close hygiene for affected features and prior source-review state.
- Impact: no final blocker, but closure time increased.
- Recovery: global refresh and post-close hygiene checks returned clean.
- Prevention: run source-review/status hygiene before final review launch when source docs or backlog truth were touched during implementation.

## Controls effectiveness

- Independent audits were effective. They found real bugs in admission, replay, owner routing, redaction, terminal state, evidence readiness, and verification completeness.
- The review order was ultimately correct: spec, code, and security reviews all converged on the same final commit.
- Managed closure state was robust: final step artifact records process completion, review freshness, selected review artifacts, and a clean post-close hygiene artifact.
- The weak point was review-entry discipline. The phase repeatedly asked reviewers to discover cases that should have been in the implementer-side negative matrix.

## Data quality

- High confidence for final closure, final review verdicts, and final verification because they are backed by immutable dossier artifacts.
- Medium confidence for exact early-round timing because the trace contains compaction events and many subagent interactions.
- The generated scan's `44 non-PASS review signals` were not used as authoritative counts because the final stage log reports complete review history with `missing_fail_artifact_count: 0` and `trace_only_fail_count: 0`.
- CLI validation stamp: `agent_validated: true`, `residual_confidence: medium`, `validated_at: 2026-04-29T15:14:04.825Z`.

## Recommendations

1. Add a review-author provenance check before `dossier-step-close`: selected artifacts must be produced by the reviewer thread, not only carry reviewer metadata.
2. Add a mandatory "stateful side-effect negative matrix" before implementation review for support/release/operator flows.
3. Make managed implementation verification require explicit root gate and smoke evidence whenever protected operator routes or side-effect paths change.
4. Add a terminal-state-plus-new-evidence regression checklist for any incident lifecycle work.
5. Improve environment diagnostics for package-manager failures: report install state, PATH state, and sandbox/permission state separately.
