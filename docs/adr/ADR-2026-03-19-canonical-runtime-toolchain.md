# ADR-2026-03-19 Canonical Runtime Toolchain

- Status: Accepted
- Date: 2026-03-19
- Related: [F-0001](../features/F-0001-constitutional-boot-recovery.md), [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md)

## Context

Первые две фичи показали, что без жёстко зафиксированного toolchain implementation быстро уходит в локальные компромиссы:

- runtime пытается стартовать не на каноническом `TypeScript` пути;
- временные runner-решения начинают жить дольше ожидаемого;
- тестовый и dev execution path расходятся;
- новые пакеты получают неявные правила запуска.

Архитектура уже требует `Node.js 22`, `TypeScript 5.x`, `pnpm`, `node:test` и Docker Compose, но после первых циклов стало ясно, что этого недостаточно без явного repo-level engineering contract.

## Decision

Канонический toolchain репозитория фиксируется так:

- package manager: `pnpm`;
- runtime: `Node.js 22`;
- source language: `TypeScript`;
- default local execution path: `node --experimental-strip-types`;
- automated tests: `node:test`;
- monorepo layout and orchestration: root-level `pnpm` scripts as the only supported command surface.

Дополнительно:

- `tsx` не считается штатным runtime path;
- новые приложения и пакеты не должны вводить альтернативные package/runtime paths без отдельного ADR;
- быстрый кодовый контур остаётся в `pnpm test`, а тяжёлые infrastructure smoke checks выводятся в отдельные root commands.

## Consequences

- Разработчики получают один предсказуемый execution path для runtime, scripts и tests.
- Новые feature seams должны встраиваться в существующий `pnpm + TypeScript + node:test` flow, а не создавать свой.
- Любая попытка ввести второй штатный runner/toolchain должна проходить отдельное архитектурное решение.
