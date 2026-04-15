# Ревью логирования: закрытие implementation для F-0018

## Сводка

- Общее качество логирования: среднее. Stage logs существуют и содержат полезные metadata blocks, но автоматический CLI scan не смог связать их как analyzed logs.
- Самые важные пробелы: недостаточная связь stage logs с trace event IDs, сжатые review events, отсутствие canonical artifact freshness marker.
- Какие виды анализа ограничены telemetry: latency to first review verdict, точное время ожидания review, точная последовательность замены stale artifacts, точная причина создания auto-bundle folder.

## Находки

### Gap L-01: Stage logs не имеют стабильных trace anchors

- Текущее поведение: logs содержат `session_id`, timestamps и artifact paths, но не содержат trace line/event IDs.
- Почему этого недостаточно: `retro-cli.mjs scan` сообщил `Stage logs analyzed: 0`, хотя trace mentioned/touched `.dossier/logs/F-0018/*`.
- Пример влияния на качество ретроспективы: automatic metrics по review rounds, process misses и backlog actualization оказались равны нулю и требовали ручной реконструкции.
- Предлагаемое улучшение: добавить поля `trace_first_event_id`, `trace_review_request_event_ids`, `trace_final_pass_event_id`, `trace_commit_event_id`.
- Приоритет: high.

### Gap L-02: События review слишком сжаты

- Текущее поведение: implementation logs используют один consolidated timestamp `2026-04-15T02:25:26+02:00` для spec/security/code review bundle.
- Почему этого недостаточно: невозможно точно отличить request time, agent start time, first verdict, reround и final usable verdict.
- Пример влияния на качество ретроспективы: невозможно вычислить `ready_for_review -> first verdict latency` и `first non-pass -> final pass latency` для implementation.
- Предлагаемое улучшение: хранить `review_events` array с `agent_id`, `role`, `model`, `requested_ts`, `started_ts`, `verdict_ts`, `verdict`, `rerun_reason`.
- Приоритет: high.

### Gap L-03: Process misses не всегда связаны с исходной командой оператора

- Текущее поведение: `.dossier/logs/F-0018/implementation-sl-f0018-01.md` фиксирует process miss "остановка после partial implementation", но не указывает trace ref на команду "Комить и приступай к имплементации".
- Почему этого недостаточно: root cause приходится доказывать из session trace, а не из самого process log.
- Пример влияния на качество ретроспективы: incident R-01 требует ручной сверки trace lines around `1828`, `2693`, `2717`, `2727`.
- Предлагаемое улучшение: добавить `operator_command_refs` и `process_miss_refs` как machine-readable списки.
- Приоритет: medium.

### Gap L-04: Artifact freshness не выражена явно

- Текущее поведение: существуют `implementation-93307e0aaf00.*` и `implementation-1b42da50618e.*`; canonical artifact определяется по финальному коммиту и step-close content.
- Почему этого недостаточно: оператору или ретроанализу нужно вручную понять, какие artifacts superseded.
- Пример влияния на качество ретроспективы: closure sequence выглядит как duplicate verification/review, а не как intentional freshness alignment.
- Предлагаемое улучшение: в `step-close` и `review-artifact` добавить `supersedes`, `canonical_for_commit`, `generated_after_commit`.
- Приоритет: medium.

### Gap L-05: Backlog patch integrity не валидируется как отдельная telemetry signal

- Текущее поведение: stage log описывает восстановление hashed patch artifacts, но это не автоматический check.
- Почему этого недостаточно: `.backlog/applied.json` может ссылаться на отсутствующий `canonical_path` до позднего rebuild/closure шага.
- Пример влияния на качество ретроспективы: incident R-02 был обнаружен как operational repair, а не как named validation failure.
- Предлагаемое улучшение: добавить `backlog_artifact_integrity_check` в verification bundle.
- Приоритет: high.

### Gap L-06: После первого `scan` не был зафиксирован единый canonical run directory

