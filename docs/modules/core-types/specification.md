# Спецификация модуля: `core-types` — инкремент `Result<T, E>`

- Document ID: `core-types.spec`
- Module ID: `core-types`
- Статус: accepted
- Концепция: [Полифония](../../polyphony_concept.md)
- Архитектура: [граница `core-types`](../../architecture.md#3-модули-и-владение)
- Рамочная Issue: [#23](https://github.com/kostysh/yaagi/issues/23)

## Назначение

Потребитель TypeScript получает одну общую форму результата и может различить успешный и ошибочный исход по полю `ok` без исключений, I/O или runtime helpers. Этот инкремент создаёт минимальный общий контракт для последующих модулей, но не завершает весь модуль `core-types` из roadmap.

## Границы

- Входит: публичный generic type alias `Result<T, E>`, declarations, корневой export пакета и compile-time contract fixtures.
- Не входят: IDs, revisions, время, `EvidenceRef`, доменные DTO и error-коды, constructors, combinators, validators и runtime validation.
- Не входит exact-object гарантия: TypeScript остаётся структурной системой типов, поэтому заранее созданное совместимое значение может иметь дополнительные поля.
- `readonly` защищает поля только при статической проверке и не замораживает объект в runtime.

## Публичный контракт

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

- Входы: unconstrained type parameters `T` и `E`.
- Выход: дискриминированный union; при `ok: true` доступен `value: T`, при `ok: false` доступен `error: E`.
- Runtime-эффекты и runtime-exports отсутствуют.
- Невалидная форма выражается диагностикой TypeScript, а не runtime-ошибкой пакета.

## Сценарии поведения

### Сценарий: успешный результат

- Дано: значение типа `Result<T, E>` с `ok: true`.
- Когда: потребитель проверяет discriminant `ok`.
- Тогда: TypeScript сужает ветвь до `value: T` и не разрешает `error`.

### Сценарий: ошибочный результат

- Дано: значение типа `Result<T, E>` с `ok: false`.
- Когда: потребитель проверяет discriminant `ok`.
- Тогда: TypeScript сужает ветвь до `error: E` и не разрешает `value`.

### Сценарий: falsy payload

- Дано: payload равен `0`, `""`, `false` или `undefined` согласно `T` либо `E`.
- Когда: значение присваивается соответствующей ветви `Result<T, E>`.
- Тогда: валидность определяется только discriminant `ok`; payload не используется как sentinel.

### Сценарий: невалидная форма

- Дано: fresh object literal без payload своей ветви, с неверным discriminant либо попытка изменить публичное поле.
- Когда: fixture компилируется в strict mode.
- Тогда: TypeScript выдаёт ожидаемую диагностику.

## Состояние и инварианты

- `ok: true` всегда связывает ветвь с `value: T`; `ok: false` — с `error: E`.
- Тип не хранит состояние, не выполняет код и не импортирует другие пакеты или platform API.
- `core-types` остаётся пакетом уровня 0 без исходящих зависимостей.

## Ограничения качества

- Пакет собирается как ESM и выпускает declaration-файл через TypeScript 7.0.2 в strict mode.
- Biome является formatter и одним lint-контуром; ESLint является вторым lint-контуром.
- `lint` также проверяет отсутствие imports/re-exports, зависимостей и deep exports у текущего import-free пакета.
- Публичный контракт проверяется только через package export, без импорта private source path.

## Зависимости

- Runtime/package dependencies отсутствуют: это обязательная граница уровня 0.
- Root toolchain используется только для сборки и проверок и не является зависимостью публичного контракта.

## Критерии приёмки

- Положительный consumer fixture компилирует обе ветви, narrowing, generic propagation и falsy/`undefined` payload через публичный export.
- Отрицательные compile-time fixtures подтверждают отсутствующий payload, неверный discriminant, недоступное поле после narrowing и readonly mutation.
- Package build создаёт `dist/index.js` и `dist/index.d.ts`; ESM import по имени пакета разрешается без runtime exports.
- Отрицательные lint-пробы отклоняют относительный выход из пакета и `node:*` import.
- Package и root команды `format:check`, `lint`, `typecheck`, `build`, `test` завершаются успешно.
- Любой дополнительный публичный тип или runtime helper делает этот инкремент неприемлемым.

## Аудит

- Reviewer: `concept-conformance-reviewer`
- Снимок: стабильный commit спецификации и плана до начала имплементации.
- Результат: фиксируется в Issue #23; отрицательный результат сохраняется по политике аудитов.
