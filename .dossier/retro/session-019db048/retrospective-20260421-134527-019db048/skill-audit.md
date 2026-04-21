# Skill Audit: Сессия 2026-04-21

Status: validated against trace, logs, and closure artifacts

## Summary

Ключевой вывод по skill stack такой:

- `unified-dossier-engineer` дал сильный canonical workflow и хороший CLI surface.
- `implementation-discipline` помог удержать remediation в хирургических пределах, но не мог сам по себе защитить от process-truth ошибок.
- Реальную защиту от дефектов дали только независимые внешние `code-reviewer`, `spec-conformance-reviewer`, и `security-reviewer`.
- `retrospective-phase-analysis` полезен как scanner/scaffold, но для active compacted session ему не хватает более явной стратегии manual artifact inclusion.

## Skill-by-skill assessment

### `unified-dossier-engineer`

#### What worked

- Скил хорошо ведет canonical flow `feature-intake -> spec-compact -> plan-slice -> implementation -> step-close`.
- Отлично работает как command surface для реального repo work: migration, backlog actualization, intake/spec/plan, verify, review-artifact, step-close, lifecycle-refresh.
- Его reference docs хорошо удерживают separation of concerns между backlog truth, delivery workflow, closure artifacts, and telemetry.

#### What failed

- На практике скил оказался недостаточно жестким в двух местах:
  - `independent review` был сформулирован как требование, но не был достаточно operationalized как "reviewer must be different actor";
  - security review не был сформулирован как обязательный companion для code-changing implementation.
- Из-за этого self-authored review artifact вообще прошел в closeout chain, а security review был подключен только после операторского давления.

#### Evidence

- `delivery-workflow-layer.md` требует `independent review in fail-closed mode`, но не формулирует достаточно жестко, что self-review не может удовлетворять этому условию.
- `SKILL.md` для `review-artifact` explicitly says: "Persist an already obtained independent review artifact." Это означает, что review должен быть получен где-то еще, но в live execution эта граница оказалась недостаточно защищенной.
- Финальный artifact [.dossier/reviews/F-0023/implementation-review.json](/code/projects/yaagi/.dossier/reviews/F-0023/implementation-review.json) прямо фиксирует, что предыдущие self-authored review artifacts были признаны недействительными и заменены external verdict.

#### Recommendations

- Добавить в active methodology прямое negative rule:
  - author of implementation must not be the reviewer used for closure truth.
- Добавить явный review policy matrix:
  - code-changing implementation -> independent code review + spec-conformance review + security review.
- В `dossier-step-close` guidance явно прописать, что self-authored review invalidates close readiness.

### `implementation-discipline`

#### What worked

- После repo-wide enforcement этот skill хорошо ограничивал remediation scope:
  - `32c14e5`
  - `0a17089`
  - `dae8e3c`
- Исправления шли отдельными, обозримыми коммитами вместо одного разрастающегося diff blob.

#### Limits

- Skill дисциплинирует кодовые изменения, но не закрывает process truth:
  - не может сам запретить self-review;
  - не может сам определить, что completion claim был произнесен слишком рано.

#### Recommendation

- Оставить его обязательным для implementation и review work, но не считать заменой closure governance.

### `code-reviewer` + `spec-conformance-reviewer` + `security-reviewer`

#### What worked

- Только после внешнего запуска эти skills дали настоящую защиту от дефектов.
- Они нашли разные классы проблем:
  - code review surfaced correctness/provenance issue;
  - spec review surfaced Homeostat contract mismatch;
  - security review validated reporting/operator surface after the fixes.

#### Evidence

- External reviewer spawns in trace:
  - `Lorentz` at line `5194`
  - `Raman` at line `5196`
  - `Singer` at line `5247`
- Blocking and major reround evidence:
  - `Lorentz` blocking output at line `5647`
  - `Raman` major output at line `5806`
- Final triple-pass evidence:
  - `Lorentz PASS`, `Raman PASS`, `Singer PASS` around lines `5929-5943`

#### Recommendation

- For implementation closure, these reviewers should be launched as a default stack, not ad hoc after user challenge.

### `retrospective-phase-analysis`

#### What worked

- Быстро нашел canonical trace и создал durable bundle under `.dossier/retro/...`.
- Хорошо redacts paths and builds reusable scan/report/skill-audit/logging-review scaffolds.
- Правильно поддерживает `--until-line` for active-session phase boundary.

#### What failed

- Для active session с compaction initial `scan` дал:
  - `stageLogs.count = 0`
  - `draft_requires_agent_validation`
  - no included stage logs, despite obvious dossier activity.
- Без ручных `--stage-log`, `--review-artifact`, `--verification-artifact` overrides итоговый report был бы слишком слабым и частично ложным.

#### Recommendation

- В `SKILL.md` и CLI guidance стоит явно добавить:
  - если active-session scan sees dossier activity but `stageLogs.count = 0`, оператор должен immediately retry with manual artifact inclusion;
  - scanner could optionally emit a stronger warning with the exact retry recipe.

### Deprecated `backlog-engineer` / `dossier-engineer`

#### Observation

- Эти skills присутствуют в trace в начале сессии как часть legacy state и migration activity.
- После migration они стали process noise для retrospective scope extraction.

#### Recommendation

- Для future retrospectives on migration sessions стоит явно маркировать legacy-skill evidence as historical-only, чтобы scope extraction не раздувалась списком нерелевантных features/backlog items.

## Net Verdict

Skill stack в этой сессии был в целом достаточен для сложной end-to-end delivery, но только после того, как operator reintroduced missing rigor. Самая полезная доработка не в новых skills, а в tightening двух existing seams:

1. `unified-dossier-engineer` должен жестче определять независимость reviewer-а и обязательность security review.
2. `retrospective-phase-analysis` должен агрессивнее требовать manual evidence overrides на compacted active sessions.
