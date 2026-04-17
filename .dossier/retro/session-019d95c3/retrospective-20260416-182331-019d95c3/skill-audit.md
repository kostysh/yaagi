# Skill audit

Status: validated_by_agent

## Summary

В этой сессии реально определяющими оказались четыре skill-контура:

- `backlog-engineer`
- `dossier-engineer`
- независимые audit/review агенты
- `retrospective-phase-analysis`

Остальные навыки появлялись эпизодически, но не формировали основную траекторию работы. Качество результата определялось не широтой skill catalog, а тем, насколько жёстко сработали backlog/dossier contracts и независимый audit loop.

## Findings by skill

### `backlog-engineer`

#### Что сработало

- Канонические read/write команды оказались достаточными для всей backlog lifecycle работы.
- После перехода на canonical runtime через `node <skills-root>/backlog-engineer/scripts/backlog-engineer.mjs ...` дальнейшая работа шла корректно.
- Skill выдержал сложные кейсы:
  - обычный queue/status flow
  - source registration
  - packet creation
  - patch-item actualization
  - follow-up extraction для `CF-028`

#### Что не сработало

- Навык в mixed-skill контексте не fail-close-ит операторские backlog reads.
- Именно из-за этого агент после `queue` позволил себе enrichment через `.backlog/state.json`.

#### Вывод

Проблема была не в backlog CLI и не в её command surface. Проблема была в отсутствии жёсткого interop guardrail, который запрещал бы downstream shortcut через utility-owned files.

#### Рекомендация

Усилить mixed-skill guidance правилом:

- operator-facing backlog truth читается только через canonical `backlog-engineer` commands;
- `queue -> items` обязателен, если нужны поля beyond chain structure;
- `.backlog/*`, packets и patches не являются operator-facing read surface.

### `dossier-engineer`

#### Что сработало

- Skill удержал строгий docs-as-code workflow на длинной и хаотичной сессии.
- Через него были последовательно закрыты:
  - `feature-intake`
  - `spec-compact`
  - `plan-slice`
  - `implementation`
  - `change-proposal`
- Verify/review/step-close bundle реально предотвращал тихое расхождение между “кажется готово” и “машинно закрыто”.

#### Что не сработало

- В начале сессии stage-log был записан не на языке оператора; правило существует, но не сработало как ранний fail-fast.
- Несколько раз в ходе `F-0020` и `F-0007/CF-028` возникал риск преждевременного closeout claim до полной синхронизации truth.

#### Вывод

`dossier-engineer` полезен именно своей жёсткостью, но его guidance стоило бы усилить ещё в двух местах:

- строгая фиксация языка stage logs;
- более явное разделение `closeout intent` и `process_complete`.

#### Рекомендация

Добавить в workflow/logging references проверяемые поля:

- `operator_language_confirmed`
- `closeout_intent`
- `process_complete`

### Независимые audit/review агенты

#### Что сработало

Это был самый полезный operational механизм сессии. Агенты не дублировали локальную проверку, а находили реальные дефекты:

- незакрытый intake bundle
- неполный spec contract
- bad backlog mutation trail
- premature closeout
- missing `pg` timeout boundary
- stale timing evidence fingerprint

#### Что не сработало

- В середине сессии агент всё ещё повторно спрашивал авторизацию на запуск агентов, хотя пользователь уже явно расширил её на всю сессию.

#### Вывод

Независимый audit loop подтвердил свою ценность. Главная слабость была не в самих агентах, а в session memory discipline основного исполнителя.

#### Рекомендация

Если пользователь дал session-scoped authorization на агентный аудит, это должно трактоваться как устойчивый runtime fact до конца сессии.

### `retrospective-phase-analysis`

#### Что сработало

- Skill корректно требует сначала найти session trace и провести boundary slicing.
- CLI быстро создал canonical run bundle под `.dossier/retro/`.
- Privacy contract для output paths соблюдён.

#### Что не сработало

- Автоматический scan не смог нормально связать trace-changed stage logs и review artifacts.
- В результате черновой report показал ложную картину:
  - `Stage logs analyzed: 0`
  - `Candidate incidents: 0`

#### Вывод

Skill уже годится как scaffold/tooling layer, но пока не годится как fully automatic retrospective writer для сложной агентной сессии без ручной валидации.

#### Рекомендация

Нужно улучшить scan heuristics:

- связывать trace-changed `.dossier/logs/...` с `stageLogs`
- связывать trace-touched review/verification/step artifacts с feature scope
- поднимать candidate incidents из user-reported resets, aborted turns и repeated rerounds

## Cross-skill conclusions

1. Самая большая проблема сессии возникла не из-за слабой реализации конкретного skill, а на стыке навыков:
   - `backlog-engineer` владеет truth
   - `dossier-engineer` оркестрирует workflow
   - но между ними не хватило fail-closed read contract

2. Самая большая удача сессии тоже была межскилловой:
   - `dossier-engineer` держал bundle discipline
   - независимые audit agents ломали premature closures
   - это несколько раз спасло от ложного `done`

3. `retrospective-phase-analysis` в текущем виде нужно рассматривать как assistive tool, а не как self-sufficient narrator.

## Priority improvements

1. Fail-close backlog reads в mixed-skill repos.
2. Сделать session-scoped agent authorization устойчивым фактом исполнения.
3. Усилить `dossier-engineer` guardrails для language/closeout discipline.
4. Улучшить auto-linking артефактов в `retrospective-phase-analysis`.
