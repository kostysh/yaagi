# ADR-2026-03-19 Boot Dependency Contract

- Status: Accepted
- Date: 2026-03-19
- Related: [F-0001](../features/F-0001-constitutional-boot-recovery.md), [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md)

## Context

После первых двух фич стало ясно, что boot/recovery нельзя завязывать на "предполагаемый полный набор органов". Иначе boot начинает требовать зависимости, которые архитектура ещё не поставила в текущей фазе, а containerized startup и in-memory tests расходятся.

Нужен один источник истины для preflight dependency set, который можно эволюционно расширять по мере поставки новых organs.

## Decision

Обязательный dependency set для constitutional boot определяется не кодом по умолчанию и не досье вручную, а active constitution manifest.

Правило:

- `constitution.yaml` объявляет `requiredDependencies`;
- boot preflight проверяет именно этот список;
- delivered platform substrate каждой фазы обязан синхронизировать этот список с реальной deployment cell.

Для текущего phase 0 baseline:

- обязательны `postgres` и `model-fast`;
- `model-deep` и `model-pool` остаются расширяемыми dependency IDs, но не считаются delivered prerequisites текущей фазы.

## Consequences

- `F-0001` больше не хардкодит зрелую model ecology как обязательную для раннего старта.
- Следующие platform/model features должны обновлять constitution and dossier assumptions одновременно.
- Drift между boot harness и containerized startup path становится архитектурной ошибкой, а не "ожидаемым временным состоянием".
