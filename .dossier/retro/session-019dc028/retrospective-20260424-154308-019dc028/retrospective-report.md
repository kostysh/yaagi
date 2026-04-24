# Ретроспектива сессии CF-025 / F-0026

Status: final, agent-validated with stated data limits

## Scope

Анализируемая фаза: работа по `CF-025 / F-0026` от выбора задачи на intake до подтверждения, что implementation закрыт канонически.

Граница trace: `<session-trace:019dc028>`, строки `1..8851`, `2026-04-24T15:43:08Z` .. `2026-04-24T23:14:15Z`. События после запроса на ретроспективу исключены.

Вручную включены только четыре F-0026 stage log, потому что автоматический scan видел их как `referenced_only`: `<project-root>/.dossier/logs/feature-intake/F-0026--fc-F-0026-mod32etm.md`, `<project-root>/.dossier/logs/spec-compact/F-0026--fc-F-0026-mod32etm--spec-compact-ba4e977d.md`, `<project-root>/.dossier/logs/plan-slice/F-0026--fc-F-0026-mod32etm--plan-slice-3d2024d0.md`, `<project-root>/.dossier/logs/implementation/F-0026--fc-F-0026-mod32etm--implementation-71691571.md`.

Ограничения данных: часть ранней истории была сжата compaction; stage logs содержат финальные PASS review events, но не содержат durable FAIL review events. Поэтому реальные блокеры восстановлены из trace/subagent messages и из финального ответа, а не только из stage log frontmatter.

## Executive Summary

Итог работы корректный: `F-0026` закрыта, `attention` пустой, post-close hygiene чистый, финальные коммиты `a3f5ce9` и `c9fc2a0`.

Сессия была длинной не из-за одного большого куска кода, а из-за поздно обнаруженных инвариантов вокруг идемпотентности, rollback side effects и terminal states. Эти ошибки были реальными и должны были блокировать закрытие.

Главный процессный сбой: implementation дошел до "готово к закрытию" раньше, чем были системно проверены самые опасные классы отказов: повтор запроса, частичный rollback, конфликт записи, перезапись terminal state и неизвестные CLI flags.

Внешние аудиты сработали хорошо. Они поймали ошибки, которые обычные happy-path тесты и ранняя самопроверка не поймали. Но аудиты сработали поздно и привели к нескольким rerounds.

Закрытие dossier было строгим и полезным, но трение было высоким: review artifacts пришлось переоформлять на свежем commit boundary и с правильной provenance, затем post-close hygiene нашел source-review по README.

## Evidence Inventory

- Session trace: `<session-trace:019dc028>`, `eventCount=8851`, `durationMinutes=451.12`, `abortedTurns=0`.
- Stage logs: 4 F-0026 logs, stages `feature-intake`, `spec-compact`, `plan-slice`, `implementation`.
- Stage metrics: `reviewRoundsTotal=16`, `processMissesTotal=1`, `lateLogStartCount=0`.
- Implementation step artifact: `<project-root>/.dossier/steps/F-0026/implementation.json`, `process_complete=true`.
- Verification artifact: `<project-root>/.dossier/verification/F-0026/implementation-a3f5ce9c8501.json`, `status=pass`.
- Post-close hygiene: `<project-root>/.dossier/verification/F-0026/implementation-post-close-backlog-hygiene.json`.
- Final external reviews: `implementation--spec-conformance-reviewer--r04--pass--a3f5ce9bad4d.json`, `implementation--code-reviewer--r04--pass--a3f5ce9bad4d.json`, `implementation--security-reviewer--r03--pass--a3f5ce9bad4d.json`.
- Commits: `a3f5ce9 feat: add release automation and rollback orchestration`, `c9fc2a0 chore: close F-0026 implementation dossier`.

## Timeline

- `15:43Z`: backlog status confirmed; `CF-025` selected as next intake.
- `15:46Z`: `feature-intake` creates `F-0026`; stage immediately `ready_for_close`.
- `16:09Z`: feature-intake closes after external spec review and verification.
- `16:32Z`: `spec-compact` starts.
- `16:42Z`: spec is ready for close after Plan mode decisions are incorporated.
- `16:52Z`: spec closes; one process miss recorded: coverage gate had to be realigned to deferred.
- `17:05Z`: `plan-slice` starts.
- `17:22Z`: plan-slice closes after external review; `attention` cleared.
- `17:26Z`: implementation starts.
- `21:05Z`: first implementation `ready_for_close`, before all hidden failure modes were resolved.
- `20:43Z` .. `22:49Z`: external audits report blocking issues across rollback replay, rollback persistence, terminal deploy CAS, CLI flags and live running deploy replay.
- `22:44Z`: full `pnpm smoke:cell` passes, 21 tests.
- `23:06Z`: final material commit `a3f5ce9`; final verification artifact passes.
- `23:07Z`: `dossier-step-close` writes implementation closure artifact.
- `23:07Z`: first post-close hygiene is blocked by README source review.
- `23:08Z`: README source-review is acked, post-close hygiene passes, closure artifacts committed as `c9fc2a0`.
- `23:10Z`: independent verification confirms `attention=[]`, no gaps, no source-review debt, clean worktree.

