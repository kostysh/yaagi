# Logging review

Status: validated_by_agent

## Summary

Логирование в этой сессии было достаточно хорошим, чтобы восстановить правду по закрытию `F-0020` и `F-0021`, но недостаточно хорошим, чтобы автоматическая ретроспектива сама собрала полную картину без ручной валидации.

Самые сильные стороны:

- stage logs по `F-0020` и `F-0021` существуют и содержательно полезны;
- verify/review/step-close artifacts дают жёсткий machine-checkable closeout trail;
- timing evidence для `F-0021` уже оформлено как durable artifact.

Самые заметные пробелы:

- инциденты уровня “хост завис, потребовался reset” не фиксируются как нормализованные structured events;
- trace anchors отсутствуют, из-за чего retrospective tooling не смогло автоматически связать stage logs с timeline;
- ресурсные аномалии smoke-прогона видны в разговоре и на скриншотах, но не превращены в машинно читаемую evidence series.

## What worked

### 1. Stage logs стали полезными narrative артефактами

После пользовательского замечания про язык логов narrative пошёл на русском и дальше уже оставался пригодным для чтения оператором. Это улучшило traceability и уменьшило когнитивный шум.

### 2. Machine-checkable closure trail был достаточно строгим

Для `F-0020` и `F-0021` сохранились:

- verification artifacts
- review artifacts
- step-close artifacts
- backlog actualization artifacts

Этого хватило, чтобы в конце отличать реальные closeouts от промежуточных claims.

### 3. Отдельное timing evidence было хорошим решением

`<project-root>/.dossier/evidence/F-0021/implementation-smoke-timing-c01.json` уже содержит:

- baseline
- candidate run
- warm-cache assumptions
- manifest/image identity

Это именно тот тип артефакта, который хорошо переживает ретроспективу.

## Logging gaps

### 1. Нет machine-readable incident log для runtime аварий

Сессия содержит несколько операторских сообщений о зависании системы и аппаратном reset, но ни stage logs, ни closure artifacts не имеют нормализованной записи такого инцидента.

Последствия:

- трудно машинно отличить “долгий smoke” от “аварийного smoke”
- retrospective tooling не может автоматически поднять критичность таких событий

### 2. Нет trace anchors в stage logs

Stage logs не содержат ссылок на session trace boundaries:

- start line
- first material edit
- review request line
- final pass line
- commit line

Из-за этого auto-scan не смог собрать `stageLogs`, хотя trace прямо показывает создание и изменение этих файлов.

### 3. Недостаточно нормализована информация о rerounds

В trace хорошо видны audit rerounds, но в логах не хватает стабильных полей для них, например:

- `review_round`
- `finding_ids`
- `reround_reason`
- `resolved_by_artifact`

Это особенно заметно в `F-0007/CF-028` и `F-0021`, где несколько rerounds были содержательно важнее основного narrative.

### 4. Не зафиксированы resource envelope assumptions для heavy smoke

Важные для этой сессии факты жили в разговоре, а не в structured logs:

- warm or cold cache
- one or multiple heavy runtimes
- expected memory-pressure class
- allowed retry budget
- whether repeated model download is acceptable

Именно из-за отсутствия этих полей оператору пришлось несколько раз отдельно напоминать про нескачивание весов и опасность full smoke.

### 5. Скриншоты и operator-side observations не входят в evidence chain

Оператор приложил скриншоты с памятью, но они остались только в разговоре. В dossier/evidence цепочке нет даже компактной ссылки на такие host observations.

## Recommendations

1. Добавить в stage logs блок `incident_events`:
   - `incident_id`
   - `category`
   - `severity`
   - `host_reset`
   - `operator_reported`
   - `followup_action`

2. Добавить обязательные `trace_anchor_lines`:
   - `stage_start_line`
   - `first_substantive_edit_line`
   - `review_request_line`
   - `final_pass_line`
   - `commit_line`

3. Нормализовать reround telemetry:
   - `review_rounds_total`
   - `failed_rounds_total`
   - `finding_ids`
   - `resolved_findings`

4. Для heavy runtime verification ввести `resource_envelope`:
   - `warm_cache`
   - `expected_runtime_instances`
   - `heavy_dependencies`
   - `download_policy`
   - `smoke_mode`

5. Для operator-provided screenshots и host observations ввести lightweight evidence references, чтобы их можно было включать в retrospective manifest без хранения абсолютных локальных путей.

## Final verdict

Логирование в этой сессии нельзя назвать слабым: оно позволило закрыть работу канонически и восстановить финальный truth. Но оно остаётся недостаточно structured для incident-heavy runtime work. Основной дефицит не в том, что артефактов мало, а в том, что runtime incidents, rerounds и trace anchors всё ещё живут в чате, а не в машиночитаемом telemetry слое.
