# Исправимые проблемы из ретро session-019dc028

Источник: `.dossier/retro/session-019dc028/retrospective-20260424-154308-019dc028`.

Принцип пересмотра: не раздувать stage logs новыми полями. Если уже есть canonical artifact mechanism, использовать его. Для ревью таким механизмом уже является `review-artifact --verdict PASS|FAIL`, который пишет immutable attempt в `.dossier/reviews/<feature>/` и связывает его со stage state.

Слитые ID: `RP-002 -> RP-001`, `RP-005 -> RP-001`, `RP-006 -> RP-001`, `RP-009 -> RP-001`, `RP-010 -> RP-008`, `RP-013 -> RP-001/RP-007/RP-008/RP-011`, `RP-014 -> RP-001/RP-007/RP-008/RP-011`, `RP-015 -> RP-001/RP-007/RP-008/RP-011`, `RP-017 -> RP-003`, `RP-019 -> RP-018`. ID не переиспользуются, чтобы ссылки из обсуждения не меняли смысл.

## unified-dossier-engineer

| ID | Проблема | Важность | Суть | Минимальное решение |
|---|---|---:|---|---|
| RP-001 | Нет canonical audit handoff recipe | High | Основной агент каждый раз сам придумывает задание аудитору, поэтому легко забыть scope, read-only режим, audit class или обязательную запись `PASS/FAIL` artifact. Из-за этого FAIL-раунды могут остаться только в чате, хотя канон уже умеет immutable review attempts. | Добавить готовые recipes для `spec-conformance-reviewer`, `code-reviewer`, `security-reviewer`: задание на аудит, scope, критерии PASS/FAIL и точная команда `review-artifact`. Не запускать blocking reviewer без такого recipe; раунд без artifact не считается завершенным. |
| RP-007 | Нет общей risk map для параллельных/последовательных аудиторов | Medium | Проблема не в том, что spec/code/security reviewers пересекались: пересечение полезно. Проблема в том, что основной агент не дал им единую короткую карту рисков и границы фокуса, поэтому каждый аудитор заново выводил, какие failure families важны, а покрытие получилось поздним и частично дублирующим. | В audit handoff recipe добавить короткий блок `Shared risk map` и `Reviewer focus`: общие labels вроде `rollback-replay`, `terminal-state`, `caller-controlled-input`, `host-executor`, плюс 1 строка фокуса для конкретного audit class. Это не менять глобальные reviewer skills и не добавлять логи. |
| RP-008 | `plan-slice` не выделил protected side-effect инварианты | High | Durable reservation, replay и terminal CAS всплыли поздно, потому что фаза `plan-slice` передала implementation список работ, но не выделила компактный набор обязательных инвариантов для опасных side effects. | В правила фазы `plan-slice` добавить: для задач с protected side effects формировать короткий risk preset: reservation before side effect, idempotent replay behavior, terminal CAS, strict caller input, live-vs-stale running behavior. Этот preset становится частью implementation handoff и audit scope; для тестового плана `plan-slice` может ссылаться на `typescript-test-engineer` как руководство по negative test matrix. |
| RP-003 | Pre-close порядок был не зафиксирован как простой ритуал | Medium | Были лишние круги из-за commit boundary, freshness и provenance. | Один короткий порядок: material commit freeze -> external reviewers write artifacts -> verify -> step close -> hygiene. |
| RP-004 | Post-close hygiene запускался после close, а не как репетиция | Medium | Source-review всплыл уже после closure, поэтому post-close стал первым местом обнаружения backlog/source-review blockers вместо финального подтверждения чистоты. | Перед `dossier-step-close` запускать pre-close hygiene rehearsal: refresh/status/attention/source-review check без auto-ack. Все найденные source-review/attention blockers закрывать до final close; после close запускать обычный post-close hygiene как подтверждение. |

## typescript-test-engineer

| ID | Проблема | Важность | Суть | Минимальное решение |
|---|---|---:|---|---|
| RP-011 | Негативные тесты появились после внешних FAIL | High | Happy path был готов раньше, чем были явно запланированы и реализованы негативные проверки для side-effecting/state-changing workflow: duplicate, concurrent, state read/write failure, completion conflict, terminal replay, live-vs-stale running replay, external executor failure, invalid/unknown inputs, partial evidence/state. | В `typescript-test-engineer` дать универсальную negative test matrix для side-effecting/state-changing workflows и правило: применимые строки должны попадать в test plan/тестовый набор, неприменимые помечаются N/A. Скилл формулирует самостоятельный test design contract; workflow-specific handoff может ссылаться на него извне. |
| RP-012 | Fixture повторил дефект production path | Medium | Test double/fixture должен помогать проверять поведение, но в F-0026 он повторил ту же ошибку terminal transition, что и production store. В результате тесты могли подтверждать ошибочную модель вместо того, чтобы ловить расхождение с инвариантами. | В `typescript-test-engineer` добавить раздел `Test doubles and fixtures`: когда fixture/model заменяет production state-changing component, агент должен вынести ключевые инварианты в общий contract test suite и запускать этот suite против production implementation и fixture. Для F-0026-подобных state machines это означает одну таблицу terminal transitions/replay conflicts, примененную к обоим реализациям. |

## cli-engineer

