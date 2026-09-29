# Проверка Agenda через `state`

Локальный bounded probe по [архитектуре §8](../../docs/architecture.md) и принятому оператором плану `queue-creation.agenda.v3@60d0022b`. Это **не** production-модуль `queue`, не общий SQLite backend Agenda и не E3.

## Воспроизведение

Linux x64; Node **24.21.0**, pnpm **10.34.5**, Agenda **6.2.6**, Zod **4.6.5**. Используются публичные exports текущего `@polyphony/state`, его реальный SQLite adapter и общий TypeScript toolchain репозитория. Версии baseline не менялись.

```bash
pnpm install --frozen-lockfile --store-dir .pnpm-store --cache-dir .cache/pnpm
pnpm --filter @polyphony/state build
cd experiments/queue
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --prod
```

Тесты используют только собственные временные каталоги `queue-agenda-probe-*` и собственные child processes. `.env`, рабочие БД, сеть и внешние effects не используются тестами. Установка/audit обращаются к registry. Изолированный experiment не входит в root recursive scripts; production-сценарии должны повторить этот контур через exports будущего пакета.

## Результат 2026-09-29

Исходные **19 тестов PASS**, 0 failed/skipped, не закрыли gate: независимый Spec audit нашёл stop-дефект ([сохранённый FAIL](../../docs/validation/queue/local-queue-agenda.probe-spec.1.md)). После lifecycle-исправления полный прогон **20/20 PASS**, затем добавлен отказ start-save и весь затронутый shutdown-контур **5/5 PASS**. Format, Biome/ESLint, typecheck и build PASS. Принятие пробы требует delta-аудита нового snapshot. `pnpm audit --prod` для standalone lockfile: 0 известных advisories (это не доказательство отсутствия уязвимостей; linked workspace dependencies проверяются своим контуром).

| Проверяемая граница | Исполняемое evidence в `probe.test.ts` |
| --- | --- |
| Настоящая Agenda → публичный `JobRepository` → `StoragePort` → SQLite | `Agenda processes a real state record…`: эффективные WAL/FULL, durable status/result, reopen |
| ID/hash и конкурирующий enqueue | Тот же тест: совпадающий запрос не создаёт вторую запись; иной payload отклоняется |
| Неоднозначный enqueue | `a lost enqueue acknowledgement…`: реальный commit, потерянный ответ порта, повтор прежнего ID/hash |
| Резервирование ≠ попытка | `SIGKILL reserved…` с бюджетом 1 и 3; после reservation attempts = 0 |
| Commit попытки до handler, общее число попыток | `SIGKILL started…`, `SIGKILL handled…`, `two crashed processes…`; бюджет не возвращается и не сбрасывается при рестартах |
| Неоднозначный commit попытки | `lost start acknowledgement…`: чтение той же reservation подтверждает commit, handler вызывается один раз, attempts = 1 |
| Crash после commit результата до ответа | `SIGKILL completed…`: после reopen completed не запускается повторно, результат сохранён |
| Старая попытка | `old completion, touch and single/bulk unlock…`: непрозрачный Agenda JobId включает reservation token; публичный ID задания неизменен |
| Конкурирующие consumers | `two independent state clients…`: один победитель reservation, бюджет пока не списан |
| Отложенные задания | `delayed job survives reopen…`: без повторного enqueue; callback не раньше сохранённого notBefore |
| Остановка | Три `stop…` / `bounded stop…` теста: live abort, callback accounting, задержанная terminal запись; незавершённая остановка — ошибка, не разрешение закрыть storage |
| Watchdog → поздний terminal callback | `watchdog expiry cannot make stop succeed…`: настоящий watchdog error, живой handler, удержанный final-save; incomplete до его завершения. `rejected start save…` проверяет отсутствие зависшего lifecycle после отказа до handler |
| Ошибка сохранения результата | `Agenda complete event…`: даже при событии complete ошибка durable write не превращается в completed/result |

Межпроцессные kill-точки задаются IPC barriers, не sleeps. Ожидание delayed job проверяется фактическим временем входа; polling/timers принадлежат Agenda. Низкоуровневые fault guarantees SQLite не дублируются.

## Что доказано и что ещё нет

Публичного async `JobRepository` достаточно для проверенного polling-пути через `state`; собственный драйвер, private patch/fork и второй scheduler не использованы. `ownsConnection: false`: Agenda не закрывает чужое хранилище. Composition root мигрирует и закрывает его после успешной остановки. Queue-local schema и mapping в этой пробе намеренно минимальны; production потребует owner-local Drizzle/Zod bindings.

Существенные отличия от готовой очереди: одна числовая fixture, нет production API, namespace/версий DTO, handler deadline/window, длительных heartbeat-сценариев, coordinated cleanup и M1. Административные/search/cron методы repository явно отклоняются. Результаты не удаляются вообще; это проверяет сохранность до будущей согласованной очистки, но не её протокол. Два storage-файла и owner outbox/receipts здесь не реализованы. Нет power-loss, полного E3, sandbox, mobile/cloud и exactly-once внешних effects.

Найденные особенности, обязательные для production adapter:

1. `Job.run()` подавляет ошибку финального `saveJobState`; события `success/complete` не являются подтверждением результата. Результат фиксируется отдельным owner-local commit с проверкой token и читается из `state`.
2. `stop()` не ждёт handlers; `drain()` не учитывает все repository calls и промежутки между callbacks. Нужен учёт полного lifecycle от начала start-save до завершения terminal-save, отдельно от handlers и in-flight calls. Отказ первого save обрабатывается отдельно: в Agenda он находится перед try/finally, terminal callback после него не будет. Таймаут ожидания возвращает incomplete, не «убивает» callback; root сохраняет storage открытым и повторяет stop после реального завершения. Успешный stop закрывает admission последующих library I/O.
3. На первоначальном прогоне с lease **400 ms** обнаружена гонка: Agenda очищает `lockedAt` до завершения async terminal save, watchdog может сообщить `no lockedAt`. Тестовая lease изменена на **2000 ms**, но это не upstream fix. Аудитор затем воспроизвёл F1 и при 2000 ms: successful stop до позднего terminal-save после watchdog expiry. Это блокировало текущий gate, а не только production. Regression исправляет shutdown accounting; production дополнительно обязан сохранять durable truth и лимит реально выполняющихся callbacks независимо от watchdog/event bookkeeping, проверять heartbeat/slow I/O.
4. Первая попытка читать `PRAGMA` через scoped SQL была отклонена `state` по его контракту. Проверка использует разрешённые read-only table-valued pragma SELECT, API `state` не изменялся.

Источники: [release 6.2.6](https://github.com/agenda/agenda/releases/tag/agenda@6.2.6), [JobRepository](https://github.com/agenda/agenda/blob/agenda@6.2.6/packages/agenda/src/types/JobRepository.ts), [Job](https://github.com/agenda/agenda/blob/agenda@6.2.6/packages/agenda/src/Job.ts), [JobProcessor](https://github.com/agenda/agenda/blob/agenda@6.2.6/packages/agenda/src/JobProcessor.ts). Решение о переносе в production опирается на этот исполняемый контур, не только на описание upstream.
