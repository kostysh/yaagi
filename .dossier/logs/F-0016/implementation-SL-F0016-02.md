```yaml
feature_id: F-0016
backlog_item_key: CF-016
stage: implementation
cycle_id: SL-F0016-02
package_id: SL-F0016-02
skill: dossier-engineer
change_kind:
  - contracts
  - db
  - runtime
  - api
  - tests
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0013-operator-http-api-and-introspection.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
session_id: 019d7490-46d0-7811-b43f-056bb617a7ab
start_ts: 2026-04-10T13:32:50+02:00
ready_for_review_ts: 2026-04-10T13:50:29+02:00
final_pass_ts: 2026-04-10T14:15:29+02:00
commit_ts: 2026-04-10T14:16:17+02:00
commit_sha: 5493229d341fb75cbfc3996477ee66ec41991112
review_policy:
  spec: required
  code: required
  security: required
review_rounds: 3
review_findings_total: 2
out_of_spec_decisions_total: 0
process_misses_total: 2
duration_minutes: 43
log_required: true
log_required_reason:
  - package_based_implementation
  - external_review_reround
  - operator_process_correction
  - retrospective_process_telemetry
backlog_actualized: false
verification_artifact: .dossier/verification/global/implementation-5493229d341f.json
log_quality:
  start_captured: true
  commit_recorded: true
  duration_exact: true
```

# Журнал имплементации: F-0016 SL-F0016-02

## Область работ

Реализовать `SL-F0016-02: Proposal lifecycle and advisory decisions` из досье F-0016.

Пакет должен поставить `POST /control/development-proposals`, schemas для proposal, идемпотентную submission-запись, отказ при активном freeze, четыре канонических класса proposal, durable advisory decisions и доказательство, что approval-записи не выполняют downstream-мутации.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/features/F-0016-development-governor-and-change-management.md`
- `docs/features/F-0013-operator-http-api-and-introspection.md`
- `docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`

## Решения / реклассификации

- Для rollback linkage операторский `rollbackPlanRef` обязателен на уровне governor service: route-схема допускает `null`, но запись отклоняется с `insufficient_evidence`, чтобы сохранить machine-readable error contract.
- Decision lifecycle реализован как internal governor-store/service capability без публичного HTTP route: `approved`, `rejected` и `deferred` меняют только governor proposal state и пишут `development_proposal_decisions` + `development_ledger`.
- Для уже принятого proposal replay при активном freeze остается идемпотентным и возвращает исходную proposal-запись; freeze блокирует только новые external submissions.
- В `AGENTS.md` добавлено repo-overlay правило: package-based implementation logs ведутся на языке оператора текущей сессии.

## Обратная связь оператора

- Оператор скорректировал процесс: внешний audit stack обязателен и не требует отдельного разрешения перед запуском, если это уже требуется процессом skill-а.

## Локальная приемка

- Контракты:
  - `packages/contracts/src/governor.ts` содержит proposal command/result и advisory decision command/result schemas.
  - `packages/contracts/src/operator-api.ts` содержит bounded operator proposal request schema.
- Хранение:
  - `infra/migrations/012_development_proposal_lifecycle.sql` добавляет explicit proposal lifecycle fields поверх уже закоммиченной governor migration.
  - `packages/db/src/development-governor.ts` реализует idempotent proposal submission, active-freeze rejection, conflict-closed replay и advisory decision transitions.
- Runtime/API:
  - `apps/core/src/runtime/development-governor.ts` нормализует proposal/decision payload, hash/evidence, under-specified rejection и advisory-only decision payload.
  - `apps/core/src/platform/operator-api.ts` публикует `POST /control/development-proposals` только через `F-0013` Hono boundary и делегирует durable writes в governor gate.
  - `apps/core/src/runtime/runtime-lifecycle.ts` подключает proposal submission к runtime lifecycle.
- Документы:
  - `docs/features/F-0016-development-governor-and-change-management.md` обновлен по coverage map/progress/change log.
  - `docs/features/F-0013-operator-http-api-and-introspection.md` и `docs/architecture/system.md` согласованы с live governor-delegating routes.
  - `AGENTS.md` фиксирует язык implementation log.
- Проверка:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `node --experimental-strip-types --experimental-test-module-mocks --test packages/contracts/test/governor/proposal-contract.test.ts packages/db/test/development-proposal-lifecycle.integration.test.ts apps/core/test/platform/operator-development-proposals.integration.test.ts`
  - `node --experimental-strip-types --experimental-test-module-mocks --test apps/core/test/platform/operator-governor-gating.contract.test.ts`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer debt-audit --changed-only`
  - `dossier-engineer dossier-verify --step implementation --changed-only`

## События ревью

- 2026-04-10T13:50:29+02:00: локальная completeness/spec/code/security самопроверка перед внешним аудитом. Открытых debt markers нет; side effects ограничены governor tables, runtime freeze flag, operator route delegation и docs/index artifacts.
- 2026-04-10T14:04:15+02:00: внешний `spec-conformance` аудит вернул FAIL: store разрешал `deferred -> deferred`, хотя canonical lifecycle допускает из `deferred` только финальное решение или supersede.
- 2026-04-10T14:04:15+02:00: исправлено в `packages/db/src/development-governor.ts`; добавлен regression test `AC-F0016-07 rejects repeated deferred proposal decisions`.
- 2026-04-10T14:05:00+02:00: повторный `spec-conformance` вернул PASS.
- 2026-04-10T14:10:50+02:00: внешний `security` аудит вернул PASS с остаточными не-блокирующими рисками по perimeter auth, existence validation для evidence refs и будущему concurrency hardening для decision route.
- 2026-04-10T14:10:50+02:00: внешний `code` аудит вернул FAIL: proposal decision transition был race-prone, потому что state check и update не брали row lock / conditional transition.
- 2026-04-10T14:10:50+02:00: исправлено в `packages/db/src/development-governor.ts`: decision path читает proposal с `FOR UPDATE`; DB harness проверяет наличие row lock.
- 2026-04-10T14:12:46+02:00: повторные `spec-conformance`, `code` и `security` по lock-fix вернули PASS.

## Актуализация backlog

- Для отдельного package cycle backlog state не актуализировался: `CF-016` должен был перейти в `implemented` только после завершения всех implementation slices F-0016.

## Процессные промахи

- Внешний audit stack не был запущен сразу после локальной реализации пакета: агент ошибочно трактовал требование spawned reviewer agents как требующее дополнительного разрешения оператора. После коррекции оператора обязательные `spec-conformance`, `code` и `security` аудиты были проведены; найденные blocker findings исправлены и переаудированы до PASS.
- SHA коммита был внесен сразу после commit текущего пакета, отдельным docs follow-up, потому что самоссылочный commit SHA нельзя записать в содержимое того же commit без amend.

## Закрытие

- Пакет локально реализован; внешний audit stack прошел PASS после двух исправлений. Финальные quality gates, tests, smoke и dossier verification прошли PASS.
- Коммит пакета: `5493229d341fb75cbfc3996477ee66ec41991112`.
- `dossier-step-close` для `implementation` на уровне feature преждевременен до завершения оставшегося `SL-F0016-03` и последующей актуализации backlog.
