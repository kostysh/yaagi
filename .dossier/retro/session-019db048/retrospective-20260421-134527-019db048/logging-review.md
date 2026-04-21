# Logging Review: Сессия 2026-04-21

Status: validated against scan summary and dossier artifacts

## Summary

По `F-0023` в этой сессии есть полный canonical stage-log chain:

- `feature-intake`
- `spec-compact`
- `plan-slice`
- `implementation`

Это уже хороший baseline. Логи содержат стабильные ids, timestamps, stage state, and human-readable narrative. Самое ценное наблюдение: implementation log не скрыл runtime defect, а прямо зафиксировал process miss про SQL/materialization defect.

Но ретро также показало, что текущая telemetry shape еще недостаточна для надежной автоматической реконструкции фазы без участия агента.

## Observed strengths

### 1. Full stage coverage exists

Для `F-0023` есть все ключевые stage logs от intake до implementation:

- [.dossier/logs/feature-intake/F-0023--fc-F-0023-mo8rctl7.md](/code/projects/yaagi/.dossier/logs/feature-intake/F-0023--fc-F-0023-mo8rctl7.md)
- [.dossier/logs/spec-compact/F-0023--fc-F-0023-mo8rctl7--spec-compact-b5dbf449.md](/code/projects/yaagi/.dossier/logs/spec-compact/F-0023--fc-F-0023-mo8rctl7--spec-compact-b5dbf449.md)
- [.dossier/logs/plan-slice/F-0023--fc-F-0023-mo8rctl7--plan-slice-d2cff2ee.md](/code/projects/yaagi/.dossier/logs/plan-slice/F-0023--fc-F-0023-mo8rctl7--plan-slice-d2cff2ee.md)
- [.dossier/logs/implementation/F-0023--fc-F-0023-mo8rctl7--implementation-9c19b2e4.md](/code/projects/yaagi/.dossier/logs/implementation/F-0023--fc-F-0023-mo8rctl7--implementation-9c19b2e4.md)

### 2. Identity model is stable enough

Во всех stage logs последовательно используются:

- `feature_id = F-0023`
- `feature_cycle_id = fc-F-0023-mo8rctl7`
- stage-local `cycle_id`
- `backlog_item_key = CF-015`

Это уже достаточно для ручной lifecycle reconstruction.

### 3. Runtime/process miss был записан явно

Implementation log зафиксировал реальный defect:

- first smoke replay surfaced SQL/materialization problem;
- defect was fixed within the same implementation cycle.

Это хороший признак: telemetry не превращена в "только green path".

## Observed gaps

### 1. `session_id` в stage logs остался `null`

Во всех stage logs присутствует `trace_locator_kind: session_id`, но сам `session_id` не заполнен. Это ухудшает retrospective discoverability:

- scan пришлось начинать с внешнего поиска session trace;
- log-to-session linkage получился косвенным, а не прямым.

### 2. Artifact links не лежат в machine-readable fields

Scan summary зафиксировал:

- missing review artifacts: `4`
- missing verification artifacts: `4`
- missing step artifacts: `4`

Проблема не в том, что artifacts отсутствуют как таковые. Они существуют. Проблема в том, что stage logs не дают их в достаточно структурированном виде для надежного автоматического связывания. Часть ссылок находится в narrative `Close-out`, но scanner не может считать это жестким closure contract.

### 3. Multi-round review history плохо видна из самих логов

По session trace известно, что implementation closure проходила через несколько rerounds и несколько внешних reviewers. Но stage log сам по себе не дает компактной структуры вроде:

- `review_rounds_total`
- `reviewers`
- `blocking_findings_count`
- `final_review_commit`

Из-за этого одно из главных событий сессии, а именно invalidation self-review и переход к внешнему audit stack, нельзя восстановить по одному implementation log без trace.

### 4. Логи не содержат explicit skill-usage telemetry

В этой сессии реально влияли на outcome:

- `unified-dossier-engineer`
- `implementation-discipline`
- `code-reviewer`
- `spec-conformance-reviewer`
- `security-reviewer`

Но в stage logs нет структурированного поля вида:

- `skills_used`
- `independent_review_stack`
- `skill_followups`

Из-за этого skill-level retrospective требует trace mining instead of artifact-local reading.

### 5. Compacted session trace ломает автоматическое включение logs/artifacts

Первичный scan дал `stageLogs.count = 0`, хотя repo явно содержал dossier activity. Для правдивого bundle потребовались manual overrides:

- `--stage-log`
- `--review-artifact`
- `--verification-artifact`

Это уже не баг логов как таковых, но это important observability gap всей telemetry chain: текущих anchors недостаточно, чтобы retrospective tooling автоматически восстановил scope after compaction.

## Recommended telemetry changes

### P1. Заполнять `session_id` в stage logs, когда он известен

Это самая прямая доработка retrospective discoverability.

### P1. Добавить frontmatter-level artifact refs

Для stage logs нужны явные поля:

- `review_artifact`
- `verification_artifact`
- `step_artifact`
- `metrics_artifact`

Если artifact появляется только на финальном closeout, helper должен обновлять frontmatter, не ломая narrative body.

### P1. Добавить structured review-round telemetry

Минимальный набор:

- `review_rounds_total`
- `reviewers`
- `blocking_findings_total`
- `final_review_commit`
- `review_invalidated_prior_artifact: true|false`

Именно этого набора не хватало, чтобы лог сам объяснил, почему initial closure chain была признана недействительной.

### P2. Добавить structured skill telemetry

Полезные поля:

- `skills_used`
- `review_skills_used`
- `security_review_required`
- `security_review_completed`

Тогда skill audit можно будет строить не только из trace.

### P2. Добавить trace anchors

Нужны bounded anchors, а не полный event dump:

- `first_event_line`
- `final_pass_event_line`
- `review_request_event_lines`
- `closure_event_line`

Это резко упростит retrospective validation на compacted sessions.

### P3. Добавить incident block в log schema

Например:

- `incident_id`
- `incident_category`
- `incident_detected_at`
- `incident_resolved_commit`

Тогда OOM/smoke incident и internal runtime defect будут жить не только в chat memory.

## Net Verdict

Telemetry в этом репозитории уже достаточно хороша для ручного forensic reconstruction, но еще недостаточно хороша для надежного automated retrospective on active compacted sessions. Главный разрыв не в отсутствии логов, а в отсутствии нескольких машинно-читаемых связей между логами, review artifacts, verification artifacts, step-close, session trace, and reround history.
