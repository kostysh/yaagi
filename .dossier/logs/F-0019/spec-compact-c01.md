---
feature_id: F-0019
backlog_item_key: CF-018
stage: spec-compact
cycle_id: c01
session_id: 019d919b-5b39-7992-b92a-a4b3c75fdfc8
start_ts: 2026-04-15T17:02:21+02:00
ready_for_review_ts: 2026-04-15T17:21:26+02:00
final_pass_ts: 2026-04-15T17:26:45+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/polyphony_concept.md
  - docs/backlog/feature-candidates.md
  - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - docs/features/F-0011-narrative-and-memetic-reasoning-loop.md
  - docs/features/F-0012-homeostat-and-operational-guardrails.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-23-no-technical-debt-rule.md
  - docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md
repo_overlays:
  - AGENTS.md
  - docs/AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - open_question_resolution
  - non_trivial_boundary_shaping
backlog_actualized: true
backlog_artifact_integrity: clean
ac_changed_total: 18
open_questions_resolved_total: 3
open_questions_reclassified_total: 0
normative_now_decisions_total: 3
implementation_freedom_decisions_total: 2
temporary_assumptions_total: 1
operator_command_refs:
  - cmd-001: "Делай комит и затем приступай к spec-compact для F-0019"
process_miss_refs: []
review_events:
  - agent_id: 019d91bb-f71f-7f41-8577-352a822c3a03
    role: independent
    model: gpt-5.4-mini
    requested_ts: 2026-04-15T17:21:40+02:00
    verdict_ts: 2026-04-15T17:26:45+02:00
    verdict: pass
    rerun_reason: review_findings
    scope: F-0019 spec-compact, backlog actualization, verification artifact and stage log
verification_artifact: .dossier/verification/F-0019/spec-compact-a135569cccd2.json
review_artifact: .dossier/reviews/F-0019/spec-compact-a135569cccd2.json
step_artifact: .dossier/steps/F-0019/spec-compact.json
review_requested_ts: 2026-04-15T17:21:40+02:00
first_review_agent_started_ts: 2026-04-15T17:21:40+02:00
review_models:
  - gpt-5.4-mini
review_retry_count: 1
review_wait_minutes: 5
transport_failures_total: 0
rerun_reasons:
  - review_findings
operator_review_interventions_total: 0
---

# spec-compact c01

## Scope

`spec-compact` для `F-0019`, созданного из backlog item `CF-018`. Цель цикла: превратить intake-boundary в shaped feature spec, закрыть intake open questions и actualize backlog state до `specified`.

## Inputs actually used

- Backlog truth: `CF-018` = `defined`, gaps/todo отсутствуют, ready for next step.
- Architecture: identity-bearing write authority matrix, retention/compaction policy, event envelope, graceful shutdown, Homeostat `rollback_frequency`, architecture coverage map.
- Adjacent dossiers: `F-0011` оставляет durable promotion/compaction за `CF-018`; `F-0012` требует lifecycle evidence для `rollback_frequency`; `F-0016`/`F-0017` фиксируют governor/body rollback evidence boundaries.
- Repo overlays: документация в `docs/` пишется на русском; automation запускается из installed skill runtimes; Plan mode gate обязателен перед `spec-compact`.

## Decisions / reclassifications

### Spec gap decisions

- `OQ-F0019-01` resolved as normative now: first-phase consolidation transition classes are an explicit allowlist.
- `OQ-F0019-02` resolved as normative now: lifecycle event envelope has mandatory identity, source, evidence, idempotency and schema-version fields.
- `OQ-F0019-03` resolved as normative now: `F-0019` owns lifecycle facts, `CF-015` owns reporting materialization, `CF-025` owns release/deploy rollback orchestration.

### Implementation freedom decisions

- Physical table names remain forecast-level design until implementation, as long as the source surfaces and invariants are preserved.
- Consolidation may run as a job family or internal service path on the existing runtime substrate, provided it does not introduce a new service/container topology.

### Temporary assumptions

- Existing history backfill can be non-destructive or evidence-only; if implementation discovers that destructive compaction is required for first delivery, the rollout note must be revised before implementation closure.

## Operator feedback

- `cmd-001`: оператор попросил после intake-коммита приступить к `spec-compact`.
- Plan mode assessment surfaced: Plan mode не требуется, потому что canonical ownership boundary уже задан архитектурой и соседними dossiers; новые пользовательские развилки не выявлены.

## Review events

- Independent reviewer `Boyle` returned PASS with one should-fix: add missing adjacency links to `F-0015` and `F-0017`.
- Should-fix was resolved by adding both dossier links to `F-0019` metadata; `dossier-verify` was rerun and passed.
- Delta review confirmed no new must-fix or should-fix and marked the PASS fresh for the current tree.

## Backlog actualization

- Выполнено через `backlog-engineer patch-item`: `CF-018.delivery_state` изменён с `defined` на `specified`.
- Patch draft: `docs/backlog/patches/2026-04-15-025-f-0019-spec-compact-actualization.template.json`.
- Canonical patch: `docs/backlog/patches/1664c7c62a83--2026-04-15-025-f-0019-spec-compact-actualization.template.json`.
- Follow-up attention создан runtime-ом для downstream items `CF-014`, `CF-015`, `CF-019`, `CF-025`, `CF-026`, `CF-027` из-за dependency change на `CF-018`.

## Process misses

- none

## Close-out

- Verification artifact: `.dossier/verification/F-0019/spec-compact-a135569cccd2.json`.
- Review artifact: `.dossier/reviews/F-0019/spec-compact-a135569cccd2.json`.
- Step artifact: `.dossier/steps/F-0019/spec-compact.json`, `process_complete=yes`.