## Incident Register

### I1. Rollback idempotency and side-effect reservation were under-specified in the first implementation

Severity: high. Category: implementation defect plus planning weakness.

Evidence: trace FAIL at `20:43Z`: repeated Operator API rollback could replay as a new rollback; rollback side effect could run before durable rollback execution reservation.

Symptom: retry or race could produce repeated rollback side effects, which is unacceptable for a protected release-control path.

Probable root cause: plan-slice named rollback records and execution rows, but did not force a "durable reservation before side effect" checklist.

Recovery: rollback execution identity and persistence were tightened, caller-controlled rollback ids removed/rejected, and DB uniqueness was added.

Prevention: every feature that controls external side effects must start implementation with an idempotency matrix: operation id, reservation point, replay response, unique DB scope, side effect boundary, terminalization rule.

### I2. Rollback failure persistence could leave deploy or rollback rows running

Severity: high. Category: implementation defect.

Evidence: trace FAILs at `22:45Z`: `recordRollback()` store errors could leave deploy `running`; `completeRollbackExecution()` conflict could leave rollback execution `running`.

Symptom: failed smoke could produce neither rollback evidence nor terminal deploy state. A rollback execution conflict could leave a durable `running` row after a terminal deploy outcome.

Probable root cause: failure paths around persistence were treated as exceptional rather than first-class release outcomes.

Recovery: store errors and completion conflicts now fail closed with terminal evidence where possible; regression tests cover these paths.

Prevention: write "post-start failure" tests before wiring Operator API. Any path after `startDeployAttempt()` must converge to a terminal deploy state or an explicit in-progress conflict.

### I3. Deploy terminal state was not protected by compare-and-set

Severity: high. Category: implementation defect.

Evidence: trace FAIL at `22:45Z`: DB `completeDeployAttempt` updated by `deploy_attempt_id` only; fixture mirrored the same risk.

Symptom: a second replay/race path could overwrite `failed`, `smoke_failed`, `rolled_back` or `succeeded`.

Probable root cause: rollback completion had a `running` guard, but deploy completion did not get the same invariant.

Recovery: DB and in-memory fixture completion became CAS from `running`; conflicting terminal overwrite now returns conflict/null.

Prevention: for every status machine, define allowed transitions in one test table and prove both DB and fixture follow it.

### I4. CLI accepted unknown or stale flags silently

Severity: medium. Category: interface contract defect.

Evidence: trace FAIL at `22:45Z`: `scripts/release-cell.ts` accepted arbitrary flags, including stale `--trigger` and `--rollback-execution-id`, without failing before side effects.

Symptom: operator typo or old automation could execute deploy/rollback with defaults while appearing to request a different control path.

Probable root cause: parser convenience was used without per-action allowlists.

Recovery: CLI now rejects unknown flags per action before service invocation; tests cover stale flags.

Prevention: protected CLIs should default to strict option schemas, same as API contracts.

### I5. Live running deploy replay could corrupt a valid in-flight attempt

Severity: high. Category: concurrency defect.

Evidence: trace FAIL at `22:49Z`: a second same-id `runDeployAttempt()` could see `running` with no evidence and mark it `failed/post_start_evidence_missing`.

Symptom: first caller could still succeed, but DB would already say failed.

Probable root cause: crash recovery and concurrent in-flight replay were collapsed into the same branch without stale lease or age signal.

Recovery: normal replay of a live running attempt now returns conflict and does not mutate the in-flight deploy.

Prevention: never repair `running` state on ordinary replay unless there is an explicit stale criterion or recovery mode.

### I6. Review artifact provenance caused closure churn

Severity: medium. Category: process and tool friction.

Evidence: closure had to be retried because artifacts written from the main thread were not accepted as independent external review evidence.

Symptom: PASS reviews existed, but `dossier-step-close` still could not truthfully close until reviewer agents recorded fresh durable artifacts at the correct commit boundary.

Probable root cause: the workflow requires independence and freshness, but the operational rule "reviewer-owned artifact write" was not treated as a first-class checklist item before closure.

Recovery: Darwin, Turing and Dewey recorded fresh r04/r04/r03 artifacts on `a3f5ce9`.

Prevention: after material commit, freeze code, ask reviewers to write artifacts themselves, then run `dossier-step-close`. Do not have the main thread synthesize review artifacts.

