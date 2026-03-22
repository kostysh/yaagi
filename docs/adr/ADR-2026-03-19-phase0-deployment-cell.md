# ADR-2026-03-19 Phase-0 Deployment Cell

- Status: Accepted
- Date: 2026-03-19
- Related: [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md)

## Context

Архитектура давно описывает deployment cell, но до первых implementation cycles не было repo-level решения о том, что именно считается обязательной phase-0 поставкой и какой container posture является baseline, а не пожеланием.

Без этого:

- контейнеризация откладывается слишком поздно;
- сервисные имена и network contract остаются неявными;
- boot и runtime фичи начинают опираться на локальные in-memory assumptions вместо реальной среды запуска.

## Decision

Канонический phase-0 deployment cell фиксируется так:

- сервисы: `core`, `postgres`, `vllm-fast`;
- orchestration: `Docker Compose`;
- networks: `core_net`, `models_net`, `db_net`;
- model contract: OpenAI-compatible `/v1/*` endpoint;
- state bootstrap: PostgreSQL + `pg-boss` readiness;
- mounts: read-only `/seed` plus writable `/workspace`, `/models`, `/data`.

Baseline container posture:

- `non-root` execution where practical;
- `read_only` root filesystem where practical;
- `tmpfs` for temporary paths;
- no `privileged`;
- no `docker.sock`.

Допустимое phase-0 отклонение:

- `vllm-fast` может быть lightweight OpenAI-compatible stub, пока не доставлен отдельный model-serving seam;
- это не меняет service name или HTTP contract.

## Consequences

- Все ранние runtime features обязаны считаться с реальной deployment cell, а не только с local harness.
- Tracked initialization content и mutable runtime state разделяются на уровне mounts: `/seed` остаётся единственным Git-tracked initialization boundary, а writable runtime volumes materialize-ятся отдельно.
- Следующие model features должны сохранять service and protocol continuity для `vllm-fast`.
- Security/perimeter work может усиливать baseline posture, но не отменять его и не переносить container substrate в позднюю фазу.
