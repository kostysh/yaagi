```yaml
feature_id: F-0020
backlog_item_key: CF-023
command: feature-intake
cycle_id: c01
late_start: false
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-16T20:41:14+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0008-baseline-model-router-and-organ-profiles.md
  - docs/features/F-0014-expanded-model-ecology-and-registry-health.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
  - docs/backlog/feature-candidates.md
  - docs/backlog/local-vllm-model-shortlist-2026-03-24.md
  - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - operator_reround_after_dossier_creation
index_refresh_ts: 2026-04-16T20:45:43+02:00
index_refresh_status: success
backlog_actualized: false
handoff_block_written: true
dossier_path: docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md
```

# Журнал intake: F-0020 c01

## Scope

Intake для selected backlog work `CF-023` в новый dossier `F-0020`.
Цель текущего цикла: создать canonical feature dossier, зафиксировать backlog handoff и grounded intake context для real `vLLM` serving seam без перехода в `spec-compact`.

## Inputs actually used

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/features/F-0002-canonical-monorepo-deployment-cell.md`
- `docs/features/F-0008-baseline-model-router-and-organ-profiles.md`
- `docs/features/F-0014-expanded-model-ecology-and-registry-health.md`
- `docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
- canonical `backlog-engineer` read surface: `status`, `queue`, `items --item-keys "CF-023,CF-013,CF-024"`
- historical backlog/planning inputs under `docs/backlog/` for seam context only

## Backlog handoff decisions

- Next free dossier id selected as `F-0020`.
- Intake preserved backlog item key `CF-023` and intake-time backlog delivery state `planned` exactly as returned by canonical `backlog-engineer`.
- Intake preserved backlog dependencies `CF-020`, `CF-006`, `CF-010` exactly as returned by canonical `backlog-engineer`.
- Historical backlog planning docs were retained as supporting traceability, but they were explicitly demoted below canonical backlog-engineer truth after review feedback.

## Intake findings

- The seam needs a dedicated owner because `F-0002` intentionally left `vllm-fast` stub-capable and `F-0014` only delivered richer registry/health surfaces, not real serving.
- Fast-first shaping is mandatory: no later working-system claim may treat stub/emulator paths as closure for this seam.
- The intake should stay at `status: proposed`; normative ACs, NFRs and slicing remain deferred to `spec-compact` / `plan-slice`.

## Operator feedback

- During intake, the operator explicitly flagged discomfort with backlog `delivery_state=planned` before intake and instructed not to mutate backlog status during this command.
- The operator later explicitly required an external independent audit after intake.
- External independent review then forced one corrective reround in the same intake cycle:
  - backlog source traceability paths in the handoff block were fixed to resolve from `docs/features/`;
  - legacy backlog planning variants were explicitly reconciled against canonical `backlog-engineer` truth inside the dossier.

## Index refresh

- `feature-intake` completed with `partial_success: false`.
- `docs/ssot/index.md` was refreshed successfully and now contains exactly one row for `F-0020`.

## Backlog actualization

- No backlog actualization was applied in this intake cycle.
- Intake did not establish a new canonical dependency set or lifecycle state beyond current `backlog-engineer` truth.
- The command intentionally preserved backlog `delivery_state=planned` because the operator explicitly asked not to change backlog status in this phase.

## Process misses

- None so far.
- The intake log became required only after external review feedback forced a dossier correction in the same intake cycle; `late_start` remains `false` because this trigger was not known before dossier creation.

## Close-out

- Current state:
  - dossier created: yes
  - backlog handoff block written: yes
  - index refresh settled: yes
  - backlog actualization required: no
  - independent review freshness: fresh PASS
  - review artifact persisted: `.dossier/reviews/F-0020/feature-intake-16e902f37095.json`
  - step-close artifact persisted: `.dossier/steps/F-0020/feature-intake.json`
- Process-complete: yes
- Next step: `spec-compact`
