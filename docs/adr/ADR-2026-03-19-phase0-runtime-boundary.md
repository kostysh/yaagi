# ADR-2026-03-19 Phase-0 Runtime Boundary

- Status: Superseded by [ADR-2026-03-25 AI SDK Runtime Substrate](./ADR-2026-03-25-ai-sdk-runtime-substrate.md)
- Date: 2026-03-19
- Related: [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md), [ADR-2026-03-25 AI SDK Runtime Substrate](./ADR-2026-03-25-ai-sdk-runtime-substrate.md)

## Context

На момент принятия этого ADR архитектура требовала `TypeScript + Mastra` для identity-bearing runtime, и ранняя реализация легко соблазняла сделать локальный shim или отложить framework "на потом", пока не появится полный API surface.

Первые implementation cycles показали, что это приводит к drift:

- runtime оказывается "похожим" на целевой, но не каноническим;
- последующие фичи не понимают, на что реально опираться: на shim boundary или на framework runtime;
- появляется риск повторного переписывания entrypoint и server layer уже на следующем этапе.

## Decision

Историческое решение этого ADR было таким:

- `TypeScript`;
- `Mastra` как runtime substrate;
- `Hono` как минимальный HTTP boundary.

При этом публичная surface phase 0 намеренно ограничивается `GET /health`.

С 2026-03-25 это решение больше не является каноническим. Его заменяет [ADR-2026-03-25 AI SDK Runtime Substrate](./ADR-2026-03-25-ai-sdk-runtime-substrate.md), который:

- переносит canonical reasoning/model-integration substrate на `AI SDK`;
- сохраняет `Hono` как HTTP boundary;
- оставляет phase-0 public surface health-only.

## Consequences

- Этот ADR сохраняется как историческое объяснение, почему ранняя phase-0 boundary вообще была формализована отдельно.
- Для текущих решений authoritative является только [ADR-2026-03-25 AI SDK Runtime Substrate](./ADR-2026-03-25-ai-sdk-runtime-substrate.md).
- Любые новые feature seams должны опираться на `AI SDK + Hono`, а не на `Mastra + Hono`.
