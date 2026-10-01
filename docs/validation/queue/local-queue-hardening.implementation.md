# Hardening `queue`: поведение и доказательства

- Document ID: `queue.validation.local-queue-hardening.implementation`
- Module ID: `queue`
- Дата: 2026-10-01
- Источники: поручение оператора устранить блокер всего модуля, [queue.spec](../../modules/queue/specification.md), [Q5 плана](../../modules/queue/implementation-plan.md#q5-hardening-после-повторных-ci-падений)
- Исходный snapshot: `0a47c5fbdbcd62473bab8c0acddf2fbe1efa4a72`
- Исходный независимый аудит: **non-compliant / FAIL**, [неизменные SPEC-H1–H3](local-queue-hardening.code-spec.1.md)

## Причины и исправления

1. **Commit и acknowledgement — разные границы.** Finish уже сохранял completed/retryable outcome и снимал lease, пока его Promise ещё ожидал ACK. Следующий heartbeat останавливал исправную очередь. Touch и его unknown-ACK readback теперь без записи подтверждают durable outcome последней законченной попытки того же token. Проверяются name/version, отсутствие lease, последний token, завершённые job/attempt и отсутствие cancellation/interruption. Это подтверждение завершённого поколения, не конкретного renewal commit. Локального registry нет; порядок settlement finish и ранее принятого heartbeat не влияет на результат. Genuine storage error, отмена и новое поколение сохраняют conflict/fail-closed; retry продолжает Agenda.
2. **Payload codec расходует тот же deadline, что handler.** Core сохраняет абсолютный срок durable попытки/window через чистый getter остатка Context. Typed bridge после decode проверяет signal и оставшееся время, передаёт handler положительный статический budget; при expiry handler не вызывается. Transform codec сохраняется. Core классифицирует пересечение срока как timeout до handler_failed и сохраняет проверки после handler/result codec.
3. **Завершённый Promise не доказывает своевременную остановку.** Дополнительный public-API witness координатора удержал acknowledgement настоящего Agenda stop, пересёк monotonic caller budget и отпустил его до доставки timer. До исправления API возвращал ok вместо stop_incomplete. `within` и последний переход core в idle теперь проверяют общий budget после settlement. Повторный stop с новым budget завершается после фактического освобождения ресурсов.

Остановка упрощена с `Agenda.drain → Agenda.stop` до одного публичного `stop(false)`. На Agenda 6.2.6 drain уже удалял processor, поэтому следующий stop не выполнял полезной работы. Сохранён необходимый учёт реальных callbacks, принятых storage calls, полного Job.run lifecycle и bounded watchdog tail; native running bookkeeping не подменяет эту границу.

## Heartbeat и предел простоты

Agenda не продлевает lock автоматически: короткое задание может закончиться внутри lockLifetime, длинное вызывает [`job.touch()`](https://github.com/agenda/agenda#touch). Наш adapter делает это автоматически. Фиксированная конечная lease без продления допускает recovery другой очередью, пока долгий handler ещё жив; бесконечная lease исключает crash recovery. Увеличение lease откладывает recovery и увеличивает watchdog tail при stop, а удаление renewal также меняет действующую remote-cancel detection. Поэтому R9/R10/R13–15 сохранены, новый scheduler, fork/private patch, API, схема и зависимости не добавлены.

Продление не гарантирует владение при произвольно долгом блокировании event loop или storage. В этом случае lease может быть потеряна, текущий callback отменяется кооперативно, новые работы прекращаются до restart. Внешний эффект не отзывается; handler должен оставаться повторобезопасным. Это durable at-least-once локальный модуль, не exactly-once, runtime/physiology, multi-host или аппаратный power-loss/E3.

## Проверяемые сценарии

- Истечение срока до входа handler и после его доказанного входа проверяются раздельно с управляемым Date.now; после входа deadline пересекается синхронно без доставки timer. Нет ожидания, что durable begin/read успеет за 200 ms, busy-spin и ослабления assertion.
- Codec: частично потраченный budget, полный expiry, ограничение window и отмена во время decode; преобразованный payload доходит до handler. Window timer контролируется только в сценариях задержанной timer delivery, остальные lifecycle/recovery tests используют настоящие timers.
- Настоящий heartbeat после finish commit до ACK для completed и retry; отдельно потеря ACK уже сохранённого heartbeat с readback concurrent finish в обоих порядках — до и после finish settlement. В обоих порядках retry выполняется без restart. Replacement lease при собственном pending finish остаётся защищена.
- Два настоящих Agenda consumers: competitor выполняет scan после первоначального lease horizon, пока подтверждённое renewal защищает тот же единственный handler. Первый heartbeat сам по себе больше не считается доказательством долгой lease.
- Caller deadline при held stop acknowledgement; полный прежний corpus genuine renewal failures, slow reserve/begin/final save, watchdog, concurrency, fencing, shutdown без оставшихся timers, SIGKILL/recovery и общий budget.

Новые regression tests на исходной реализации: **2 PASS / 6 FAIL**, без cancelled/skipped; корректный pre-handler expiry и replacement fencing уже проходили. Отдельный late-stop witness до изменения budget check — **FAIL**, фактическое `ok` вместо ожидаемого `stop_incomplete`. После исправления начальный scoped suite: **27/27 PASS**; добавленный readback сценарий — **1/1 PASS**. Полные gates, целевые повторы и независимые аудиты фиксируются ниже после завершения.

Локальные журналы координатора: `/tmp/yaagi-queue-hardening-baseline-regressions.log`, `/tmp/yaagi-queue-hardening-late-stop-red.log`, `/tmp/yaagi-queue-hardening-focused.log`, `/tmp/yaagi-queue-hardening-touch-readback.log`. Постоянные воспроизводимые сценарии находятся в `packages/queue/test/hardening.test.ts`, `adapter-regression.test.ts` и `lifecycle.test.ts`; временные журналы не нужны для использования пакета.

## Gates, аудит и поставка

Frozen install (`--store-dir .pnpm-store`), root `format:check`, `lint` (Biome/ESLint/boundaries), `typecheck`, `build`, `test`, отдельный queue `example` и `git diff --check` — **PASS**. State: **53/53**; queue: **51/51**, без failed/cancelled/skipped; core-types type/import checks PASS. API, migrations и dependency baseline unchanged. Журналы: `/tmp/yaagi-queue-hardening-gate-{install,format,lint,typecheck,build,test,example,diff}.log`.

Дополнительный compiled production прогон с affinity на двух CPU и `--test-concurrency=2`: **51/51 PASS**, 69.0 s, без failed/cancelled/skipped; журнал `/tmp/yaagi-queue-hardening-two-cpu.log`. Он проверяет чувствительность к медленному исполнению и наложению файлов, не заменяет явные barriers/negative assertions и не используется как retry красного CI.

На `553bf1e6aa4761a58b6028b198fec05c27fcd217` прежний Spec-аудитор: H2/H3 CLOSED, **code non-compliant / FAIL**, Q5 **compliant / PASS**. Дополнительный обратный ACK witness выявил слишком короткий lifetime локального finishing Set; [отрицательный результат №2](local-queue-hardening.code-spec.2.md) сохранён. Security Reviewer `/root/queue_hardening_security`, Astra/xhigh: **PASS (scoped) / PASS**, самостоятельно 36/36 targeted tests и 3/3 witnesses cancellation/interrupted/parameterized SQL-shaped identifiers; без нового security finding. Этот PASS ограничен своим snapshot.

Уточнённое исправление убирает Set и подтверждает только durable последнее поколение. Постоянный тест обратного ACK-порядка воспроизвёл unknown_commit на прежней сборке; новая версия проверяет оба порядка, неизменную запись после confirmation и автоматический второй вызов без restart. Обе ветки и весь queue corpus прошли 52/52 в обычном root-прогоне и на двух CPU; state 53/53, остальные root gates и example PASS (`/tmp/yaagi-queue-hardening-gate2-*.log`).

Проверка соседнего прежнего условия в adapter нашла ещё одну зависимость от Promise phase: поздний conflict при настоящей replacement lease подавлялся после execute settlement. Public-API regression на такой порядок дал `lifecycle.error=undefined` вместо conflict. Поскольку нормальное завершение теперь подтверждает core, исключение `!executing && conflict` удалено; все оставшиеся ошибки renewal сохраняют fail-closed, включая поздние. Тест replacement выполняется до и после execute settlement. Это прямой blast radius H1/R13, не новая область системы; `/tmp/yaagi-queue-hardening-late-conflict-red.log`.

После последней дельты root `format:check`, `lint`, `typecheck`, `build`, `test`, queue `example` и `git diff --check` — **PASS**. Queue: **53/53**; state: **53/53**, без failed/cancelled/skipped; core-types checks PASS. Frozen install выполнен в предыдущем gate2-прогоне, зависимости после него не менялись. Журналы: `/tmp/yaagi-queue-hardening-final-{format,lint,typecheck,build,test,example,diff}.log`.

Все 12 постоянных hardening scenarios отдельно прошли на двух CPU: **12/12 PASS**, без failed/cancelled/skipped; `/tmp/yaagi-queue-hardening-final-boundaries.log`. Это включает оба ACK-порядка и настоящий replacement conflict до/после execute settlement.

Требуется ограниченный Spec/Security re-audit нового committed snapshot. PR/post-merge success и окончательная приёмка пока не заявляются.
