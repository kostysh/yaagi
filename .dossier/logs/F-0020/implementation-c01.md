---
feature_id: F-0020
backlog_item_key: CF-023
stage: implementation
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-16T22:43:42+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0008-baseline-model-router-and-organ-profiles.md
  - docs/features/F-0014-expanded-model-ecology-and-registry-health.md
  - docs/backlog/local-vllm-model-shortlist-2026-03-24.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - multi_slice_implementation
  - source_and_test_changes
  - runtime_contract_changes
planned_slices:
  - SL-F0020-01
  - SL-F0020-02
  - SL-F0020-03
  - SL-F0020-04
slice_status:
  SL-F0020-01: in_progress
  SL-F0020-02: not_started
  SL-F0020-03: not_started
  SL-F0020-04: not_started
current_checkpoint: checkpoint_only
completion_decision: checkpoint_progress_only
canonical_for_commit: true
generated_after_commit: false
freshness_basis: current_worktree_after_checkpoint_verification
operator_command_refs:
  - cmd-001: "Комить и приступай к имплементации"
---

# Журнал implementation: F-0020 c01

## Scope

Начинаю implementation для `F-0020` с первого допустимого checkpoint после `SL-F0020-01`, не притворяясь полной доставкой real-serving seam.

## Inputs actually used

- Repo overlays требуют canonical `pnpm format -> pnpm typecheck -> pnpm lint` для changed code и русский язык для `.dossier/logs/`.
- `F-0020` стартует из состояния `planned`; `plan-slice` уже зафиксировал four-slice implementation map и allowed stop points.
- Current codebase still keeps `vllm-fast` as a stub-capable slot; baseline profiles seed `baseModel`, but artifact identity and closed candidate set are not yet canonical runtime truth.

## Checkpoint intent

- Цель этого checkpoint: закрыть `SL-F0020-01` на уровне descriptor/materialization contract и сделать fast candidate identity наблюдаемой в runtime/test surfaces.
- В этот проход не обещаю полную real-serving activation: boot-critical promotion, probe-backed readiness и workshop handoff остаются в следующих slices.
- Если первый checkpoint окажется шире ожидаемого, приоритет остаётся за сохранением allowed stop point вместо half-finished runtime promotion.

## Planned implementation focus

- Завести один canonical manifest для closed fast candidate set в `seed/models/base/`.
- Добавить runtime loader/validator для этого manifest-а и сделать его source of truth для `vllm-fast` artifact identity.
- Протянуть manifest-derived fields в baseline profile seeding и bounded operator projection.
- Добрать tests на descriptor/materialization contract без преждевременной смены boot-critical semantics.

## Выполненный checkpoint

- Добавлен tracked bootstrap descriptor `seed/models/base/vllm-fast-manifest.json` для closed fast candidate set (`Gemma 4 E4B` preferred, `Phi-4-mini` fallback, `Qwen3-8B` comparator).
- Добавлен runtime loader/validator `apps/core/src/platform/vllm-fast-manifest.ts`, который:
  - валидирует closed candidate set и scorecard weights;
  - запрещает runtime path escape за пределы writable `models` root;
  - публикует canonical descriptor URI и resolved runtime artifact roots.
- `createPhase0RuntimeLifecycle()` теперь seed-ит baseline profiles через manifest-derived contract, а не через неявный placeholder-only `model-fast`.
- `/models` operator projection теперь показывает `artifactUri` для baseline profiles; container smoke и runtime tests синхронизированы с новым contract.
- Временные workspace/test fixtures обновлены так, чтобы descriptor path существовал на canonical seed boundary и не ломал startup/config probes.

## Состояние slices

- `SL-F0020-01`: in progress.
  - Закрыта descriptor/materialization часть slice.
  - Ещё не закрыты candidate qualification evidence, shared corpus/scorecard execution и explicit selected-candidate/no-winner outcome.
- `SL-F0020-02`..`SL-F0020-04`: не начаты.

## Проверки текущего checkpoint

- `node --experimental-strip-types --test apps/core/test/platform/vllm-fast-manifest.test.ts apps/core/test/platform/runtime-seed.test.ts apps/core/test/platform/operator-models.integration.test.ts apps/core/test/runtime/health.integration.test.ts apps/core/test/platform/core-runtime.test.ts apps/core/test/models/optional-organs.integration.test.ts`: pass.
- `node --experimental-strip-types --experimental-test-module-mocks --test apps/core/test/perception/adapter-failure.integration.test.ts apps/core/test/perception/telegram-adapter.integration.test.ts`: pass после исправления helper override order.
- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass.
- `pnpm smoke:cell`: pass.

## Процессные наблюдения

- Небольшой локальный регресс возник в `apps/core/testing/perception-config.ts`: первый вариант helper-а сломал override precedence и уронил perception tests. Исправлено в этом же checkpoint до commit.
- Implementation step остаётся открытым: backlog actualization, review artifact, verify artifact и step-close для `implementation` пока не выполнялись, потому что полный slice `SL-F0020-01` ещё не завершён.
