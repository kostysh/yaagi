# ADR-2026-03-23 No Technical Debt Rule

- Status: Accepted
- Date: 2026-03-23
- Related: [AGENTS.md](../../AGENTS.md), [ADR-2026-03-19-quality-gate-sequence.md](./ADR-2026-03-19-quality-gate-sequence.md), [system.md](../architecture/system.md)

## Context

По мере роста репозитория стало недостаточно просто доводить отдельный шаг до формального "готово".

Даже если конкретный шаг проходит локальные проверки, он может оставить после себя:

- явный технический долг в затронутом scope;
- скрытый технический долг на стыке зависимостей, already-delivered dossiers и соседних seams;
- незафиксированные компромиссы, которые начинают жить как "временное" решение без владельца и без срока.

Это противоречит dossier workflow, где скрытые prerequisites и cross-cutting invariants должны externalize-иться сразу, а не накапливаться между шагами.

## Decision

Репозиторий закрепляет правило отсутствия технического долга как обязательный engineering contract.

Для этого правила "шаг" означает:

- завершённую единицу dossier workflow: `feature-intake`, `spec-compact`, `plan-slice`, `implementation`;
- либо user-approved delivery increment / slice, если работа сознательно разбита на несколько turn-based implementation steps.

После завершения каждого такого шага необходимо:

1. Выполнить явный анализ технического долга в изменённом scope.
2. Проверить обнаруженный долг на зависимости и соседние seams, чтобы выявить скрытый технический долг.
3. До закрытия шага принять и зафиксировать согласованное решение по каждому найденному долгу.

Порядок выполнения закрепляется явно:

- сначала локальные проверки шага;
- затем debt review и dependency/seam re-check;
- затем mandatory independent review gate;
- только после этого шаг может считаться завершённым.

Допустимые resolution paths:

- немедленное устранение в том же workstream;
- realignment соответствующего dossier / backlog / ADR, если выявлен missing prerequisite seam или cross-cutting invariant;
- user-approved follow-up with stable references and explicit dependency links, если перенос действительно согласован.

Canonical artifact для follow-up фиксируется так:

- existing feature dossier, если долг относится к уже intaken feature;
- `docs/backlog/feature-candidates.md`, если долг раскрывает ещё не intaken seam;
- `docs/adr/ADR-*.md`, если долг cross-cutting.

Automation support:

- `pnpm debt:audit` checks the repo for explicit unresolved debt markers;
- `pnpm debt:audit:changed` limits that guardrail to the currently changed scope;
- this automation is intentionally narrow and does not replace the human debt review / dependency re-check required by this ADR.

Недопустимо:

- оставлять технический долг как неявное "потом разберёмся";
- считать шаг завершённым, если найденный долг не разобран по зависимостям;
- маскировать долг под known issue без владельца, без ссылки и без решения;
- считать chat-only договорённость или `TODO` в коде достаточным follow-up artifact.

## Consequences

- Каждый шаг получает обязательный post-step debt review, а не только code/test verification.
- Hidden debt на стыках фич, ADR и runtime seams должен всплывать раньше, до следующего шага реализации.
- Dossier/backlog/ADR artefacts становятся местом фиксации решений по долгу, а не только требований и delivery slices.
- Скорость локального продвижения может снизиться, но взамен репозиторий отказывается от накопления неуправляемых компромиссов.
