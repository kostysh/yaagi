# Аудит skills: блок implementation для F-0019

Статус: финальный отчет.
Scope: текущая сессия `019d919b`, только implementation block для F-0019.

## Итог

Набор skills позволил прийти к корректному финальному состоянию, но не предотвратил лишние rerounds. Самый сильный результат дал independent code review: он поймал реальные race defects. Самый слабый участок: audit orchestration, потому что обязательные external audits сначала стартовали без явного model control и ушли на `gpt-5.4-mini`.

## dossier-engineer

Что помогло:

- Потребовал structured implementation stage log.
- Потребовал review, verification и step-close artifacts.
- Потребовал backlog/dossier alignment, а не только source changes.
- Разделил external audit stack на spec-conformance, code, security и review-artifact capture.

Что не закрыло риск:

- Implementation audit policy требует spawned agents и telemetry, но не делает model selection fail-closed.
- Workflow позволил обнаружить closure requirements внешним spec review, вместо того чтобы заставить локальный DoD preflight до review.
- Stage log freshness правила полезны, но финальный artifact остался pre-commit. Это допустимо, однако хуже для последующей трассируемости.

Что изменить:

- Добавить обязательный external-audit launch checklist: model, reasoning effort, skill, scope и disallowed-model guard.
- Добавить DoD preflight прямо перед final spec-conformance review.
- Добавить optional post-commit trace-only metadata для final commit SHA.

## backlog-engineer

Что помогло:

- Сделал `CF-018` actualization конкретной через source registration и applied patches.
- Поймал необходимость cleanup для state и todos.
- Поддержал artifact integrity после implementation.

Что не закрыло риск:

- Backlog actualization произошла достаточно поздно, чтобы первый spec-conformance review нашел ее неполной.

Что изменить:

- Считать backlog actualization planned implementation subtask или closure subtask, а не финальной уборкой.
- Добавить `backlog source ids present` в DoD preflight.

## spec-conformance-reviewer

Что помогло:

- Поймал missing backlog actualization и missing real usage audit evidence.
- Поймал incomplete DoD до финального закрытия.
- Дал финальный PASS только после review и verification artifacts.

Что не закрыло риск:

- Первый spec review был запрошен слишком рано, до зеленого local closure preflight.

Что изменить:

- Ранний spec-conformance review использовать только для проверки известного gap.
- Final-like spec-conformance review запускать после DoD preflight.

## code-reviewer

Что помогло:

- Нашел два самых важных implementation defects:
  - race-unsafe lifecycle event insertion;
  - shutdown evidence race вокруг tick admission.
- Потребовал обновить implementation log после fixes.
- Дал PASS после исправлений.

Что не закрыло риск:

- Проблема не в skill. Code review сработал хорошо.

Что изменить:

- Передавать code reviewer заранее заполненный adversarial-risk checklist из `plan-slice`.

## security-reviewer

Что помогло:

- Перепроверил финальный changed scope после race fixes.
- Не нашел confirmed vulnerabilities.
- Оставил видимыми residual risks: DB grants/RLS и shutdown fail-closed behavior.

Что не закрыло риск:

- Первый invalid security review был испорчен mini-model launch error. Это проблема orchestration, а не security-reviewer.

Что изменить:

- Security audit launch должен блокироваться, если model policy не удовлетворена.

## git-engineer

Что помогло:

- Implementation завершился clean Conventional Commit:
  - `0a18ccc feat: implement f-0019 lifecycle consolidation`.
- Предыдущий refresh отчетов был закоммичен отдельно до implementation.

Что не закрыло риск:

- Существенных проблем в implementation block не видно.

Что сохранить:

- Для dossier-backed implementation commits оставлять в commit body список gate checks и ключевые artifact paths.

## typescript-engineer, typescript-test-engineer, node-engineer

Что помогло:

- Финальная реализация прошла typecheck, lint, unit tests и smoke tests.
- Runtime shutdown и admission barrier были доведены до корректного состояния.
- После review были добавлены недостающие adversarial behaviors.

Что не закрыло риск:

- Первичные тесты недостаточно проверяли lifecycle insert conflict и shutdown admission race.
- Это скорее gap в proof planning, чем в TypeScript mechanics.

Что изменить:

- Для runtime lifecycle features писать adversarial tests до того, как первый local verification считается содержательным.
- В test planning явно добавлять concurrent inserts, replay idempotency, shutdown admission barriers и snapshot evidence order.

## retrospective-phase-analysis

Этот skill использовался уже после implementation block, а не во время него.

Что помогло:

- Заставил явно определить session id и границы analysis.
- Разделил факты, inferred causes и recommendations.
- Потребовал отдельные skill audit и logging review.

Что не закрыло риск:

- CLI не умеет нативно анализировать active session по диапазону `from-line` / `to-line`; потребовалась временная scoped trace.
- Stage/review/verification artifacts пришлось добавлять manual overrides.
- Scoped trace потеряла skill catalog context.

Что изменить:

- Добавить native active-session slicing.
- Улучшить artifact discovery из patch/file-edit events.
- Сохранять skill catalog evidence или принимать его отдельным input.

## Общий вердикт по skills

Skills поймали важные дефекты до коммита, но слишком многое было отложено на late review. Методика должна сдвинуть два контроля раньше: mandatory audit model validation до spawn reviewers и adversarial proof planning до начала implementation.
