# План имплементации модуля: `core-types` — инкремент `Result<T, E>`

- Document ID: `core-types.plan`
- Module ID: `core-types`
- Спецификация: [core-types.spec](specification.md)
- Архитектура: [модули и зависимости](../../architecture.md#3-модули-и-владение)
- Рамочная Issue: [#23](https://github.com/kostysh/yaagi/issues/23)
- Целевой результат: `@polyphony/core-types` публично предоставляет только проверенный compile-time контракт `Result<T, E>`.

## Задачи

| ID | Проверяемый результат | Зависит от | Параллельная группа | Проверка | Sub-issue |
| --- | --- | --- | --- | --- | --- |
| T1 | Root toolchain сохраняет TypeScript 7 как `tsc`, предоставляет TypeScript 6 API для syntax-only ESLint и документирует Biome + ESLint | Принятые спецификация и план | A | Exact versions, frozen install, обе lint-команды | [#24](https://github.com/kostysh/yaagi/issues/24) |
| T2 | Private ESM-пакет экспортирует только `Result<T, E>` и не имеет imports или dependencies | T1 | A | Declarations, manifest boundary check, ESM import-smoke | [#24](https://github.com/kostysh/yaagi/issues/24) |
| T3 | Consumer fixtures и общие gates доказывают контракт, а README/roadmap честно фиксируют частичный статус | T2 | A | Positive/negative compile checks, lint probes, package/root gates | [#24](https://github.com/kostysh/yaagi/issues/24) |

## Порядок интеграции

Работа последовательна: общий toolchain и lockfile меняются до создания пакета; package export собирается до consumer fixtures; документация статуса обновляется только после успешных проверок. Искусственного параллелизма нет, потому что все задачи затрагивают одну общую границу и один lockfile.

## Общая проверка модуля

- Проверка поведения: compile-time consumer fixture через `@polyphony/core-types`, включая отрицательные `@ts-expect-error` случаи.
- Интеграционная проверка: package build, declaration/export resolution и Node ESM import-smoke; это не runtime-тест поведения агента.
- Проверка границы: Biome, ESLint, package-local manifest/export check и отрицательные lint-пробы для relative и `node:*` imports.
- Tooling delta 2026-09-29 по решению оператора: scripts/config переведены в TypeScript, direct Node scripts используют `--experimental-strip-types`; отдельный no-emit tooling typecheck не меняет контракт `Result` и source `types: []`.
- Затронутая документация: tooling, README и текущий статус roadmap; архитектура и ADR не меняются.
- Требуемые аудиты: Concept Conformance для спецификации и tooling-методологии; Spec Conformance для плана, реализации и roadmap; Security для кода/config.

## Открытые вопросы

- Нет блокирующих вопросов. Следующий тип `core-types` выбирается только при появлении конкретного потребителя; этот план его не определяет.