| ID | Проблема | Важность | Суть | Минимальное решение |
|---|---|---:|---|---|
| RP-016 | Protected CLI не отклонял неизвестные и устаревшие flags до выполнения действия | High | В release/rollback CLI stale или ошибочные параметры могли пройти парсинг и привести к запуску protected operation с не теми настройками. Для operator-facing команд это опасно: typo или старый automation script не должны доходить до side effects. | В `cli-engineer` добавить раздел `Protected command option contracts`: для команд, которые запускают deploy/rollback/release/infra side effects, агент должен описать per-action allowlist опций, написать тест на unknown flag и тест на устаревший/запрещенный flag, и убедиться, что ошибка происходит до вызова service/executor. |

## retrospective-phase-analysis

| ID | Проблема | Важность | Суть | Минимальное решение |
|---|---|---:|---|---|
| RP-018 | Ретро смешало качество данных и фактор поведения агента | Medium | В отчете `compacted` был назван ограничением данных, хотя raw `jsonl` был доступен и использован. Это путает читателя: compaction может влиять на то, что агент помнил во время работы, но не означает потерю evidence log. Та же ошибка мышления привела к первичному предложению “добавить поля в логи” вместо проверки уже существующего review-artifact механизма. | В `retrospective-phase-analysis` изменить шаблон/чеклист отчета: раздел `Data quality` должен описывать только доступность raw trace, parse errors, phase boundary, missing artifacts; отдельный раздел `Agent-context factors` должен описывать compaction как возможный фактор поведения. Перед рекомендацией schema/log changes добавить обязательную проверку: “можно ли решить через существующий canonical artifact/workflow/prompt?”. |

## Общий вывод

Главная исправимая проблема не “в логах мало полей”. Главная проблема: запись результата каждого ревью-раунда не была сделана обязательной частью аудиторского handoff.

Оптимальное решение: основной агент инициирует аудит с готовой командой записи результата; аудитор после проверки сам вызывает `review-artifact` с `PASS` или `FAIL`, владеет вердиктом и artifact; основной агент не считает раунд завершенным без artifact.

## Минимальный audit handoff recipe

Основной агент не должен сочинять задание на аудит. Он должен выбрать один из трех рецептов, подставить значения и отправить аудитору.

Общие обязательные параметры:

- `<dossier-path>`: canonical feature dossier path.
- `<step>`: текущий шаг, например `implementation`.
- `<commit>`: commit или HEAD, который проверяется.
- `<scope>`: конкретные файлы/поведение под аудитом.
- `<reviewer-name>`, `<reviewer-skill>`, `<agent-id>`: идентичность аудитора.

### spec-conformance-reviewer

```text
Задание: проверь соответствие implementation/spec/plan требованиям dossier, acceptance criteria, ADR и backlog scope.
Scope: <scope>. Проверяемый commit: <commit>.
Режим: read-only. Не меняй файлы и не меняй HEAD.

После аудита обязательно сам запиши результат:

PASS:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class spec-conformance-reviewer \
  --verdict PASS \
  --reviewer <reviewer-name> \
  --reviewer-skill spec-conformance-reviewer \
  --reviewer-agent-id <agent-id> \
  --evidence "<что именно подтверждено>" \
  --notes "<краткое резюме>"

FAIL:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class spec-conformance-reviewer \
  --verdict FAIL \
  --reviewer <reviewer-name> \
  --reviewer-skill spec-conformance-reviewer \
  --reviewer-agent-id <agent-id> \
  --must-fix "<blocking requirement gap>" \
  --evidence "<file/line/spec reference>"
```

### code-reviewer

```text
Задание: проверь код на bugs, regressions, state-machine errors, edge cases, missing tests и maintainability blockers.
Scope: <scope>. Проверяемый commit: <commit>.
Режим: read-only. Не меняй файлы и не меняй HEAD.

После аудита обязательно сам запиши результат:

PASS:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class code-reviewer \
  --verdict PASS \
  --reviewer <reviewer-name> \
  --reviewer-skill code-reviewer \
  --reviewer-agent-id <agent-id> \
  --evidence "<что именно проверено>" \
  --notes "<краткое резюме>"

FAIL:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class code-reviewer \
  --verdict FAIL \
  --reviewer <reviewer-name> \
  --reviewer-skill code-reviewer \
  --reviewer-agent-id <agent-id> \
  --must-fix "<blocking code finding>" \
  --evidence "<file/line>"
```

### security-reviewer

```text
Задание: проверь auth/RBAC, trust boundaries, caller-controlled input, command execution, persistence safety и protected side effects.
Scope: <scope>. Проверяемый commit: <commit>.
Security trigger reason: <security-trigger-reason>.
Режим: read-only. Не меняй файлы и не меняй HEAD.

После аудита обязательно сам запиши результат:

PASS:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class security-reviewer \
  --verdict PASS \
  --reviewer <reviewer-name> \
  --reviewer-skill security-reviewer \
  --reviewer-agent-id <agent-id> \
  --security-trigger-reason "<security-trigger-reason>" \
  --evidence "<что именно проверено>" \
  --notes "<краткое резюме>"

FAIL:
node /home/kostysh/.codex/skills/custom/skills/unified-dossier-engineer/scripts/dossier-engineer.mjs review-artifact \
  --dossier <dossier-path> \
  --step <step> \
  --audit-class security-reviewer \
  --verdict FAIL \
  --reviewer <reviewer-name> \
  --reviewer-skill security-reviewer \
  --reviewer-agent-id <agent-id> \
  --security-trigger-reason "<security-trigger-reason>" \
  --must-fix "<blocking security finding>" \
  --evidence "<file/line/threat>"
```
