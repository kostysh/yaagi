# Использование `core-types` для входов T1

Руководство для разработчика root/consumer. Пакет предоставляет существующий `Result<T, E>` и необходимый timeline T1 поднабор: три ID, opaque revision, evidence reference и два вида времени. Все вызовы синхронные, через единственный публичный `@polyphony/core-types`.

## Запустить проверяемый пример

После `pnpm install --frozen-lockfile` в корне workspace:

```bash
pnpm --filter @polyphony/core-types build
pnpm --filter @polyphony/core-types example
```

Исполняется [examples/usage.ts](../examples/usage.ts). Node запускает TypeScript с явным `--experimental-strip-types`; импорт пакета разрешается в собранный `dist/index.js`. Пример проверяет результат assertions и выводит:

```text
success: exact IDs, revision, wall time, elapsed and evidence
error: invalid_input
recovery: corrected elapsed accepted
```

Успех сохраняет ID, пробелы в revision, wall time `-1`, elapsed `0` и reference без преобразований. Затем elapsed `-1` даёт отказ; исправленный `1` проходит независимо от прежней ошибки. Это повтор проверки входа, а не recovery хранения.

## Выбрать parser и обработать Result

| Вход | Публичный parser | Успешный тип |
| --- | --- | --- |
| Идентификатор агента | `parseAgentId(unknown)` | `AgentId` |
| Идентификатор тика | `parseTickId(unknown)` | `TickId` |
| Идентификатор действия | `parseActionId(unknown)` | `ActionId` |
| Точный token версии/хеша | `parseRevision(unknown)` | `Revision` |
| UTC milliseconds от Unix epoch | `parseWallTimeMs(unknown)` | `WallTimeMs` |
| Измеренная длительность milliseconds | `parseElapsedMs(unknown)` | `ElapsedMs` |
| Evidence data record | `parseEvidenceRef(unknown)` | `EvidenceRef` |

У каждого parser результат — `Result<тип, PrimitiveFailure>`: при `ok: true` читать `value`, иначе `error.code === 'invalid_input'`. Ошибка не содержит входных данных; передать исправленный вход можно обычным следующим вызовом. Созданные parsers Result/error/ref объекты frozen. Прежний generic `Result` остаётся структурным readonly type alias и не замораживает объекты, созданные самим потребителем.

Строки должны иметь `length > 0`; UUID-формат не требуется. Пробелы и регистр не меняются. Время — safe integers: wall time может быть отрицательным и двигаться назад, elapsed неотрицателен. `-0` сохраняется. Строковые числа, дроби, NaN, infinity и unsafe integers отклоняются. Пакет не измеряет время и не генерирует ID.

`EvidenceRef` имеет ровно три собственных data-поля: `sourceKind`, `id`, `revision`, каждое — непустая строка. Поле `revision` хранит opaque token версии либо хеша. Обычный или null-prototype record принимается; arrays, class instances, accessors, лишние и symbol поля — нет. Успешный ref копируется, поэтому последующая мутация входа не меняет выданное значение.

Brands защищают от случайного смешения ID/revision и wall/elapsed при TypeScript-проверке. `as`/`any` обходят эту защиту; значение после JSON/storage boundary нужно проверить заново. Parsing подтверждает форму, но не принадлежность ID, наличие/истинность evidence, freshness или authority. Эти проверки остаются у владельцев и root.

## Проверить пакет и границы evidence

```bash
pnpm --filter @polyphony/core-types typecheck
pnpm --filter @polyphony/core-types lint
pnpm --filter @polyphony/core-types test
```

`test` сначала собирает пакет, затем проверяет Result/brand contract fixtures, точный runtime namespace, pure import/calls, runtime-случаи и M1, после чего выполняет этот пример. M1 использует один T1-shaped consumer с production API и ограниченным fixture double. Double не является вторым валидатором общего назначения; полные отрицательные случаи выполняются на production parsers.

Пакет не имеет dependencies/imports и Node API в source. Node imports в проверках/примере принадлежат tooling-конфигурации; переносимые source/contract fixtures сохраняют `types: []`. Наблюдения и ограничения записаны в [локальном evidence](../../../docs/validation/core-types/gh-45.t1.implementation.md), точный контракт — в [core-types.spec](../../../docs/modules/core-types/specification.md).

Эти проверки не реализуют timeline, не сохраняют записи и не доказывают runtime, I1 или E3. Рабочая сборка и постоянное хранение проверяются отдельно.
