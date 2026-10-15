# `@polyphony/constitution`: проверка запуска C1

Модуль даёт доверенному composition root синхронный допуск либо отказ boot. Он проверяет внешнюю read-only policy, единственную привязку Linux UID и согласованность фактического manifest с разрешённым составом и зарегистрированными схемами. Допуск boot не разрешает dispatch действия.

## Запустить пример

В корне task-worktree с Node.js `24.21.0` и pnpm `10.34.5`:

```bash
pnpm install --frozen-lockfile
pnpm --filter @polyphony/constitution example
```

[Пример](examples/usage.ts) использует только публичные exports. Policy и фактический manifest заданы независимо; это технические данные примера, не обнаружение установленного runtime. После служебного вывода сборки программа печатает:

```text
boot: allowed
boot: denied/manifest_mismatch
boot after configuration correction: allowed
```

Пример проверяет успех, отказ после изменения фактической config revision, повтор после исправления и отказ при отсутствии policy. Все результаты проверяются assertions, а не только печатаются.

## Подключить к root

`createConstitution` импортируется из `@polyphony/constitution`; DTO и `ConstitutionPort` — через type imports из `@polyphony/constitution/contracts`. Точные поля и ограничения приведены в [принятой спецификации](../../docs/modules/constitution/specification.md#публичный-контракт-c1).

1. Host загружает внешнюю policy как обычное JSON-compatible значение. Чтение файла, разбор JSON и обработка недоступности — его обязанности. Файл `.env` и его содержимое модулю не передаются.
2. Root вызывает `createConstitution(policy)` и проверяет `ok`. Отсутствующая или повреждённая policy возвращает `denied/invalid_policy`; порта при отказе нет.
3. При успехе root передаёт в `port.checkBoot(actualManifest, registeredSchemas)` фактические данные установленного состава. Их нельзя брать копированием разрешённых значений из policy.
4. Только `ok: true` позволяет продолжить остальные проверки F1. `state` отдельно проверяет сохранённые схемы и миграции; C1 не открывает БД и не выдаёт готовность всей сборки.

`schema` описывает версии зарегистрированных owner schemas, не состояние файла БД. Списки сравниваются по уникальному `name`, порядок не влияет на допуск. Contract/schema versions и UID — неотрицательные safe integers без coercion. Revisions и names сравниваются точно; пробелы по краям, дубликаты и неизвестные поля отклоняются. Пустые model/skill bindings допустимы в техническом I1. Binding revisions — несекретные ссылки на точные resolved bindings владельцев, не секреты и не их хеши.

## Отказ и исправление

| Reason при `code: denied` | Где возникает | Следующее действие доверенного host/root |
| --- | --- | --- |
| `invalid_policy` | Создание | Исправить policy, её revision/manifest или единственную UID-binding; создать новый экземпляр |
| `invalid_manifest` | Boot | Исправить форму фактического manifest |
| `invalid_schema` | Boot | Исправить форму зарегистрированных schemas |
| `manifest_mismatch` | Boot | Сверить фактический состав и разрешённую конфигурацию; не менять expected автоматически ради успеха |
| `schema_mismatch` | Boot | Согласовать версии реально зарегистрированных owners с manifest |

Порядок отказов: policy при создании; затем форма manifest, форма schema, совпадение manifest, совпадение schema. Ошибки содержат только code/reason, без исходных данных и диагностики Zod.

Операции не меняют входы. Экземпляр хранит отдельный замороженный снимок policy; последующее изменение исходного объекта его не изменяет. Возвращённые порт и результаты также заморожены. Исправление фактических boot inputs допускает повторную проверку тем же портом. Смена policy требует явного создания нового экземпляра в разрешённом lifecycle; setter и hot reload отсутствуют.

## Проверки и граница результата

```bash
pnpm --filter @polyphony/constitution format:check
pnpm --filter @polyphony/constitution lint
pnpm --filter @polyphony/constitution typecheck
pnpm --filter @polyphony/constitution build
pnpm --filter @polyphony/constitution test
```

`test` выполняет проверки production API, M1 consumer scenarios, импорт без таймеров/сетевых globals/логирования и весь guide example. Compile-time проверки входят в `typecheck`; lint включает негативные package-boundary probes. Для M1 используется отдельный test-only double конечного набора fixtures, который не экспортируется и не заменяет production-проверки.

C1 — проверяемая граница пакета. Здесь ещё нет `authorize`, `ControlRequest` или `validateApproval`, реального socket/peer authentication, OS lock и агентного runtime. Сборка I1 с реальными соседями — [#50](https://github.com/kostysh/yaagi/issues/50); допуск действий требует E3 соответствующего состава. Полный scope [#46](https://github.com/kostysh/yaagi/issues/46) остаётся открытым; следующие инкременты описаны в [плане](../../docs/modules/constitution/implementation-plan.md).
