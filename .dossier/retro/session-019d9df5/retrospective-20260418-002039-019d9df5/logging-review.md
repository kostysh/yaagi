# Logging review

Status: validated

## Summary

Логирование на фазе `F-0022 implementation` было в целом хорошим: stage log появился вовремя, coverage proveable, verify/review/step-close artifacts связаны между собой, backlog actualization не потеряна. Но для retrospective вскрылись три практических слепых зоны: несовпадение `session_id`, слабая структурированность review events и недостаточно машинно-явное описание process incidents.

## Observed strengths

- `<project-root>/.dossier/logs/F-0022/implementation-c01.md` содержит сильный metadata block:
  `feature_id`, `backlog_item_key`, timestamps, planned slices, source inputs, artifact links.
- В лог явно внесены:
  - rerun reasons по каждому audit cycle;
  - backlog actualization;
  - process miss;
  - final closure.
- Verify, review и step-close artifacts присутствуют и консистентны:
  - `<project-root>/.dossier/verification/F-0022/implementation-51a6827fbd2e.json`
  - `<project-root>/.dossier/reviews/F-0022/implementation-51a6827fbd2e.json`
  - `<project-root>/.dossier/steps/F-0022/implementation.json`

## Logging gaps

### L-01 — `session_id` в stage log не совпадает с analyzed trace

- Severity: medium
- Evidence:
  - stage log metadata: `session_id = 019d9e7c-a4dc-74f5-ab41-818817d775ef`
  - analyzed trace: `<session-trace:019d9df5>`
- Почему это плохо:
  - retrospective пришлось делать с manual phase boundary и manual artifact overrides;
  - confidence снижается, потому что link между trace и stage log перестаёт быть self-evident.

### L-02 — Review loop описан хорошо для человека, но плохо для машины

- Severity: high
- Evidence:
  - `review_retry_count = 4`
  - `rerun_reasons[]` заполнен
  - `review_events = []`
  - `review_requested_ts` пустой
- Почему это плохо:
  - автоматический scan-summary переоценил review rounds и недооценил findings;
  - timeline приходится восстанавливать из prose instead of structured fields.

### L-03 — Process incidents не нормализованы как отдельные записи

- Severity: medium
- Evidence:
  - process miss про invalid backlog patch зафиксирован только одной prose-строкой
- Почему это плохо:
  - incident можно прочитать человеку, но трудно агрегировать между фазами;
  - retrospective не может автоматически отличить “процедурный промах” от обычной рабочей заметки.

### L-04 — Финальный commit не связан со stage log напрямую

- Severity: low
- Evidence:
  - stage log говорит `canonical_for_commit: true`, но не хранит финальный commit hash
  - commit `75ee7b9` пришлось брать из `git log`
- Почему это плохо:
  - phase closure остаётся reconstructable, но не self-contained.

## Recommendations

1. Сделать `session_id` и `trace_session_id` явными и валидируемыми полями.
   Если лог пишется в соседней сессии, это должно быть видно без ручной дедукции.
2. Добавить структурированный `review_events[]`:
   `reviewer_kind`, `started_ts`, `verdict_ts`, `verdict`, `findings_count`, `reround_index`.
3. Добавить `incident_events[]`:
   `incident_id`, `category`, `severity`, `summary`, `resolved_ts`.
4. После финального коммита писать `final_commit` в stage log или step-close artifact.
5. Для retrospective-friendly traces добавить phase-end anchor:
   `phase_boundary_ts` или `final_phase_event_id`, чтобы не резать активную длинную сессию вручную через `--until-ts`.

## Validation ideas

- Warn, если `stage_log.session_id` не совпадает с trace session id и нет явного объяснения.
- Warn, если `review_retry_count > 0`, но `review_events[]` пуст.
- Warn, если process miss описан в prose, но нет `incident_events[]`.
- Warn, если `canonical_for_commit = true`, но отсутствует `final_commit`.
