# Спецификация модуля: `core-types`

- Document ID: `core-types.spec`
- Module ID: `core-types`
- Статус: инкремент `Result<T, E>` accepted и интегрирован; документы поднабора T1 приняты в CP1 на `2aa09af2a27cac31998d26ad8d05642c7e972fdc`. Поднабор принят в CP2 на `ebca941`, интегрирован PR #78 (merge `2b90863`, полный post-merge CI PASS); CP3 принят оператором 2026-10-17.
- Передача: CP1 принят оператором; реализация, проверки и guide/evidence проходят CP2, без разрешения публикации.
- Концепция: [темпоральность и непрерывность](../../polyphony_concept.md#41-время--не-параметр-а-среда-существования), §§11/14.
- Архитектура: [§3, граница и зависимости](../../architecture.md#3-модули-состояние-и-публичные-операции), [§4.1, общие правила](../../architecture.md#41-общие-правила), [M1](../../architecture.md#10-приёмочные-сценарии-и-evidence), [ADR-001](../../adr/ADR-001-module-boundaries.md).
- Системный дизайн: [карта модулей](../../system-design.md#карта-всех-модулей), F1/F3/F4/F8 и [I1](../../system-design.md#5-поэтапная-сборка).
- Рамочная Issue расширения: [#45](https://github.com/kostysh/yaagi/issues/45); [план](implementation-plan.md). История первого инкремента: [#23](https://github.com/kostysh/yaagi/issues/23), [#24](https://github.com/kostysh/yaagi/issues/24), [PR #25](https://github.com/kostysh/yaagi/pull/25).
- Основание расширения: принятый оператором `core-types-45.plan.v1.2@dc312c0` и запрос [timeline.spec](../timeline/specification.md#общие-примитивы-и-владельцы), CP1 принят на `acef6a2b89dcefe5bc534537785422479f8d8393`. Точные declarations и правила приняты в CP1 #45 на `2aa09af`; они не меняются в реализации CP2.

## Назначение и границы

Потребитель TypeScript использует общий `Result` и различает IDs, revision, ссылку на evidence и два вида времени. Для расширения доверенный root/consumer передаёт неизвестное значение публичному parser и получает проверенный точный примитив либо безопасный отказ. Это предотвращает смешение полей `TickFrame` перед передачей в timeline, но не заменяет доменную проверку владельца.

**Capability поднабора:** чистая синхронная проверка общих значений и различение их типов. **Substrate:** declarations, ESM-пакет, consumer fixtures, guide/evidence для T1. **Anti-claims:** ни parser, ни brand не доказывают принадлежность ID агенту, существование/истинность evidence, актуальность revision, authority или согласованность snapshot. Timeline, runtime и общая атомарность I1 здесь не реализуются.

Входит только существующий `Result` и запрос T1: `AgentId`, `TickId`, `ActionId`, `Revision`, `EvidenceRef`, `WallTimeMs`, `ElapsedMs` и parsers. Доменные DTO, `TickRevision`, epoch, sequence, errors соседей остаются у владельцев. Нет `AgentState`, новых IDs, clocks, генераторов, хеширования, БД, I/O, validator framework, combinators или production-порта. Следующий общий тип добавляется только по принятой потребности конкретного потребителя, в те же spec/plan.

Риск расширения средний: неправильный parser может пропустить повреждённый вход или изменить token общего потребителя. У пакета нет persistent state, миграций или provider boundary. Проверка истории/reopen принадлежит timeline; общих транзакций — I1 #50.

## Публичный контракт

Единственный entrypoint — `@polyphony/core-types`. Он предоставляет перечисленные ниже типы и ровно семь runtime exports parser-функций. Отдельного `./contracts` и deep exports нет. Это принятый контракт, реализованный локально в CP2; его интеграция в `develop` ещё не подтверждена.

### Принятый `Result`

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

Этот alias не меняется: `T`/`E` unconstrained, narrowing выполняется только по `ok`; `0`, `''`, `false` и `undefined` допустимы согласно параметру типа. Missing payload, неверный discriminant, доступ к чужой ветви после narrowing и readonly mutation отклоняются TypeScript. Structural typing не обещает exact-object гарантию для заранее созданного совместимого значения. `readonly` самого alias не замораживает произвольные объекты потребителя в runtime. Type alias не имеет runtime export; до расширения T1 Result-only пакет не экспортировал исполняемых helpers.

### Общие значения поднабора T1

| Тип | Значение и проверка |
| --- | --- |
| `AgentId`, `TickId`, `ActionId` | Три взаимно несовместимых branded string типа. Каждый parser принимает только primitive string с `length > 0` |
| `Revision` | Отдельный branded string с тем же правилом непустой строки; opaque token версии либо хеша, без численного порядка |
| `WallTimeMs` | Branded number: целые UTC milliseconds от Unix epoch, от `Number.MIN_SAFE_INTEGER` до `Number.MAX_SAFE_INTEGER` включительно; отрицательные значения допустимы |
| `ElapsedMs` | Другой branded number: независимо измеренная длительность в milliseconds от `0` до `Number.MAX_SAFE_INTEGER` включительно |
| `EvidenceRef` | Неизменяемая плоская ссылка с точными полями ниже; самостоятельного `EvidenceId`, enum источников или hash-типа нет |

Непустая строка проверяется без trim, case folding, Unicode normalization, UUID/URI grammar или coercion. Пробелы, включая строку из пробелов, сохраняются как часть opaque token. Сравнение/проверка владельца или допустимых source kinds принадлежит потребителю. Числовой parser не принимает string, bigint, boxed number, дробь, NaN или infinity. `-0` принимается обоими time parsers и сохраняется, как и любое другое допустимое значение; duration не вычисляется из wall times. Движение wall clock назад допустимо и не означает отрицательный elapsed.

Brand различает перечисленные IDs/revision и два вида времени при обычной строгой проверке TypeScript: plain string/number или другой brand не присваиваются целевому типу без проверки. Приведение `as`/`any` не является доказательством валидации; публичный parser повторно проверяет вход независимо от статического типа. Общие значения не выдают прав и не создают runtime sandbox.

```ts
export type EvidenceRef = {
  readonly sourceKind: string;
  readonly id: string;
  readonly revision: Revision;
};

export type PrimitiveFailure = { readonly code: 'invalid_input' };

export declare function parseAgentId(input: unknown): Result<AgentId, PrimitiveFailure>;
export declare function parseTickId(input: unknown): Result<TickId, PrimitiveFailure>;
export declare function parseActionId(input: unknown): Result<ActionId, PrimitiveFailure>;
export declare function parseRevision(input: unknown): Result<Revision, PrimitiveFailure>;
export declare function parseEvidenceRef(input: unknown): Result<EvidenceRef, PrimitiveFailure>;
export declare function parseWallTimeMs(input: unknown): Result<WallTimeMs, PrimitiveFailure>;
export declare function parseElapsedMs(input: unknown): Result<ElapsedMs, PrimitiveFailure>;
```

`parseEvidenceRef` принимает обычный data record с `Object.prototype` или `null` prototype, ровно тремя собственными строковыми data-полями `sourceKind`, `id`, `revision`; значения — непустые primitive strings по правилу выше. Массив, class instance, отсутствующее/лишнее/symbol поле или accessor отклоняются. Поле `revision` содержит один opaque token версии **либо** хеша; parser не выбирает алгоритм, не вычисляет хеш и не проверяет freshness. Стабильность `id` обеспечивает источник, не parser. Результат — новый detached `EvidenceRef`, а не переданный record.

## Поведение и инварианты

Требования расширения новые; поведение принятого `Result` сохраняется. `explicit` — прямое принятое основание, `derived` — необходимое уточнение публичной границы владельцем на CP1. Применимость строк ограничена этими семью parsers и их потребителями; выбранные имена/форма не переопределяют архитектурных владельцев.

| ID | Обязательное поведение и основание | Проверка, опровергающая обязательство |
| --- | --- | --- |
| CT-R1 | При допустимом входе parser MUST вернуть `ok: true` с соответствующим значением из публичного контракта. Explicit: запрос T1; точные формы — derived из общего владельца §4.1 | Допустимый ID/ref/time отклонён либо возвращён другой тип/состав |
| CT-R2 | При недопустимом входе parser MUST вернуть `ok: false` и ровно `{ code: 'invalid_input' }`. Explicit: таблица core-types §3.2; границы — derived для однозначной validation | Пустая строка, неверная форма ref, NaN/дробь/unsafe integer либо отрицательный elapsed приняты |
| CT-R3 | Parser MUST сохранить допустимые строки и числа без преобразования. Explicit: принятый T1, точные policy/snapshot tokens и раздельное время | Пробелы/регистр/token меняются, wall time ограничен неотрицательными либо `Object.is` выявляет изменение `-0` |
| CT-R4 | Type declarations MUST отклонять смешение IDs/revision и двух видов времени без явного обхода типов. Explicit: различимые непрозрачные IDs и время §4.1 | Отрицательный consumer fixture компилируется без `@ts-expect-error` |
| CT-R5 | Parser MUST оставить вход неизменным. Derived из чистого контракта принятого плана и immutable DTO §4.1 | Frozen input вызывает попытку записи или исходный record меняется |
| CT-R6 | Созданные parser объекты MUST оставаться неизменяемыми после возврата. Derived из immutable DTO §4.1; это не изменение произвольных `Result<T, E>` | Изменение входного ref/Result/error/value меняет ранее возвращённое значение; мутация результата принимается |
| CT-R7 | Parser MUST завершать ошибку проверки через безопасный Result без раскрытия входа или исключения. Derived из `invalid_input` §3.2 и отказа без I/O в принятом плане | Ошибка reflection/accessor-форма выбрасывает исключение; error содержит input, path, message/stack или иные поля |
| CT-R8 | Импорт и вызовы пакета MUST оставаться без I/O и внешнего изменяемого состояния. Explicit: уровень 0 §3.2, portable boundary §2.4 | Import/call требует Node/native/env/clock, пишет/logs или зависит от порядка вызовов |

В CT-R6 входят Result-оболочка, `PrimitiveFailure` и `EvidenceRef`, созданные parsers; их readonly гарантия действует и в runtime. Строки/числа immutable сами по себе. Внешний record может быть изменяемым: его последующая мутация не влияет на прежний success. Проверка data record не вызывает его accessor; бросившая reflection ловится как `invalid_input`. Это граница доверенного JS-кода, не защита от выполнения proxy traps или произвольного кода в том же процессе. Нет логирования, исключений с данными, I/O или внешнего error cause.

### Сценарии потребителя

- **Успех:** root проверяет ID, opaque tokens, wall time `-1` и elapsed `0`, затем передаёт неизменённые значения в T1-shaped consumer. Consumer различает поля и читает те же tokens; запись в БД этим не доказывается.
- **Отказ и исправление:** elapsed `-1` или ref с пустой revision возвращает `invalid_input`; следующий независимый вызов с исправленным входом проходит. Parser ничего не резервирует и не сохраняет.
- **Совместимость:** прежние consumers state/queue/constitution продолжают импортировать и сужать тот же `Result`; C1 `policyRevision: string` не меняется. Root проверяет свою строковую проекцию через `parseRevision` без изменения C1.

## Ограничения, зависимости и совместимость

`core-types` остаётся import-free пакетом уровня 0 без runtime/package dependencies, Node/native/platform-specific API и globals, deep exports или исходящих imports/reexports. Стандартные ECMAScript primitives допустимы. TypeScript 7.0.2 strict, ESM, declarations, Biome и ESLint сохраняются. Tooling использует отдельную Node-конфигурацию, direct `.ts` — только с `--experimental-strip-types`; source/consumer fixtures остаются без Node types. Код/тесты читают публичный package export, не private source paths.

В CP2 прежний запрет runtime exports в `import-smoke` заменён точным allowlist семи parsers. Manifest/dependency/import boundary checks не ослабляются. Это additive API относительно старых consumers, но не совместимость со старым smoke-утверждением «namespace пуст»: его проверяемая граница теперь явно шире. Новых dependencies или общего валидатора не требуется.

Канонический владелец новых symbols — только `core-types`; [timeline T1](../timeline/specification.md#общие-примитивы-и-владельцы) импортирует их через root export и сохраняет локальные DTO/CAS revision у себя. State/queue/constitution сохраняют прежний `Result`, без обязательной миграции на новые brands. Пропуск одного из семи symbols в exports/type fixtures или локальный shadow primitive T1 — отрицательный oracle границы. Это conditional package readback; полный high-risk backend matrix не применяется к чистой проверке значений без storage/auth/provider. Реальные сохранение/reopen и mapping проверяют #47/#49/#50.

Миграций данных нет. Откат нового API после появления потребителя требует согласованного отката зависимого consumer, а не удаления symbols под ним; старый `Result` не меняется. Поднабор не завершает всю #45, следующие additions требуют нового реального потребителя и принятия изменения тех же документов.

## Критерии приёмки

- Сохраняются исходные positive/negative Result fixtures: обе ветви, narrowing, generic propagation, falsy/undefined, invalid shape и readonly. Успешны прежние consumers state/queue/constitution.
- CT-R1–R7 проверяются через **собранный production export**: валидные точные значения и перечисленные отказы, type brands, immutable/detached results. Runtime import имеет ровно семь exports; types не становятся runtime values. Declared signatures и negative type fixtures проверяются strict compiler.
- Путь проверки: input → публичный parser → Result → неизменный T1-shaped consumer. Для M1 тот же consumer и те же ограниченные scenarios проходят production API и совместимый test-only double; injection только в тестах, без нового production-порта/harness. Double не заменяет полную матрицу production parsers и не доказывает timeline durability.
- CT-R8: dependency/export graph, manifest/import boundary checks и probes для relative/`node:*` imports; import/call smoke не наблюдает I/O/побочных эффектов. Package build создаёт `dist/index.js`/`dist/index.d.ts`.
- Исполняемый guide `packages/core-types/docs/usage.md` демонстрирует успех, отказ и повтор после исправления; evidence — `docs/validation/core-types/`. Guide и evidence создаются в CP2.
- В CP2 проходят package и root `format:check`, `lint`, `typecheck`, `build`, `test` и `git diff --check`; полный pre/post-merge CI относится к поставке. CP1 проверяет документы, не исполняемый контракт.

## Аудит и readiness

Concept Conformance — эта спецификация и изменённые accepted timeline contracts; Spec Conformance — план, roadmap/README и затронутые статусные документы; Security — новые validation/error/immutability/trust положения. Независимые verdict и exact SHA фиксируются в checkpoint report; отрицательные отчёты сохраняются по [политике](../../development-methodology/audits.md).

Открытых архитектурных вопросов нет. CP1 принят на `2aa09af`; поднабор поставлен [PR #78](https://github.com/kostysh/yaagi/pull/78), [полный post-merge CI](https://github.com/kostysh/yaagi/actions/runs/38976080688) — PASS, CP3 принят. Зависимость #47 от этого поднабора снята. Реальные runtime/I1 и весь scope обеих рамочных Issues не считаются завершёнными. [Guide](../../../packages/core-types/docs/usage.md) и [локальное evidence](../../validation/core-types/gh-45.t1.implementation.md) описывают только этот поднабор.
