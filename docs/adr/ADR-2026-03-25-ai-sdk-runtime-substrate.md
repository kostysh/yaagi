# ADR-2026-03-25 AI SDK Runtime Substrate

- Status: Accepted
- Date: 2026-03-25
- Supersedes: [ADR-2026-03-19 Phase-0 Runtime Boundary](./ADR-2026-03-19-phase0-runtime-boundary.md)
- Related: [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [F-0006](../features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md), [F-0009](../features/F-0009-context-builder-and-structured-decision-harness.md), [system.md](../architecture/system.md)

## Context

Исходная архитектурная ставка на `Mastra` предполагала, что фреймворк будет использоваться не только для bounded reasoning, но и как значимый источник готовых runtime capabilities: memory layers, workspace/skills packaging, server API и workflow substrate.

После первых delivered seams этот тезис перестал соответствовать реальному устройству системы:

- identity-bearing memory уже закреплена за собственным PostgreSQL state kernel и не может быть передана framework memory;
- HTTP ingress и operator boundary реализуются через `Hono` и repo-owned routes, а не через framework-owned server surface;
- scheduler/tick lifecycle, executive boundary, governance и action discipline уже оформлены как custom runtime contracts;
- skills/workspace lifecycle остаётся backlog-owned seam и не materialize-ился как runtime dependency на framework workspace layer;
- фактическое использование `Mastra` сузилось до одного bounded decision harness внутри `core`.

При таком профиле использования `Mastra` перестаёт быть стратегически необходимым как canonical runtime substrate. Системе нужен более тонкий и replaceable слой model/provider integration, не навязывающий свою memory/workspace/workflow ontology поверх уже принятых архитектурных invariants.

## Decision

Канонический reasoning/model-integration substrate репозитория меняется с `Mastra` на `AI SDK`.

Новый repo-level contract фиксируется так:

- `ai` является canonical core package для structured generation, validated model output, streaming helpers и bounded tool-loop primitives;
- `@ai-sdk/openai-compatible` является canonical provider bridge для локальных OpenAI-compatible model services (`vllm-fast` и последующих local organs);
- `Hono` остаётся единственным canonical HTTP boundary;
- `Polyphony Runtime` сохраняет ownership над identity continuity, memory kernel, tick/workflow orchestration, executive boundary, skills lifecycle и governance;
- phase-0 public surface по-прежнему намеренно ограничивается `GET /health`, а richer operator/control API остаётся отдельным seam.

## Consequences

- `F-0002`, `F-0006` и `F-0009` должны быть realigned и вернуться в незавершённое состояние до тех пор, пока платформа, dependency baseline и cognition harness не будут фактически переписаны с `Mastra` на `AI SDK`.
- `F-0003`, `F-0004` и `F-0008` должны быть архитектурно перепривязаны к framework-neutral или AI SDK-compatible wording, не передавая свои owner boundaries в framework abstractions.
- Backlog candidates, которые предполагали `Mastra Server`, `Mastra Decision Agent` или `Mastra Workspace Skills`, должны быть переписаны под `Hono` + `AI SDK` + repo-owned skills/runtime seams.
- После migration completion `@mastra/core` перестаёт быть частью canonical direct dependency set для `apps/core`; dependency baseline должен быть пересобран вокруг `ai` и `@ai-sdk/openai-compatible`.
- Любая попытка вернуть repo к framework-owned memory/workspace/workflow substrate теперь требует нового ADR.
