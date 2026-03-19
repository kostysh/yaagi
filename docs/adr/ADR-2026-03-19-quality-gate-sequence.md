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

- канонический formatter: `Biome`;
- канонический typed linter: `ESLint`;
- `Biome` и `ESLint` одинаково применяются к application code и test code через root-level `pnpm` commands;
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

- Следующие implementation cycles получают один предсказуемый style/quality path для source и tests: `Biome` отвечает за formatting/style pass, `ESLint` за typed lint.
- Formatter перестаёт быть факультативным локальным шагом и становится первой стадией quality gate.
- Typecheck выполняется до composite lint stage, поэтому formatter noise и ошибки типов не маскируются downstream lint output.
- Последующая реализация должна обновить root scripts, config files, docs and tests так, чтобы этот порядок и состав toolchain были проверяемыми, а не только описанными.
