# Обзор логирования: блок implementation для F-0019

Статус: финальный отчет.
Scope: текущая сессия `019d919b`, только implementation block для F-0019.

## Источники

- `.dossier/logs/F-0019/implementation-c01.md`
- `.dossier/reviews/F-0019/implementation-553147628a51.json`
- `.dossier/verification/F-0019/implementation-553147628a51.json`
- `.dossier/steps/F-0019/implementation.json`
- `<session-trace:019d919b>` строки `1551..3144`
- `.dossier/retro/session-019d919b/retrospective-20260415-144637-019d919b/scan-summary.json`

## Соответствие языку оператора

Repo overlay требует, чтобы dossier stage logs под `.dossier/logs/`, включая implementation logs, писались на языке оператора текущей сессии.

Результат: pass.

Implementation log преимущественно написан на русском. Английские включения в основном являются стабильными техническими идентификаторами: команды, id, имена файлов, enum values, model names. Это соответствует смыслу правила, потому что рабочий narrative лога ведется на языке оператора.

## Что логирование зафиксировало хорошо

- Stage log был открыт около начала implementation и до основных source edits.
- Metadata фиксирует feature id, backlog item, stage, cycle, session id, source inputs, repo overlays, planned slices, slice statuses, backlog actualization и closure checkpoint.
- Process misses полезны и конкретны:
  - `pm-001`: неверная комбинация опций `dossier-verify`;
  - `pm-002`: отсутствующая явная ссылка на `AC-F0019-01`;
  - `pm-003`: invalid `gpt-5.4-mini` audit attempts;
  - `pm-004`: пропущенные race cases в первичной реализации.
- Review events позволяют восстановить rerounds.
- Лог перечисляет финальные quality gates и их pass status.
- Backlog actualization связана с конкретными source ids и patches.
- Лог явно говорит, что результаты mini-model review не использовались.

## Gaps

### LG-001: В stage log не записан final commit SHA

Серьезность: средняя.

Факты:

- Финальный implementation commit: `0a18ccc`.
- В implementation log указано `canonical_for_commit: true` и `generated_after_commit: false`.
- Close-out text остается pre-commit состоянием.

Влияние:

- Лог валиден как intended-final-tree artifact, но final commit приходится связывать через git или session trace.
- Это увеличивает риск перепутать pre-commit artifact hash `5531476` с финальным implementation commit `0a18ccc`.

Рекомендация:

- Добавить post-commit trace-only metadata field или companion closure note:
  - `final_commit: 0a18ccc`
  - `generated_after_commit: true` только для metadata backfill, не для технического содержания.

### LG-002: Review telemetry есть, но не полностью нормализована

Серьезность: средняя.

Факты:

- Лог фиксирует review events и process misses.
- Implementation-audit policy ожидает normalized fields: `review_requested_ts`, `first_review_agent_started_ts`, `review_models`, `review_retry_count`, `review_wait_minutes`, `transport_failures_total`, `rerun_reasons`, `operator_review_interventions_total`.
- `scan-summary.json` смог посчитать review lines, но не извлек полный normalized telemetry set.

Влияние:

- Человек может восстановить review flow.
- Автоматике сложно надежно посчитать review latency, стоимость invalidated-model attempt и operator interventions без чтения narrative text.

Рекомендация:

- Сделать normalized review telemetry обязательной перед closure.
- Добавить lint warning, если есть review events, но aggregate telemetry fields отсутствуют или неполны.

### LG-003: Process misses записаны без оценки стоимости

Серьезность: низкая.

Факты:

- Лог называет каждый miss и его resolution.
- В нем нет оценки времени, потерянного на каждый miss.

Влияние:

- Retrospective может определить проблемы, но приоритизация требует ручной реконструкции timestamps.

Рекомендация:

- Добавить optional fields:
  - `detected_ts`
  - `resolved_ts`
  - `estimated_cost_minutes`
  - `preventable: true | false`

### LG-004: Active-session retrospective slicing потребовал manual overrides

Серьезность: низкая для этого отчета, средняя для повторяемости.

Факты:

- CLI не смог нативно анализировать строки `1551..3144` исходной трассы.
- Была создана temporary scoped trace.
- Stage, review и verification artifacts были переданы вручную с artifact evidence.
- Scoped trace не сохранила available-skill catalog.

Влияние:

- Текущая ретроспектива все равно evidence-backed.
- Повторение такого анализа требует слишком много ручной аккуратности.

Рекомендация:

- Добавить native `--from-line` и `--to-line`.
- Сохранять session metadata и skill catalog context при slicing.
- Улучшить discovery артефактов из file-edit events.

## Что сохранить

- Писать stage log на русском, когда текущая операторская сессия русская.
- Оставить явные `process_miss_refs`; это самый сильный retrospective signal.
- Оставить review event summaries с model names и verdicts.
- Оставить backlog patch и source-id references в implementation log.
- Оставить summary финальных verification commands в логе, а не только в terminal history.

## Предлагаемые изменения logging contract

1. Добавить fail-closed audit model telemetry:
   - каждый external audit event должен иметь `model`, `reasoning_effort`, `allowed_by_policy` и `invalidated`.

2. Добавить post-commit closure metadata:
   - записывать final commit SHA без изменения technical conclusions.

3. Добавить closure preflight fields:
   - `backlog_preflight`
   - `coverage_preflight`
   - `usage_audit_preflight`
   - `review_artifact_preflight`
   - `step_close_preflight`
   - `stage_log_freshness_preflight`

4. Добавить timing для process misses:
   - достаточно данных, чтобы ранжировать incidents без ручного replay trace.

## Вердикт

Implementation log достаточен для надежной ретроспективы и в основном соблюдает правило языка оператора. Главное улучшение нужно не в стиле текста, а в структуре: audit model validation, review aggregate telemetry и final commit linkage должны быть machine-checkable до closure.
