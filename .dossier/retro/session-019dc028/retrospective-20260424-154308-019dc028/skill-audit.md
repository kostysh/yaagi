# Skill Audit: CF-025 / F-0026 Session

Status: final, agent-validated with stated data limits

## Scope

Source: `<session-trace:019dc028>` through line `8851`, plus four manually included F-0026 stage logs. The generated scan found 11 operationally referenced skills. Obvious false positives from substring matching, such as `doc`, were not treated as material skill usage.

## Summary

The skill set helped finish the feature correctly. The most valuable skills were `unified-dossier-engineer`, `code-reviewer`, `spec-conformance-reviewer`, `security-reviewer`, `typescript-test-engineer`, `implementation-discipline` and `git-engineer`.

The main skill/process gap was not missing guidance for ordinary TypeScript work. It was missing a compact, mandatory checklist for high-risk idempotent side effects before implementation began.

## Findings By Skill

### unified-dossier-engineer

Helped:

- Enforced canonical stage flow, external review, verification artifacts, review freshness and post-close hygiene.
- Prevented false closure when attention/source-review/hygiene state was not clean.
- Made final closure auditable through `.dossier/steps/F-0026/implementation.json`.

Hindered:

- The operational distinction between "review result exists" and "reviewer-owned durable artifact exists on the current commit" was not obvious enough during execution.
- Stage logs retained PASS review events but not the failed audit findings that drove rerounds.

Suggested fixes:

- Add a closure checklist: material commit, reviewer-owned artifact write, freshness check, step close, post-close hygiene.
- Add `failed_review_events` or required FAIL artifact recording for mutating stages.

### implementation-discipline

Helped:

- Kept the work grounded in local patterns and verification.
- Encouraged focused fixes instead of unrelated refactors.

Hindered:

- It did not force early adversarial testing for protected side effects.
- It did not make state-machine transition tables mandatory for DB plus in-memory fixture parity.

Suggested fixes:

- Add a "side-effecting workflow" appendix: durable reservation, terminal CAS, replay conflict, stale-running recovery, fixture parity, and strict caller input.

### spec-conformance-reviewer

Helped:

- Caught requirement-level gaps around rollback reliability and live deploy replay.
- Final PASS gave useful acceptance coverage confidence.

Hindered:

- Early PASS rounds were later made stale by code and commit-boundary changes.

Suggested fixes:

- For implementation reviews, require a "known previous blockers" section and explicit freshness commit in the review prompt and artifact.

### code-reviewer

Helped:

- Caught the terminal deploy overwrite and CLI unknown flag behavior.
- Review style was concrete: file, line, impact, suggested fix.

Hindered:

- Findings arrived after large implementation had already been integrated, increasing rerun cost.

Suggested fixes:

- Use a code-reviewer agent earlier for state-machine/DB/fixture parity before running broad final gates.

### security-reviewer

Helped:

- Correctly focused on replayable rollback side effects and protected release-control permissions.
- Later PASS confirmed `release_control` RBAC, strict schemas, static `execFile` command boundaries and host/container executor separation.

Hindered:

- The first security concern overlapped with spec/code idempotency, creating review duplication. The duplication was useful but should have been coordinated as one risk family.

Suggested fixes:

- Add shared risk-family labels across spec/code/security reviews: `rollback-replay`, `terminal-state`, `caller-controlled-input`, `host-executor`.

### typescript-engineer and typescript-test-engineer

Helped:

- Type and test gates were strong; final full `pnpm test` and smoke passed.
- Regression tests were added for the discovered failure modes.

Hindered:

- Tests were too reactive. The most important state-machine tests came after external FAIL findings.

Suggested fixes:

- For features touching DB and side effects, start with a minimal test matrix before service code: duplicate request, concurrent request, persistence throw, terminal replay and unknown CLI flags.

### git-engineer

Helped:

- Final commits were cleanly separated: material implementation in `a3f5ce9`, dossier closure in `c9fc2a0`.

Hindered:

- Review artifacts were refreshed multiple times because commit and review boundaries were not frozen early enough.

Suggested fixes:

- For dossier closure, define a hard "material commit boundary" before final external review artifacts are requested.

## Cross-Skill Recommendation

Create one reusable "protected side-effect feature" protocol shared by `implementation-discipline`, `typescript-test-engineer`, `code-reviewer`, `security-reviewer` and `spec-conformance-reviewer`. It should require:

- server-side idempotency keys;
- durable reservation before side effects;
- strict input schemas and CLI allowlists;
- DB uniqueness for side-effect scope;
- terminal status CAS;
- explicit behavior for live `running` replay;
- tests for persistence failure before and after side effects.
