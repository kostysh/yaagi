# `@polyphony/timeline`

- Document ID: `timeline.readme`

T1 сохраняет техническую историю тиков через публичный SQLite scope `state`: reserve, decide, settle, interrupted attempt и чтение после reopen. Пакет не открывает БД, не измеряет время и не исполняет действия.

[Руководство и исполняемый пример](docs/usage.md) · [спецификация](../../docs/modules/timeline/specification.md) · [план](../../docs/modules/timeline/implementation-plan.md) · [локальное evidence](../../docs/validation/timeline/gh-47.t1.implementation.md).

Exports: root и `/contracts` — переносимые DTO/validators; `/sqlite` — `bindTimeline` и явная загрузка release migrations. Сборка копирует SQL в `dist/migrations`; root применяет его через `state.migrate`.

T1 подготовлен локально к CP2, ещё не принят и не интегрирован. Общий I1, runtime и recovery E3 требуют реальных соседей и отдельной приёмки.
