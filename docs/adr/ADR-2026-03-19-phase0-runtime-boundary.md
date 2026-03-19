# ADR-2026-03-19 Phase-0 Runtime Boundary

- Status: Accepted
- Date: 2026-03-19
- Related: [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md)

## Context

Архитектура требует `TypeScript + Mastra` для identity-bearing runtime, но ранняя реализация легко соблазняет сделать локальный shim или отложить Mastra "на потом", пока не появится полный API surface.

Первые implementation cycles показали, что это приводит к drift:

- runtime оказывается "похожим" на целевой, но не каноническим;
- последующие фичи не понимают, на что реально опираться: на shim boundary или на Mastra;
- появляется риск повторного переписывания entrypoint и server layer уже на следующем этапе.

## Decision

`polyphony-core` обязан использовать канонический runtime stack уже с phase 0:

- `TypeScript`;
- `Mastra` как runtime substrate;
- `Hono` как минимальный HTTP boundary.

При этом публичная surface phase 0 намеренно ограничивается `GET /health`.

Это значит:

- Mastra присутствует с самого начала и может быть точкой расширения для следующих feature seams;
- operator/control API не открывается преждевременно и остаётся отдельным backlog seam;
- временные local shims не считаются допустимой заменой Mastra runtime.

## Consequences

- Следующие runtime и cognition features могут безопасно считать Mastra уже delivered platform substrate.
- API expansion (`/state`, `/timeline`, `/models`, control routes) должна идти как отдельная feature поверх этого runtime, а не через переписывание основы.
- Любое отклонение от `Mastra + Hono` для identity-bearing runtime требует отдельного ADR.
