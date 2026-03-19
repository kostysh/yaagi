# ADR-2026-03-19 Quality Gate Sequence

- Status: Accepted
- Date: 2026-03-19
- Related: [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md), [system.md](../architecture/system.md)

## Context

После поставки phase-0 scaffold у репозитория уже есть канонический runtime/deployment path, но quality/style gates пока неполные:

- root-level commands не закрепляют formatter/linter contract;
- source и tests могут получить расходящиеся rulesets;
- порядок локальной проверки остаётся неявным;
- архитектурные expectations для hooks и format/lint checks есть, но repo-level implementation contract не доведён до developer-facing command surface.

## Decision

Репозиторий закрепляет единый quality/style contract:

- канонический formatter/linter toolchain: `Biome`;
- один и тот же toolchain применяется к application code и test code;
- canonical local fix flow: `format -> typecheck -> lint`;
- canonical automation/read-only flow: `format:check -> typecheck -> lint`;
- root-level `pnpm` commands являются единственным поддерживаемым интерфейсом для этих gates.

Scope применения:

- `apps/*`
- `packages/*`
- `infra/*`
- `scripts/*`
- `test/*`

## Consequences

- Следующие implementation cycles получают один предсказуемый style/quality path для source и tests.
- Formatter перестаёт быть факультативным локальным шагом и становится первой стадией quality gate.
- Typecheck выполняется до lint, поэтому stylistic noise и lint output не маскируют ошибки типов.
- Последующая реализация должна обновить root scripts, config files, docs and tests так, чтобы этот порядок был проверяемым, а не только описанным.
