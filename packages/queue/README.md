# `@polyphony/queue`

Приватный ESM-пакет устойчивых заданий: типизированный enqueue, ограниченные попытки, статусы/результаты, отмена и восстановление после перезапуска. Проверяемый профиль: Node 24.21.0, Agenda 6.2.6 и SQLite adapter `@polyphony/state` на Linux x64.

Начните с [руководства](docs/usage.md) и [исполняемого примера](examples/usage.ts):

```bash
pnpm install --frozen-lockfile
pnpm --filter @polyphony/queue example
```

Нейтральное ядро хранит задания через внедрённый `StoragePort<QueueScope>`. Agenda — сменный processing adapter; SQL/Drizzle binding и миграции принадлежат queue, соединения/транзакции/файлы/backup — state. Root создаёт отдельную техническую БД очереди и закрывает её **только после успешного stop**.

Контракт — [queue.spec](../../docs/modules/queue/specification.md), порядок и evidence — [queue.plan](../../docs/modules/queue/implementation-plan.md). Общие entrypoints: пакет, `/contracts`, `/ports`; технические: `/adapters/agenda`, `/storage/sqlite`. Импорт не запускает очередь и не открывает БД.

Проверки из корня: `pnpm --filter @polyphony/queue format:check`, `lint`, `typecheck`, `build`, `test:integration`, `example`. `test` включает integration. Набор проверяет реальные Agenda/state, отдельные процессы с SIGKILL, deadline/cancel/stop, migrations, M1 и переносимые declarations. SQL artifacts копируются в dist при сборке.

Гарантия — at-least-once, **не exactly-once внешних эффектов**. Handler обязан быть повторобезопасным и соблюдать живой signal. Stop не убивает игнорирующий отмену JavaScript callback; `stop_incomplete` запрещает закрывать storage. `physiology`, runtime, canonical outbox/receipts, E3 и аппаратное отключение питания этим пакетом не реализованы.
