# Timeline T1: подключение и техническое восстановление

- Document ID: `timeline.usage`
- Контракт: [timeline.spec](../../../docs/modules/timeline/specification.md); локальный объём — [evidence](../../../docs/validation/timeline/gh-47.t1.implementation.md).

## Запустить проверенный пример

Из корня task-worktree, Node.js 24.21.0 и pnpm 10.34.5:

```bash
pnpm install --frozen-lockfile
pnpm --filter @polyphony/timeline example
```

[examples/usage.ts](../examples/usage.ts) использует только public exports, временный реальный файл и production migrations. Он сохраняет settled tick, отклоняет duplicate ID, закрывает state, открывает тот же файл и сохраняет reserved attempt как interrupted. Следующий тик имеет sequence 3 и previousCompleteTick первого settled тика. Assertions исполняются до вывода:

```text
success: settled tick persisted
error: duplicate tick is conflict
recovery: interrupted attempt retained; next sequence is 3
```

Пример закрывает state до удаления только своего временного каталога. Его input/ref — технические fixtures, не реальные action/memory/snapshot records. Не подставляйте в него рабочую БД агента.

## Подключить владельца к общему state

Composition root создаёт `createSqliteAdapter` с каноническим path и общим release migration chain. Добавьте результат `await loadTimelineMigrations()` из `@polyphony/timeline/sqlite` в этот chain, затем выполните `state.checkSchema`/`state.migrate` до нагрузки. Timeline не выбирает path, не вызывает ORM migrator и не открывает connection.

Root собирает `createState(adapter, sql => bindTimeline(sql, agentId))`. Для нескольких owners передаётся тот же `sql` внутри одного callback. `agentId` и остальные общие primitives получайте через parsers `@polyphony/core-types`; декларации не копируются в timeline. Read-операции вызываются через `readSnapshot`, reserve/decide/settle/resume — через `transact`.

```typescript
// state, input и options уже подготовлены root, как в исполняемом примере.
const result = await state.transact(
  (timeline) => timeline.reserveTick(input),
  options,
);
```

Верните owner failure из callback. Успех `timeline.reserveTick` внутри callback предварительный: durable результат подтверждает внешний `result.ok`. При ошибке callback/SQL/cancellation `state` откатывает весь набор. SQL exceptions не превращаются в `TimelineFailure`; scope остаётся отравленным даже после catch. Непригодный state root закрывает и открывает заново. Handles/порт binding не выходят за callback; наружу возвращаются detached immutable DTO.

## Операции и отказы

Полные поля и signatures принадлежат [спецификации](../../../docs/modules/timeline/specification.md#публичный-контракт-t1) и declarations `/contracts`.

| Операция | Поведение |
| --- | --- |
| `reserveTick` | Следующий sequence и previousCompleteTick вычисляет timeline; ID не переиспользуется между агентами |
| `decide` | Только reserved/revision 0 → decided/revision 1 с actionRef |
| `settle` | Только decided/revision 1 → settled/revision 2 с тем же actionRef и outcomeRef |
| `resume` | Только reserved → interrupted/revision 1; decided и terminal records сохраняются |
| `readTick` | Ровно tickId либо положительный safe-integer sequence; `ok(null)` означает отсутствие записи этого агента |
| `readHead` | Последний record/sequence и последний settled tick; пустая история — 0/null/null |

Owner errors ограничены `invalid_input`, `conflict`, `incompatible`, без raw input, SQL, path или stack. Внешние storage failures имеют отдельный `kind: storage`; owner errors при `transact` обёрнуты как `kind: owner`. Не используйте `null` вместо ошибки чтения.

Wall/elapsed, epoch, mode и opaque revisions сохраняются точно. Wall clock может идти назад; elapsed не вычисляется из него. В JSON owner mapping `-0` для двух time fields явно кодируется как строка `'-0'` и восстанавливается перед общей валидацией. Это private storage encoding, не разрешение принимать строковое время на публичном входе.

## Восстановление и потерянный ответ

До `resume` root прекращает прежнюю работу и обеспечивает единственного исполнителя; epoch не заменяет OS lock или authority. После reopen reserved становится interrupted без action/outcome/episode. Для decided root получает сохранённый actionRef и выполняет согласованный reconcile владельцев; timeline не сочиняет исход и не вызывает reasoning или dispatch.

Если ответ commit потерян, root блокирует зависимую работу, открывает исправный state и сначала делает authoritative `readTick`/`readHead`. Поиск по sequence позволяет прочитать всю историю, включая interrupted attempts и допустимые пропуски. Ошибка не доказывает отсутствие записи. Не повторяйте callback или действие автоматически.

## Хранение и ограничения T1

Одна owner-таблица `timeline_ticks`, unique tick ID, unique agent/sequence и partial unique active-tick index. Drizzle mapping использует только переданный публичный `SqlScope`. Head вычисляется из записей; второй изменяемой копии нет. T1 проверяет всю историю агента при каждом методе, включая previousCompleteTick и положение active record: время и память O(n). Performance SLA/архивирование этим инкрементом не заданы; большая история потребует отдельной проверки и оптимизации без ослабления этих инвариантов.

Начальный immutable custom SQL — [0000_timeline.sql](../migrations/0000_timeline.sql); сборка доставляет его рядом с entrypoint, loader не зависит от cwd. Применяет chain только `state.migrate`. Проверяются fresh/repeat/failure; upgrade неприменим к первой версии без реального schema delta. Изменение применённого SQL даёт отказ, не сброс истории. Body rollback допустим только с совместимой схемой; новая история при этом сохраняется.

Contracts импортируют только core-types/Zod и проверяются без Node types; SQLite entrypoint содержит backend mapping и явный migration loader. Импорт не открывает БД. Нет clock, scheduler, очереди, retry, нового driver или отдельной БД. State/queue/constitution не меняются.

T1 и bounded M1 не доказывают общий commit реальных memory/runtime, существование foreign refs, субъективный цикл или E3. Эта приёмка принадлежит #49/#50 и последующим сборкам.
