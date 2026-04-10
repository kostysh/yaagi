```yaml
feature_id: F-0016
backlog_item_key: CF-016
stage: implementation
cycle_id: SL-F0016-03
package_id: SL-F0016-03
skill: dossier-engineer
change_kind:
  - contracts
  - db
  - runtime
  - workshop
  - tests
  - docs
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0013-operator-http-api-and-introspection.md
  - docs/features/F-0012-homeostat-and-operational-guardrails.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
session_id: 019d7490-46d0-7811-b43f-056bb617a7ab
start_ts: 2026-04-10T14:17:21+02:00
ready_for_review_ts: 2026-04-10T14:45:42+02:00
final_pass_ts: 2026-04-10T14:45:42+02:00
commit_ts: 2026-04-10T14:48:32+02:00
commit_sha: 606f97e20963668a4055f1807026f2a6930a8ec3
review_policy:
  spec: required
  code: required
  security: required
review_rounds: 2
review_findings_total: 3
out_of_spec_decisions_total: 0
process_misses_total: 0
duration_minutes: 28
log_required: true
log_required_reason:
  - package_based_implementation
  - external_review_reround
  - backlog_actualization
  - retrospective_process_telemetry
backlog_actualized: true
verification_artifact: .dossier/verification/F-0016/implementation-6fd8816c2177.json
review_artifact: .dossier/reviews/F-0016/implementation-6fd8816c2177.json
step_artifact: .dossier/steps/F-0016/implementation.json
log_quality:
  start_captured: true
  commit_recorded: true
  duration_exact: false
```

# Журнал имплементации: F-0016 SL-F0016-03

## Область работ

Реализовать `SL-F0016-03: Evidence handoff, drift audit and activation proof` из досье F-0016.

Пакет должен поставить internal evidence/proposal gates для workshop candidate/package evidence, bounded execution-outcome evidence intake, usage/drift guards и финальное proof покрытие без захвата ownership у `F-0015`, будущих `CF-012`, `CF-019`, `CF-025` или `F-0013`.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/features/F-0016-development-governor-and-change-management.md`
- `docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md`
- `docs/features/F-0013-operator-http-api-and-introspection.md`
- `docs/features/F-0012-homeostat-and-operational-guardrails.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`

## Решения / реклассификации

- `promotion-package` из `F-0015` не копируется в governor как новая lifecycle truth: governor proposal хранит только bounded handoff refs, evidence refs, rollback refs и минимальный payload для трассировки.
- Внутренний workshop handoff под активным freeze не теряется и не проходит как operator bypass: proposal сохраняется в состоянии `deferred`, а публичный operator API по-прежнему получает freeze rejection.
- Execution-outcome intake является audit/evidence write gate governor, а не механизмом исполнения downstream-мутаций. Переходы `approved -> executed` и `approved|executed -> rolled_back` фиксируют результат внешнего owner path и требуют evidence refs.
- Повторная фиксация execution outcome идемпотентна по `request_id + normalized_request_hash`; drift по target ref или request hash отклоняется fail-closed.
- После внешнего аудита усилено правило: execution outcome разрешен только если proposal уже имеет стабильный `targetRef`, и этот target точно совпадает с outcome target.
- Для replay safety добавлен post-lock idempotency recheck после `FOR UPDATE`, чтобы конкурентный replay не превращался в `invalid_state_transition`.

## Обратная связь оператора

- В этом пакете не было отдельного уточнения оператора, меняющего направление реализации.

## Локальная приемка

- `pnpm format` — PASS; Biome сохранил известное предупреждение о несуществующем `/code/projects/yaagi/scripts`.
- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS, с тем же известным Biome internal warning про `/code/projects/yaagi/scripts`.
- Целевые тесты — PASS, 22/22 после audit fixes:
  - `apps/core/test/runtime/development-governor-boundary.test.ts`
  - `packages/contracts/test/governor/proposal-contract.test.ts`
  - `packages/db/test/development-governor-store.integration.test.ts`
  - `packages/db/test/development-proposal-lifecycle.integration.test.ts`
  - `apps/core/test/workshop/governor-evidence-handoff.integration.test.ts`
  - `apps/core/test/runtime/development-governor-execution-evidence.test.ts`
- `pnpm test` — PASS, 203/203.
- `pnpm smoke:cell` — PASS, 18/18.
- `dossier-engineer coverage-audit --dossier docs/features/F-0016-development-governor-and-change-management.md --orphans-scope=dossier` — PASS, blocking missing 0, informational missing 0, orphans 0.
- `dossier-engineer dossier-verify --dossier docs/features/F-0016-development-governor-and-change-management.md --step implementation --coverage-orphans-scope=dossier` — PASS, артефакт `.dossier/verification/F-0016/implementation-6fd8816c2177.json`.

## События ревью

- Раунд 1:
  - Внешний `spec-conformance` аудит — FAIL: boundary drift guard не включал `development_proposal_execution_outcomes`.
  - Внешний `code` аудит — FAIL: concurrent replay мог пройти initial idempotency lookup до proposal lock и затем получить `invalid_state_transition`.
  - Внешний `security` аудит — FAIL: targetless proposal мог принять arbitrary outcome `targetRef`.
- Исправления:
  - boundary regex расширен на `development_proposal_execution_outcomes` и добавлен positive/negative guard test.
  - `recordProposalExecutionOutcome` делает post-lock replay lookup перед transition validation.
  - outcome отклоняется, если proposal не имеет стабильного `targetRef` или target не совпадает.
- Раунд 2:
  - Повторный `spec-conformance` аудит — PASS.
  - Повторный `code` аудит — PASS.
  - Повторный `security` аудит — PASS, остаточный не-блокирующий риск: DB constraint не дублирует `outcome.target_ref = proposal.target_ref`, гарантия держится governor store gate и boundary guard.

## Актуализация backlog

- Backlog `CF-016` актуализирован до `implemented`.
- `backlog-engineer attention` вернул пустой список; open todo count равен 0.

## Процессные промахи

- Пока нет.

## Закрытие

- Артефакт verification: `.dossier/verification/F-0016/implementation-6fd8816c2177.json`.
- Артефакт review: `.dossier/reviews/F-0016/implementation-6fd8816c2177.json`.
- Артефакт step closure: `.dossier/steps/F-0016/implementation.json`.
- `dossier-step-close` вернул `process_complete=yes`.
- Коммит имплементации: `606f97e20963668a4055f1807026f2a6930a8ec3`.
