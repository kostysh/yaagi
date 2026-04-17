# ADR-2026-04-17 Local Structured Output Schema Sanitization

- Status: Accepted
- Date: 2026-04-17
- Related:
  - [F-0009](../features/F-0009-context-builder-and-structured-decision-harness.md)
  - [F-0020](../features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md)
  - [ADR-2026-03-25 AI SDK Runtime Substrate](./ADR-2026-03-25-ai-sdk-runtime-substrate.md)
  - [ADR-2026-03-19 Phase-0 Deployment Cell](./ADR-2026-03-19-phase0-deployment-cell.md)

## Context

После перевода `vllm-fast` на реальный `Gemma 4 E4B` serving path phase-0 runtime начал использовать native structured outputs через `AI SDK` и OpenAI-compatible `vLLM` adapter.

На этой траектории выяснилось, что provider-facing JSON Schema, автоматически получаемая из канонического `Zod` контракта, может содержать ключи, которые текущий `vLLM` structured-output backend не поддерживает. В нашем случае `TickDecisionV1` включает `z.record(...)`, а runtime падал на grammar-инициализации с ошибкой вида `Unimplemented keys: ["propertyNames"]`.

Проблема относится не к продуктовой decision-схеме и не к модели `Gemma`, а к несовпадению между полным JSON Schema dialect, который способен описать `Zod`, и подмножеством схем, которое реально принимает локальный provider/runtime stack.

Если решать это ослаблением общего контракта в `packages/contracts`, мы потеряем строгую локальную валидацию и начнём подстраивать shared domain model под ограничения конкретного serving backend. Это противоречит repo-level substrate contract из `ADR-2026-03-25`.

## Decision

Для repo-owned local OpenAI-compatible runtimes вводится двухслойный contract:

- канонический application/domain contract продолжает жить в `Zod` схемах внутри `packages/contracts`;
- provider-facing structured-output schema генерируется из канонического `Zod` контракта и затем санитизируется до provider-compatible подмножества JSON Schema в adapter layer;
- результат provider generation всегда повторно валидируется против канонического `Zod` контракта до выхода из adapter layer.

Правила санитизации:

- удалять только ключи, которые относятся к provider/backend feature gap, а не к смыслу бизнес-контракта;
- не менять shape shared contract вручную в продуктовых схемах только ради конкретного local runtime;
- текущий denylist для local `vLLM` path включает как минимум `propertyNames` и `patternProperties`;
- расширение denylist допустимо только как adapter-layer change с явной ссылкой на runtime/provider limitation.

Fallback policy:

- если safe schema sanitization уже не покрывает provider gap, следующий шаг это деградация provider mode до более слабого transport contract (`json` / manual parse / repair path) с обязательной локальной `Zod` валидацией;
- недопустимо silently weakening canonical shared contract ради того, чтобы provider accepted schema стала проще.

## Consequences

- `apps/core/src/platform/phase0-ai.ts` и другие repo-owned adapters становятся owner seam для provider-specific schema sanitization.
- `packages/contracts` остаётся source of truth для decision and action shapes; provider schema не считается authoritative контрактом.
- Любой новый local serving backend или grammar engine должен либо принять этот sanitization layer, либо предложить отдельный adapter-specific policy without mutating shared contracts.
- Backlog/source traceability для таких runtime-compatibility решений должна регистрировать не только ADR, но и внешние runtime/provider sources, на которых основан denylist или fallback choice.

## External evidence used

- AI SDK `jsonSchema()` and flexible structured-output schema support: <https://ai-sdk.dev/docs/reference/ai-sdk-core/json-schema>
- AI SDK `Output.object()` accepts custom JSON Schema plus local validation function: <https://ai-sdk.dev/docs/reference/ai-sdk-core/output>
- `vLLM` structured outputs config and backend caveats: <https://docs.vllm.ai/en/latest/api/vllm/config/structured_outputs/>
- `vLLM` guidance backend explicitly checks unsupported JSON Schema features and documents backend-specific limits: <https://docs.vllm.ai/en/latest/api/vllm/v1/structured_output/backend_guidance/>
- `Zod` native JSON Schema conversion and `override` hook for adapter-layer transformations: <https://zod.dev/json-schema?id=configuration>
