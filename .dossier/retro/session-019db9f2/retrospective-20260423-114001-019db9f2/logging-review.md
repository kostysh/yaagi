# Обзор логирования

Статус: final, проверено агентом

## Сводка

Качество логирования в этой сессии было рабочим, но не automation-grade.

Плюсы:

- stage log достаточно структурированы, чтобы восстановить порядок стадий, timestamps, review rounds и финальные closure evidence
- implementation log зафиксировал реальные review findings и process misses
- backlog actualization и пути к review artifact часто были записаны явно

Минусы:

- надёжная session linkage неполная
- использование skill не структурировано
- retro bundling потребовал ручных override
- текущие эвристики неверно классифицируют некоторые текстовые поля, из-за чего метрики шумят

Итоговый вердикт: достаточно для ручной forensic reconstruction, недостаточно для low-friction automated retrospective reporting.

## Наблюдаемые сильные стороны

### 1. Базовые stage metadata присутствуют

Четыре F-0024 stage log содержат:

- stage id и cycle id
- start и transition timestamps
- executed audit classes
- review events с artifact path
- final pass timestamps

Это минимально достаточная база, чтобы восстановить high-level lifecycle.

### 2. Качество implementation log заметно лучше, чем кажется по draft retro scan

Implementation log фиксирует:

- конкретные review findings
- конкретные process misses
- финальный набор closure verification
- детали финального external audit pass

Это хорошее operator-grade evidence. Проблема не в том, что implementation log беден по содержанию. Проблема в том, что окружающий linkage и schema normalization слабее самого narrative.

### 3. Review и verification artifacts существуют и долговечны

Нужные review, verification и step-close JSON artifacts существуют и достаточны, чтобы подтвердить финальный outcome:

- intake FAIL, затем PASS
- spec PASS
- plan PASS
- implementation PASS с exact-commit audit persistence
- implementation close с `process_complete: true`

## Высокоимпактные пробелы

### L-01: propagation `session_id` сломан

Доказательства:

- stage log несут `trace_locator_kind: session_id`
- при этом те же документы ставят `session_id: null`

Воздействие:

- automated retro tooling не может надёжно связать stage artifact с исходной сессией без trace scraping или ручного override

Рекомендация:

- сделать `session_id` обязательным во всех stage log и stage-state artifact
- добавить `trace_file_hint`, чтобы точный session file можно было найти без внешнего history lookup

### L-02: нет структурированного описания skill usage

Доказательства:

- `scan-summary.json` сообщает `skillsReferenced: {"unknown": 4}`
- trace и commentary ясно показывают, что именованные skill использовались

Воздействие:

- skill analysis зависит от хрупкой интерпретации trace
- retrospective не может отличить "skill не использовался" от "skill использовался, но не был записан"

Рекомендация:

- добавить `skills_used`
- добавить `skill_issues`
- добавить `skill_followups`

Эти поля должны жить в stage log, а не только в conversational trace.

### L-03: retro bundling требует ручного подключения артефактов

Доказательства:

- текущий retro scan потребовал явных `--stage-log`, `--review-artifact` и `--verification-artifact`
- анализ текущей сессии также потребовал `--until-line 5056`

Воздействие:

- retrospective workflow воспроизводим только оператором, который уже знает точные артефакты
- это съедает часть пользы от канонического retro tool

Рекомендация:

- добиться, чтобы каждый stage log и step-close artifact ссылался на соседние review/verification artifact в machine-complete форме
- обеспечить, чтобы retro index data напрямую связывали session, feature, cycle и artifact bundle

### L-04: свободный текст в process misses слишком эвристичен

Доказательства:

- несколько stage log содержат `none` или `none.`
- при этом `scan-summary.json` всё равно показывает `processMissesTotal: 5`

Воздействие:

- retrospective metrics завышают число проблем
- "проблем нет" и "проблема есть" не различаются парсером надёжно

Рекомендация:

- заменить свободный текст в разделе `Process misses` на структурированные массивы
- использовать пустой массив вместо текстового `none`

### L-05: trace-derived scope слишком шумный

Доказательства:

- generated draft retro scope включил backlog item и feature, которые не входили в реальную F-0024 phase под анализом

Воздействие:

- auto-generated report выглядит шире реального scope
- signal-to-noise падает, а ручная чистка становится обязательной

Рекомендация:

- добавить явные `primary_feature_id`, `primary_backlog_item_key` и `phase_scope` в retro scan input или stage artifacts
- предпочитать artifact-linked scope, а не широкое извлечение упоминаний из trace

## Рекомендуемые расширения схемы

### Frontmatter stage log

Добавить:

- `session_id`
- `trace_file_hint`
- `trace_line_start`
- `trace_line_end`
- `skills_used`
- `skill_issues`
- `review_artifacts`
- `verification_artifacts`
- `step_artifact`
- `final_delivery_commit`
- `final_closure_commit`

### Структурированная модель process miss

Заменить свободный текст на такой формат:

```yaml
process_misses:
  - id: IMPL-001
    category: audit-method
    severity: high
    resolved: true
    note: Initial external audit used forked context and was rerun non-forked.
```

### Модель таймингов по стадии

Добавить:

- `active_work_minutes`
- `waiting_for_review_minutes`
- `reround_minutes`
- `closure_minutes`

Эти значения не обязаны быть идеальными, но даже приблизительная структура даст ретро-анализу больше пользы, чем восстановление по сырым timestamp.

## Рекомендуемые process check

1. Падать при закрытии стадии, если отсутствует `session_id`.
2. Падать при закрытии стадии, если в metadata нет обязательных review artifact.
3. Предупреждать, если стадия записывает внешний независимый review, но фактический метод исполнения был forked-context или иным образом не независим.
4. Предупреждать, если `Process misses` остаётся свободным текстом вместо структурированных данных.
5. Предупреждать, если retro scan расширяет scope за пределы stage-linked feature или backlog item set.

## Предлагаемый порядок внедрения

### Немедленно

1. Починить propagation `session_id`.
2. Добавить структурированные массивы artifact link.
3. Перестать использовать текстовое `none` для process misses.

### В ближайшее время

4. Добавить структурированное описание skill usage.
5. Добавить trace line anchors.
6. Добавить final commit anchors в stage closure metadata.

### Позже

7. Улучшить retro-cli artifact discovery и narrowing scope, чтобы ручные override стали исключением, а не нормой.

## Финальная оценка

В репозитории уже есть достаточная logging discipline, чтобы поддержать серьёзную human retrospective. Это важная база. Следующий шаг не в том, чтобы "логировать больше", а в том, чтобы лучше связывать и структурировать данные. Если session id, skill usage, artifact link и process miss станут machine-complete, этот retrospective можно будет собирать с гораздо меньшим ручным вмешательством и с меньшим объёмом последующей чистки.