- Текущее поведение: первый `scan --out-root` создал правильный session-based run directory `.dossier/retro/session-019d8db3/retrospective-20260414-203415-019d8db3/`, но процесс не закрепил его как canonical для следующих команд.
- Почему этого недостаточно: агент ошибочно создал второй semantic bundle и сначала объявил его canonical, из-за чего оператор увидел две retro folders и потребовал объяснение.
- Пример влияния на качество ретроспективы: canonical bundle пришлось вернуть в session-based path `.dossier/retro/session-019d8db3/retrospective-20260414-203415-019d8db3/` и обновить внутренние ссылки.
- Предлагаемое улучшение: `retro-cli scan` должен явно возвращать выбранный `run_dir`; `report`, `skill-audit` и `logging-review` должны принимать `--run-dir` и писать в тот же каталог, не создавая sibling bundle без явного `--new-run`.
- Приоритет: medium.

### Gap L-07: Язык отчётов не наследуется из языка оператора

- Текущее поведение: auto-generated Markdown drafts были созданы на английском, хотя операторская сессия и stage logs велись на русском.
- Почему этого недостаточно: отчёты становятся непоследовательными с dossier workflow и требуют ручного перевода перед использованием как durable artifacts.
- Пример влияния на качество ретроспективы: `retrospective-report.md`, `skill-audit.md` и `logging-review.md` пришлось вручную перевести; это создаёт риск смешанных формулировок и потери смысла.
- Предлагаемое улучшение: добавить `--locale` / `--language` в `retro-cli`; сохранять `operator_locale` и `report_language` в `scan-summary.json`; команды `report`, `skill-audit`, `logging-review` должны наследовать язык и падать non-zero, если final Markdown содержит обычную прозу не на языке оператора.
- Приоритет: high.

## Рекомендуемые изменения схемы

| Поле или артефакт | Зачем добавить или изменить | Потребитель | Приоритет |
|---|---|---|---|
| `trace_first_event_id` | Связать stage log с trace без эвристик. | `retro-cli`, reviewer, operator. | high |
| `review_events[]` | Сохранить per-agent review timeline. | `dossier-engineer`, retrospective. | high |
| `process_miss_refs[]` | Связать process miss с source command/tool event. | retrospective. | medium |
| `canonical_for_commit` | Убрать неоднозначность между stale/final artifacts. | `dossier-step-close`, оператор. | medium |
| `backlog_artifact_integrity_check` | Поймать missing hashed patch artifacts до closure. | `backlog-engineer`, CI. | high |
| `retro_run_dir` | Зафиксировать единственный canonical run directory, выбранный первым `scan` или явным override. | `retro-cli`. | medium |
| `operator_locale` / `report_language` | Зафиксировать язык оператора и язык человекочитаемых отчётов. | `retro-cli`, `retrospective-phase-analysis`. | high |

## Рекомендуемые изменения процесса

1. Перед final response по implementation сверять planned slices against completed slices.
2. Перед close-out запускать backlog artifact integrity check.
3. После external review сохранять per-agent telemetry сразу, а не консолидировать задним числом.
4. После final commit выполнять trace-only metadata backfill только с явным `supersedes` / `canonical_for_commit`.
5. Для retro bundles использовать один canonical `run_dir`: либо принять session-based path, выбранный первым `scan`, либо задать override до первого filesystem write; не создавать второй bundle после уже созданного run path.
6. Для final reports указывать `--locale ru` или наследовать `operator_locale` из session context; skill должен запрещать финальные отчёты не на языке оператора, кроме цитат, команд, путей, identifiers, JSON keys и имён tools/skills.

## Рекомендуемая автоматизация

- Validation checks: `applied_canonical_paths_exist`, `stage_log_has_trace_refs`, `review_events_complete`, `canonical_artifact_matches_commit`, `report_language_matches_operator_locale`.
- Auto-generated links: trace event refs for operator commands, review spawn events, final verdicts, commits.
- Derived metrics: review wait time, reround time, closure artifact churn, partial-stop count.
- Sidecar telemetry: `.dossier/logs/<feature>/<stage>-<cycle>.events.json` для machine-readable review/process events.
- CLI guard: `scan` должен возвращать canonical `run_dir`; последующие команды должны использовать этот же каталог и не создавать новый sibling bundle без явного `--new-run`.
