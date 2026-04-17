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
  SL-F0020-01: completed
  SL-F0020-02: completed
  SL-F0020-03: completed
  SL-F0020-04: completed
current_checkpoint: full_scope_closeout
completion_decision: full_scope_delivered
canonical_for_commit: true
generated_after_commit: false
freshness_basis: verify_review_step_close_recorded
operator_command_refs:
  - cmd-001: "Комить и приступай к имплементации"
---

# Журнал implementation: F-0020 c01

## Scope

Закрываю полный implementation scope для `F-0020`: канонический Gemma-only baseline уже квалифицирован, `vllm-fast` работает как real-serving dependency, а remaining fail-closed и optional-diagnostics slices доведены до intended closeout tree.

## Inputs actually used

- Repo overlays требуют canonical `pnpm format -> pnpm typecheck -> pnpm lint` для changed code и русский язык для `.dossier/logs/`.
- `F-0020` стартовал из состояния `planned`; `plan-slice` уже зафиксировал four-slice implementation map и allowed stop points.
- В ходе implementation canonical baseline был сужен до одного `google/gemma-4-E4B-it`, а remaining work был сведен к Gemma-only runtime delivery вместо многокандидатной гонки.

## Closeout intent

- Цель текущего closeout tree: довести все четыре slice до delivered state без возврата к fallback/comparator path.
- Implementation считается завершённой только вместе с quality gates, container smoke, external audits, backlog actualization и `dossier-step-close`; до этих артефактов этот log фиксирует intended final tree, а не chat-only claim.

## Planned implementation focus

- Завести один canonical manifest для Gemma-only fast baseline в `seed/models/base/`.
- Свести `vllm-fast` startup к одному ROCm/Gemma-serving path с persistent runtime artifact reuse.
- Довести readiness truth, startup/admission fail-closed behavior и workshop dependency handoff до реального containerized smoke.
- Зафиксировать dialect-level structured-output mitigation как cross-cutting ADR вместо ad hoc contract weakening.

## Выполненная реализация

- Добавлен и затем realigned tracked bootstrap descriptor `seed/models/base/vllm-fast-manifest.json` для Gemma-only canonical fast baseline.
- Добавлен runtime loader/validator `apps/core/src/platform/vllm-fast-manifest.ts`, который:
  - валидирует Gemma-only selection contract и scorecard weights;
  - запрещает runtime path escape за пределы writable `models` root;
  - публикует canonical descriptor URI и resolved runtime artifact roots.
- `createPhase0RuntimeLifecycle()` теперь seed-ит baseline profiles через manifest-derived contract, а не через неявный placeholder-only `model-fast`.
- Read-only `/models` и `GET /health` теперь публикуют probe-backed baseline and serving truth в bounded redacted виде: точная provenance-пара `artifactDescriptorPath/runtimeArtifactRoot` остаётся на owner-only surfaces (`vllm-fast` manifest/monitor state, workshop dependency handoff, verification artifacts) и не утекает как raw path через публичный operator projection.
- Временные workspace/test fixtures обновлены так, чтобы descriptor path существовал на canonical seed boundary и не ломал startup/config probes.
- Реализованы artifact materialization и real-serving startup для `vllm-fast` через `vllm/vllm-openai-rocm:gemma4`, `TRITON_ATTN`, persistent runtime `/models` root и JSON `limitMmPerPrompt`.
- Fast-serving path теперь реиспользует уже materialized Gemma snapshot и compile caches вместо повторной загрузки весов при обычных restart/smoke rerun; suite-scoped smoke reuse-ит warmed `models_state` и не делает второй Hugging Face download для `telegram` family.
- Readiness truth переведён на probe-backed state machine: transport/process liveness больше не публикуют `ready` без реального inference probe на текущем artifact identity.
- Startup и owner-bound admission переведены на fail-closed semantics для promoted fast dependency; `/ingest` и системные tick paths больше не обходят unavailable fast dependency.
- Workshop dependency handoff и operator health/model surfaces ограничены real-serving-backed `service/artifact` truth; `vllm-deep` и `vllm-pool` остаются explicit optional diagnostics с future-promotion guard.
- Для canonical baseline собран qualification bundle с must-pass gates, fixed corpus и recorded scorecard; итоговый result = `qualified` для `google/gemma-4-E4B-it`.
- После перевода fast baseline на `Gemma` обнаружен provider/runtime gap: local `vLLM` structured-output backend отвергал generated JSON Schema ключ `propertyNames`, происходящий из канонического `Zod` контракта через `z.record(...)`.
- В ответ адаптер `phase0-ai` переведён на схему `canonical Zod -> sanitized provider-facing JSON Schema -> canonical Zod revalidation`, чтобы сохранить строгий локальный контракт без подстройки shared `packages/contracts` под ограничения конкретного grammar backend.
- В decision-harness path добавлена дополнительная sanitation against endpoint echo: если модель ошибочно возвращает selected serving endpoint как `action.tool`, решение нормализуется обратно в bounded `none` вместо падения на `unsupported_tool` в executive seam.
- Runtime seed bootstrap больше не считает hidden/unreadable runtime cache trees (`/models/.cache/*`, compiler/triton caches) частью placeholder seed-дерева и не падает на `EACCES` при `core` startup после real `vLLM` boot.
- Cross-cutting ADR [ADR-2026-04-17 Local Structured Output Schema Sanitization](../../../docs/adr/ADR-2026-04-17-local-structured-output-schema-sanitization.md) и supporting shortlist source update уже зарегистрированы как backlog-facing source changes для `CF-023`.

