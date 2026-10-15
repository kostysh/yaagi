# Спецификация модуля: `constitution`

- Document ID: `constitution.spec`
- Module ID: `constitution`
- Статус: accepted для C1 — принято оператором 2026-10-15 в снимке `626c7ff11dd2bbc3f19dd2931d7d390da5bd85a9`; Concept, Spec и Security — PASS.
- Передача: ready for coding C1; C2/C3 уточняются перед своими инкрементами.
- Потребитель: доверенный composition root; первый реализационный инкремент C1 для I1.
- Концепция: [§5.3](../../polyphony_concept.md#53-конституциональная-оболочка), [§6.2.1](../../polyphony_concept.md#621-канал-взаимодействия-с-оператором), [§16.9](../../polyphony_concept.md#169-практические-границы-безопасности).
- Архитектура: [§§3–4](../../architecture.md#3-модули-состояние-и-публичные-операции), [§5.3](../../architecture.md#53-ошибки-единственный-исполнитель-и-восстановление), [§7](../../architecture.md#7-развитие-физиология-и-границы-доверия); [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-003](../../adr/ADR-003-action-and-development-boundaries.md).
- Системный дизайн: [F1–F2](../../system-design.md#3-сквозные-потоки), F3–F4/F7–F8 и [поэтапная сборка I1–I4](../../system-design.md#5-поэтапная-сборка).
- Рамочная Issue: [#46](https://github.com/kostysh/yaagi/issues/46).

## Назначение и границы

`constitution` предоставляет внешнюю read-only policy, проверку запуска, полномочия единственного оператора, ограничения и проверку точных approvals. Модуль не задаёт ценности агента. Полный объём развивается в одной спецификации и одном [плане](implementation-plan.md).

**Capability C1:** при доверенных входах root получает синхронный допуск либо отказ boot по policy, единственной operator binding и согласованности stable body manifest со схемами зарегистрированного состава. Отказ не открывает рабочий контур. Это вклад constitution в F1; разрешение исполнения действий не возникает.

**Substrate:** пакет `@polyphony/constitution`, публичные contracts, consumer guide и evidence. **Anti-claims:** C1 не реализует runtime/OS lock, socket authentication, хранение/миграции, grants, action admission или всю I1. Проверки пакета не подтверждают совместную работу реальных соседей и живую Полифонию.

Риск: высокая значимость границы допуска. Ошибка может разрешить запуск недопустимого состава; поэтому проверки fail closed. I/O и исполнение находятся за границей чистого модуля.

### Инкременты

| Инкремент | Наблюдаемая граница | Условие уточнения |
| --- | --- | --- |
| C1 / I1 | Read-only policy, единственная локальная binding, boot manifest/schema | Точный контракт ниже; текущая поставка |
| C2 / I2 | `authorize(action, principal, policyRevision)`, `ControlRequest = Status / Pause / Resume / ApproveChange` | До подключения управления и действий уточнить контракты здесь; S3 с реальным transport — #49/#62/#64 |
| C3 / I4 | `validateApproval(scope)` и policy-ограничения развития | До development уточнить exact scope/version/hash, актуальную policy и canonical approval/evaluation; совместная приёмка — #68/#69 |

В C2/C3 должны сохраняться отказ чужому principal, отсутствие полномочий из текста `SendMessage`, перепроверка актуальных прав и точная привязка approval. Canonical evidence, доверенное время, атомарное потребление grant, CAS binding и исполнение принадлежат development/executive/root по архитектуре §7. Read-only лимиты/окна предоставляет constitution; executive/physiology применяют и учитывают их, homeostasis регулирует режимы; рабочие значения определяет E2. C1 не экспортирует заглушки будущих операций или пустые разрешающие правила.

## Публичный контракт C1

Публичные типы принадлежат `@polyphony/constitution/contracts`. Общая зависимость — только существующий `Result` из `@polyphony/core-types`. Доменные DTO не переносятся в `core-types`; новых общих IDs/refs/validators для C1 не требуется. Если реальный следующий потребитель потребует общий примитив, его контракт сначала передаётся в #45.

```ts
import type { Result } from '@polyphony/core-types';

export type VersionEntry = {
  readonly name: string;
  readonly version: number;
};

export type BindingEntry = {
  readonly name: string;
  readonly revision: string;
};

export type OperatorBinding = {
  readonly kind: 'linux-uid';
  readonly uid: number;
};

export type BootManifest = {
  readonly schemaVersion: 1;
  readonly codeRevision: string;
  readonly contractVersions: readonly VersionEntry[];
  readonly schemaVersions: readonly VersionEntry[];
  readonly modelBindings: readonly BindingEntry[];
  readonly skillBindings: readonly BindingEntry[];
  readonly configRevision: string;
  readonly constitutionRevision: string;
};

export type BootSchema = {
  readonly schemaVersion: 1;
  readonly versions: readonly VersionEntry[];
};

export type ConstitutionPolicy = {
  readonly schemaVersion: 1;
  readonly revision: string;
  readonly operatorBindings: readonly OperatorBinding[];
  readonly manifest: BootManifest;
};

export type ConstitutionFailure = {
  readonly code: 'denied';
  readonly reason:
    | 'invalid_policy'
    | 'invalid_manifest'
    | 'invalid_schema'
    | 'manifest_mismatch'
    | 'schema_mismatch';
};

export type BootAdmission = {
  readonly policyRevision: string;
  readonly operatorBinding: OperatorBinding;
};

export interface ConstitutionPort {
  readonly checkBoot: (
    manifest: unknown,
    schema: unknown,
  ) => Result<BootAdmission, ConstitutionFailure>;
}

// Корневой export пакета; contracts не импортирует реализацию.
export function createConstitution(
  policy: unknown,
): Result<ConstitutionPort, ConstitutionFailure>;
```

`createConstitution` принимает подготовленное host обычное JSON-compatible значение, не путь, JSON-текст, Zod schema или callback. Root загружает и разбирает конфигурацию вне модуля. `undefined` представляет отсутствие policy; `null` или невалидная структура — повреждение. Недоступность файла обрабатывает host и не превращает её в policy по умолчанию. Произвольный исполняемый JavaScript, getters и Proxy не входят в доверенный вход.

Root передаёт в `checkBoot` фактический manifest из разрешённых установленного кода, конфигурации и resolved bindings, а не копию разрешённого manifest из policy. `schema` — отдельная проекция фактически зарегистрированных owner schema versions. Это узкая проекция root, не импорт DTO соседних доменных пакетов и не результат чтения БД. После этого `state` отдельно проверяет/мигрирует сохранённые схемы; успешный C1 не отменяет отказ `state`.

Версии — неотрицательные safe integers; `uid` — неотрицательный safe integer, сравниваемый transport с фактическим Linux UID. Все строки непустые и не имеют начальных/конечных пробелов. Revisions и names — непрозрачные точные значения, без численного порядка, приведения регистра или иной нормализации. В каждом списке `name` уникален. Binding revision — несекретная точная ссылка на resolved binding владельца; root должен менять её при изменении его security-relevant состава. У моделей она охватывает роль/model/version/config reference, у навыков — точную version/hash. Пустые model/skill bindings допустимы для технического I1; вымышленные bindings не требуются.

Форма объектов строгая: неизвестные поля отклоняются; числа не приводятся из строк. Все обязательные поля присутствуют, включая пустые списки. Порядок entries не значим; повторяющийся `name` не удаляется автоматически, а делает вход невалидным. Empty contract/schema lists допустимы только как описание пустого соответствующего состава; фактически включённые участники должны быть перечислены root. Конституция не обнаруживает скрытые пакеты или bindings самостоятельно.

## Требования и инварианты C1

Все требования новые. MUST/MUST NOT обозначают обязательность. Указанные основания и проверки ограничивают смысл; они не расширяют полномочия constitution.

| ID | Нормативное поведение и основание | Опровергающая проверка |
| --- | --- | --- |
| C1-R1 | `createConstitution` MUST вернуть `denied/invalid_policy` для отсутствующей или невалидной policy. Основание: архитектура §3.2, отказ constitution | `undefined`, `null`, неверный discriminant/type или лишнее поле не создают порт |
| C1-R2 | Policy MUST содержать ровно одну однозначную `operatorBindings`; иначе действует R1. Основание: концепция §6.2.1, архитектура §4.3 | Ноль, две разные или две одинаковые binding, неверный kind/uid отклонены |
| C1-R3 | `policy.manifest.constitutionRevision` MUST совпадать с `policy.revision`. Основание: архитектура §5.3, точная constitution revision stable manifest | Самосогласованная форма с другой constitution revision отклонена как invalid policy |
| C1-R4 | При валидной policy модуль MUST сохранить отдельный неизменяемый снимок policy. Основание: read-only constitution, архитектура §§3–4 | Изменение исходного объекта после создания не меняет последующий допуск |
| C1-R5 | `checkBoot` MUST вернуть `invalid_manifest` либо `invalid_schema` для соответствующего невалидного входа. Основание: архитектура §§3.2, 4.1, F1 | Missing fields, неверные версии/числа, duplicate names, лишние поля не проходят |
| C1-R6 | `checkBoot` MUST отказать с `manifest_mismatch`, если любое поле фактического manifest отличается от policy manifest. Основание: архитектура §5.3, F1 | При неизменной policy изменить по одному code/config/constitution revision, contract/schema version, model/skill binding, добавить или удалить entry |
| C1-R7 | `checkBoot` MUST отказать с `schema_mismatch`, если фактически зарегистрированные `schema.versions` отличаются от manifest.schemaVersions. Основание: архитектура §§3.2, 5.3, F1 | Согласованные policy/manifest не разрешают другую фактическую schema version либо иной состав owners |
| C1-R8 | Только при выполнении R1–R7 `checkBoot` MUST вернуть `ok` с policy revision и единственной operator binding принятого снимка. Основание: F1 и архитектура §4.3 | Корректный состав допускается; перестановка уникальных entries сохраняет решение |
| C1-R9 | Входы и возвращённые значения MUST NOT позволять изменить принятый снимок или последующие результаты. Основание: immutable DTO, архитектура §4.1 | Попытки изменить policy/port/admission/binding не меняют следующий результат; readonly проверяется также компилятором |
| C1-R10 | Все операции C1 MUST оставаться синхронными и без I/O. Основание: pure module, архитектура §3.2, ADR-001 | Импорт/создание/вызов не открывают файлы, сокеты, timers, фоновые процессы или модели |
| C1-R11 | Ошибка MUST содержать только объявленные code/reason. Основание: архитектура §4.1, отсутствие секретов в ошибках | Входные canary secrets, UID, manifest или путь не появляются в error; модуль не логирует входы |

Если нарушены несколько условий, сначала проверяется policy при создании; затем checkBoot: форма manifest, форма schema, совпадение manifest, совпадение schema. Ошибки обычных невалидных данных возвращаются через Result, а не исключением. Допуск C1 является результатом boot-проверки, не долговечным grant или разрешением на dispatch. Для смены policy host явно создаёт новый экземпляр в разрешённом lifecycle; setter/hot reload отсутствуют.

## Сценарии поведения и восстановление

- **Допустимый запуск:** доверенный root создаёт модуль с валидной policy и единственной binding; реальные проекции совпадают с разрешённым manifest и друг с другом. Root получает `ok` и может продолжить оставшиеся проверки F1.
- **Несогласованный состав:** policy и её manifest остаются прежними, но root передаёт другую code/config/binding/schema revision. Получен `denied`; открытие рабочего контура этим результатом не разрешается.
- **Исправление конфигурации:** после отказа host исправляет policy или проекции и повторяет создание/проверку. Валидный повтор допускается; прежний отказ не оставляет lock, таймер, файл или скрытый счётчик. Исправление policy не меняет уже созданный экземпляр.

## Проверки и evidence

Изолированная приёмка выполняется через production exports, без private imports. Проверяются R1–R11, основной путь, отказ и исправление, несовпадение каждого существенного поля, типы Result и runtime immutability. В fixtures отдельно задаются разрешённый manifest, фактический manifest и зарегистрированные schemas; положительная fixture не строится копированием expected в actual во время самой проверки.

M1: неизменный тестовый consumer принимает `ConstitutionPort`, выполняет один набор contract scenarios с production-портом и совместимым test-only double. Подмена не меняет private код соседей. Отдельно проверяются dependencies/exports, отсутствие private/deep imports и отсутствие Node/native/I/O в `./contracts`. Успех double не заменяет проверки production реализации.

Проверяемый путь C1: `trusted host policy → createConstitution → immutable snapshot → root actual manifest/schema → checkBoot → Result у consumer`. Persistence, DB reload, OS authentication и action effects здесь не применимы: ими владеют host/state/transport/executive. Реальные constitution/state/timeline/memory/root объединяет I1 [#50](https://github.com/kostysh/yaagi/issues/50); допуск действий требует E3 соответствующей сборки.

### Проверка применимости критических контрактов

| Граница | Применимость, владелец и минимальный отрицательный oracle |
| --- | --- |
| HRB-01, HRB-02 | Не применимы к C1: нет ledger, idempotency keys, canonical writes, locks или конкурентного consume. Grant/action concurrency остаётся у development/executive/root (§7); C1 не выдаёт такой grant |
| HRB-03, HRB-04 | Применимы к boot: constitution проверяет cardinality binding и неизменяемую policy; R1–R4/R9 ловят неправильную binding и подмену. Проверку чужих peer credentials выполняет transport в I2/S3, не C1 |
| HRB-05 | Не применима: C1 не вызывает БД/provider. Ошибка state не становится успешным boot всей сборки; это gate root/F1 |
| HRB-06, HRB-10 | Применимы: missing/null/corrupt policy дают R1, mismatch даёт R6/R7; разрешённый recovery — исправление входов и повтор. Expiry/revocation/grant replay отсутствуют в C1 и уточняются в C2/C3 |
| HRB-07 | Применима только к UID и версиям JSON: safe nonnegative integer без coercion. Отрицательные/дробные/небезопасные числа отклоняются через R1/R5; money/DB conversion отсутствуют |
| HRB-08 | Не применима: нет transport, credentials, signed requests или внешнего endpoint. Body limits и peer authentication принадлежат CLI/root; C1 принимает уже загруженные host данные |
| HRB-09 | Применима к диагностике: bounded code/reason, canary-проверка R11; нет runtime audit events или собственного журнала. Test/audit evidence хранится в docs/validation/constitution |
| HRB-11, HRB-12 | Применимы: R2/R3/R6–R9 проверяют единственность и согласованность; единственный владелец DTO/ошибок — constitution/contracts. Type fixtures и M1 отклоняют несовместимый consumer contract |

Все применимые строки закрываются production package/contract tests описанного пути; реальный transport/БД/системная безопасность не объявляются доказанными. Новые тестовые платформы или runtime seams не требуются.

## Ограничения качества и сдача

- TypeScript/ESM, readonly DTO, существующий baseline валидации; platform types и зависимости соседних доменных owners не входят в contracts.
- Обязательны package/consumer tests, `format:check`, `lint`, `typecheck`, `build`, `git diff --check`; полный набор перед merge по политике качества.
- Guide содержит выполняемые main/error/recovery примеры. Форматирование, наличие guide и schema-only tests не подтверждают C1 без production вызовов.
- Concept-аудит спецификации; Spec-аудит плана, кода и изменённого roadmap; Security-аудит кода и документов о границе доверия. Стабильные снимки, сохранение отрицательных отчётов и delta re-audit — по политике аудитов.
- Evidence: `docs/validation/constitution/`. Ссылки на успешные verdict можно сохранить в checkpoint report/Issue без нового отчётного файла; отрицательные отчёты сохраняются отдельно по принятой схеме.

## Принятие и открытые вопросы

Материальных вопросов к продуктовым или архитектурным основаниям C1 не выявлено. Точные DTO C1 приняты оператором в checkpoint 1 по указанному снимку. Полный C2/C3 ещё не специфицирован для реализации; это не блокирует изолированную приёмку C1 и не закрывает #46 целиком.

Reviewer, audit commit и результаты независимых проверок фиксируются в checkpoint report и при дальнейшей публикации в Issue/PR. При изменении принятого контракта требуется новая contract/schema version с явной совместимостью потребителей; произвольное молчаливое расширение policy не допускается.
