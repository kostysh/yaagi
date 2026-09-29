# Работа с `state`

Перед использованием прочитайте [компактный guide](docs/usage.md), [спецификацию](../../docs/modules/state/specification.md) и [план](../../docs/modules/state/implementation-plan.md). Проверенный путь — [пример](examples/usage.ts); owner-local Drizzle/Zod adapter находится [рядом](examples/owners.ts).

- Импортируйте только публичные `/contracts`, `/sqlite`, `/node`; не private `src`/`dist`. Общие contracts остаются без SQL/Node/native API.
- Перед каждым open/check/migrate/backup/read/transact передавайте живой signal и оставшийся бюджет. `close` не отменяется. SQLite синхронна: Promise не даёт hard interrupt.
- Таблицы, revisions, DTO, validation, запросы и vector semantics принадлежат владельцу. Один общий commit собирает composition root. Не добавляйте agent lifecycle, process locks или универсальный repository.
- Доступ к SQL ограничен временем callback. Не выносите handles и не выполняйте model/network работу внутри scope. Любая SQL-ошибка отравляет scope, даже если её перехватили.
- Все исходники/скрипты — TypeScript. Прямой запуск `.ts` требует `node --experimental-strip-types`. Форматирование — Biome с одинарными кавычками; lint — Biome + ESLint + boundary.
- Обязательные команды из корня: `pnpm --filter @polyphony/state format:check`, `lint`, `typecheck`, `build`, `test`; подробный список и `test:integration`/`example` — в [README](README.md#polyphonystate).

Пакетная граница доверенного кода не является sandbox. Реальные integration tests нельзя заменить M1-двойником; M1 не доказывает durability или платформенную эквивалентность.