## Состояние slices

- `SL-F0020-01`: completed.
  - Descriptor/materialization contract закрыт.
  - Gemma-only qualification bundle и explicit selected-candidate outcome зафиксированы.
- `SL-F0020-02`: completed.
  - Real `vllm-fast` activation и probe-backed readiness закрыты.
- `SL-F0020-03`: completed.
  - Startup/admission fail-closed promotion и workshop dependency truth закрыты.
- `SL-F0020-04`: completed.
  - Optional deep/pool continuity, future-promotion guard и usage audit закрыты.

## Проверки final tree

- `node --experimental-strip-types --test apps/core/test/platform/vllm-fast-manifest.test.ts apps/core/test/platform/runtime-seed.test.ts apps/core/test/platform/operator-models.integration.test.ts apps/core/test/runtime/health.integration.test.ts apps/core/test/platform/core-runtime.test.ts apps/core/test/models/optional-organs.integration.test.ts`: pass.
- `node --experimental-strip-types --experimental-test-module-mocks --test apps/core/test/perception/adapter-failure.integration.test.ts apps/core/test/perception/telegram-adapter.integration.test.ts`: pass после исправления helper override order.
- `node --experimental-strip-types --experimental-test-module-mocks --test apps/core/test/platform/phase0-ai.integration.test.ts`: pass после введения endpoint-echo sanitation.
- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass.
- `pnpm smoke:cell`: pass после realignment smoke harness на один suite-scoped compose project, один `vllm-fast` container и один shared `models_state` reuse path для Telegram overlay.
- `.dossier/verification/F-0020/vllm-fast-qualification-report.json`: canonical Gemma qualification bundle recorded with `selectionState=qualified`, `passedGates=true`, `structuredPassRate=1`, `qualityPassRate=1`.

## Процессные наблюдения

- Небольшой локальный регресс возник в `apps/core/testing/perception-config.ts`: первый вариант helper-а сломал override precedence и уронил perception tests. Исправлено в этом же checkpoint до commit.
- Новый runtime gap оказался не модельным, а dialect-level: `Gemma` продолжала проходить real-serving boot, но `vLLM` structured outputs требовали schema sanitization на adapter layer. Это изменило implementation path, но не изменило product contract `TickDecisionV1`.
- После перевода `vllm-fast` на реальную `Gemma` выяснилось, что старый `F-0007` smoke design по-прежнему поднимал второй compose project и тем самым готовил второй `vllm-fast`/`Gemma` runtime для Telegram family. Это было ошибкой архитектуры smoke harness, а не product contract `F-0020`.
- Harness realigned в ходе этого же implementation cycle: Telegram smoke теперь идёт как overlay над shared project/runtime, reuse-ит тот же promoted fast dependency и не клонирует `models_state`.
- Live debug snapshot во время проходящего smoke показал `docker stats` порядка `2.414 GiB` для `yaagi-phase0-vllm-fast-1` при примерно `101 GiB` free / `113 GiB` available на хосте. Значит ранее наблюдавшиеся operator-side memory spikes не подтверждаются как обычная container RSS leak в текущем harness; наиболее вероятный remaining источник лежит вне cgroup accounting (`ROCm`/`UMA`/driver-pinned allocations или внешние host processes).
- Следом после этого final tree был закрыт через fresh `dossier-verify`, независимый audit verdict `PASS`, backlog actualization для `CF-023`, `review-artifact` и `dossier-step-close`.