### I7. Post-close hygiene found a README source-review after closure

Severity: low to medium. Category: closure hygiene.

Evidence: first `post-close-hygiene` at `23:07Z` returned blocked with `sr-5b9f63ff-21ce-440c-a3a3-7416945dde4f` for README.

Symptom: implementation was closed, but backlog hygiene was not clean until source review was acked.

Probable root cause: README changed as runtime notes, and source-refresh was deferred until post-close.

Recovery: source review was acked as no backlog change, then post-close hygiene passed.

Prevention: run source refresh/status/attention before the final closure attempt, not only after it.

### I8. FAIL audit evidence was not durable in stage logs

Severity: medium. Category: logging blind spot.

Evidence: `scan-summary.json` found 4 stage logs and 16 review events, but `reviewFindingsTotal=0`; real FAILs are only in trace/subagent messages.

Symptom: a future reader of `.dossier/logs/implementation/...` sees many PASS rounds but not the blockers that caused the long session.

Probable root cause: `review_events` records durable review artifacts, and only PASS artifacts were persisted.

Recovery in this retrospective: FAILs were reconstructed from trace.

Prevention: add durable failed-review summary artifacts or stage-log `failed_review_events` with reviewer, timestamp, finding id, severity, and resolution commit.

## Stage Weaknesses

Spec-compact was directionally solid. It captured environment, storage, automatic rollback and CLI/API decisions. The miss was not in broad scope, but in not converting release safety into an explicit concurrency/failure checklist. The recorded process miss around coverage gate was low severity and resolved.

Plan-slice created a useful implementation order, but the handoff did not force the riskiest invariants to be implemented first. Idempotency, terminal-state transitions and durable reservation should have been first-class test groups, not audit-discovered after the service was mostly built.

Implementation was too broad before adversarial tests were complete. The changed surface spanned contracts, DB, migrations, service, Operator API, runtime wiring, CLI, tests and docs. That was necessary for the feature, but it increased the cost of each late-found invariant.

Review was effective. External reviewers caught real, high-value defects. The weakness was timing and artifact handling: review rounds happened after large implementation work and PASS artifacts had to be refreshed several times.

Closure was strict and ultimately reliable. It blocked stale/provenance-invalid review evidence and post-close source-review debt. The cost was high because closure checks were not staged as a preflight checklist before the final close.

## Time Sinks

- Repeated external audit rounds after late implementation changes.
- Re-running full quality gates and `pnpm smoke:cell` after risk fixes.
- Repairing closure artifact freshness and independent provenance.
- Resolving post-close source-review debt.
- Trace and artifact ambiguity caused by compaction and inconsistent session ids across stage logs.

The necessary time was the bug fixing and verification. The avoidable time was retrying closure before the review/provenance/hygiene conditions were stable.

## Controls

Worked well:

- Independent external audits found real correctness and security-relevant release-control bugs.
- `dossier-step-close` enforced review freshness and independent audit bundle.
- `post-close-hygiene` caught source-review debt after closure.
- Full gates provided final confidence: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke:cell`.
- Attention gate prevented continuing with unresolved backlog attention.

Worked too late:

- Failure-mode tests were mostly added after audit findings.
- Post-close hygiene was only run after closure.
- Review artifact provenance was discovered during closure rather than prepared before it.

Noisy or weak:

- `index-refresh` produced 86 repo-wide warnings, most unrelated to `F-0026`.
- Stage logs had strong frontmatter but weak implementation prose and no FAIL review history.

## Recommendations

1. Add a release-control implementation checklist before coding:
   `reservation_before_side_effect`, `terminal_cas`, `running_replay_behavior`, `unknown_flag_rejection`, `db_unique_scope`, `post_start_failure_terminalization`, `container_host_executor_boundary`.

2. For side-effecting features, write adversarial tests first:
   duplicate request, concurrent request, store get failure, store write failure, completion conflict, executor throw, evidence write conflict, terminal replay.

3. Freeze code before final reviews:
   material commit first, then reviewer-owned durable artifacts, then `dossier-verify`, then `dossier-step-close`.

4. Run `refresh/status/attention/post-close-hygiene` as a pre-close rehearsal before the final close, then again after close.

5. Persist failed review evidence:
   either durable FAIL artifacts or a `failed_review_events` array in stage logs. PASS-only logs are not enough for retrospectives.

6. Tighten operator communication during long closure:
   after each blocker, state whether it is a code blocker, review blocker, closure blocker or hygiene blocker, and name the next gate.

7. Use independent agents earlier for bounded risk probes:
   one spec-conformance probe for failure modes, one code-review probe for state-machine transitions, one security probe for protected side effects.
