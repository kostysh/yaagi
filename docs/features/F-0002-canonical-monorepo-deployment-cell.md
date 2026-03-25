---
id: F-0002
title: Канонический scaffold монорепы и deployment cell
status: planned
coverage_gate: strict
owners: ["@codex"]
area: platform
depends_on: []
impacts: [runtime, infra, db, models, workspace]
created: 2026-03-19
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/adr/ADR-2026-03-19-quality-gate-sequence.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0002 Канонический scaffold монорепы и deployment cell

## 1. Context & Goal

- **User problem:** Без явного владельца для platform substrate реализация начинает расходиться с архитектурой уже на первом цикле: стек и package manager фиксируются неявно, runtime живёт вне канонической deployment cell, отсутствуют реальные PostgreSQL/vLLM/Compose контракты, boot/recovery продолжает опираться на предположения, не подтверждённые реальной средой запуска, tracked seed content смешивается с runtime-generated state, а quality/style gates для кода и тестов остаются неформализованными.
- **Goal (what success means):** Репозиторий получает канонический phase-0 scaffold под `pnpm` monorepo и `TypeScript + AI SDK + Hono`, минимальную deployment cell для локального/dev запуска (`core`, `postgres`, `vllm-fast`), baseline networks/volumes/container posture, immutable `seed` initialization boundary, materialized writable runtime volumes, bootstrap для PostgreSQL/`pg-boss` readiness, controlled realignment `F-0001` с фактическим runtime substrate и единый root-level quality/style gate contract для application и test code.
- **Non-goals:** Реализация tick engine, PSM/narrative/memetics, полноценной operator API, workshop/training pipeline, `vllm-deep`/`vllm-pool`, mature security hardening и code self-modification не входят в этот intake.

## 2. Scope

### In scope

- Нормализация корневого `pnpm` monorepo scaffold и package/workspace layout до архитектурно согласованного baseline.
- Seed-first layout contract: tracked initialization content lives under `seed/*`, while writable runtime state is materialized outside that tracked seed boundary.
- Явный process entrypoint для `polyphony-core` на каноническом стеке `Node 22 + TypeScript + AI SDK + Hono`.
- Docker Compose deployment cell для phase 0 с сервисами `core`, `postgres` и `vllm-fast`.
- Baseline networks, volume mounts и минимальная container posture, нужные для корректного локального запуска без скрытых инфраструктурных допущений.
- Deterministic materialization of writable runtime body/skills/data/model areas from read-only `seed` inputs before active runtime handoff.
- Bootstrap для PostgreSQL connectivity, migration/schema-version readiness и `pg-boss` readiness без внедрения поздних domain capabilities.
- Controlled `change-proposal` для `F-0001`, который перепривяжет boot/recovery к реальному dependency set и containerized startup path.

### Out of scope

- Полный runtime lifecycle beyond platform bootstrap: ticks, context builder, executive center, action execution, narrative и homeostat.
- `vllm-deep`, `vllm-pool`, full model registry, embeddings/reranking и specialist models.
- `polyphony-workshop`, datasets/training/evals/promotion pipeline.
- Mature safety perimeter: secrets policy hardening, stronger human gates, rich restricted-shell policy и safety kernel policies beyond platform baseline.
- Operator-facing state/timeline/models API и UI-интроспекция.

### Constraints

- Стек должен соответствовать архитектуре: `Node.js 22`, `TypeScript 5.x`, `AI SDK`, `Hono`, `node:test`, `pnpm`, `Docker Compose`.
- `CF-020` должен закрепить platform substrate, но не поглотить соседние feature seams (`CF-002`, `CF-006`, `CF-009`, `CF-014`).
- Любое осознанное отклонение от repo layout, deployment topology или container posture должно быть явно задокументировано в ADR блока фичи.
- Пересмотр `F-0001` должен быть behavior-preserving для already implemented boot logic, если новое platform substrate не требует изменения самих boot invariants.
- Quality/style gates должны одинаково применяться к application code и test code через root-level `pnpm` contract.
- Только `seed/*` может оставаться tracked initialization content; `workspace/*`, `models/*` и `data/*` должны считаться mutable runtime state и не могут быть каноническим Git source of truth.
- Worktree/body-evolution flows не имеют права мутировать `seed` напрямую; любые writable worktrees создаются только внутри materialized runtime body.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0002-01:** Репозиторий предоставляет канонический `pnpm` monorepo scaffold с root-level package manager lock, TypeScript base config, workspace manifests для `apps/*` и `packages/*`, а также baseline layout для `apps/core`, `apps/workshop`, `packages/contracts|domain|db|evals|skills|testkits`, `seed/*`, runtime `workspace/*`, `models/*`, `data/*` и `infra/*`; tracked initialization content lives under `seed/*`, while mutable runtime state is materialized outside that seed boundary; root checks запускаются единообразно через `pnpm` без альтернативного package/runtime path.
- **AC-F0002-02:** `polyphony-core` получает явный phase-0 entrypoint на `Node 22 + TypeScript + AI SDK + Hono`, который читает env/config для PostgreSQL, `vllm-fast`, read-only `seed` paths and materialized runtime `workspace/data/model` paths, materializes the writable runtime body before active handoff, держит AI SDK внутри internal reasoning boundary и предоставляет минимальную health/readiness surface, не расширяясь до operator API beyond health.
- **AC-F0002-03:** Локальная/dev deployment cell поднимается через Docker Compose с сервисами `core`, `postgres` и `vllm-fast`, именованными internal networks (`core_net`, `models_net`, `db_net`) и сервисными адресами, согласованными с архитектурой; `core` получает read-only `seed` mount отдельно от writable runtime volumes и может reach PostgreSQL и `http://vllm-fast:8000/v1` только через объявленную cell wiring.
- **AC-F0002-04:** Container manifests и runtime wiring фиксируют baseline platform posture: non-root execution, отсутствие `privileged` и `docker.sock`, read-only mount `/seed`, отдельные writable runtime surfaces для `/workspace`, `/models` и `/data`, а также явные временные пути/resource surfaces; если phase-0 не может соблюсти часть posture, отклонение фиксируется в ADR, а не скрывается в конфиге.
- **AC-F0002-05:** Platform bootstrap неинтерактивно подготавливает PostgreSQL connectivity, migration/schema-version readiness и `pg-boss` readiness для phase-0 cell, materializes writable runtime body/skills/bootstrap data from `seed`, а smoke/invariant suite подтверждает, что `core` стартует в containerized режиме только после успешного доступа к Postgres, `seed` boundary и `vllm-fast`.
- **AC-F0002-06:** В рамках этой фичи оформляется controlled `change-proposal` против `F-0001`, который обновляет `depends_on`, boot dependency assumptions, `constitution`/volume paths и verification plan так, чтобы boot/recovery проверял реальный platform dependency set, `seed` initialization boundary и containerized startup path, а не legacy in-memory assumptions.
- **AC-F0002-07:** Репозиторий предоставляет канонические root-level quality/style commands через `pnpm`, которые единообразно покрывают application code и test code в `apps/*`, `packages/*`, `infra/*`, `scripts/*` и `test/*`, используют `Biome` для formatting/style checks и `ESLint` для typed linting, поддерживают отдельные write/check режимы без расхождения правил между source и tests, а также служат единственным command contract для минимального GitHub Actions testing workflow в `.github/workflows/test.yml` без дублирующего shell-only automation path.
- **AC-F0002-08:** Канонический локальный и GitHub Actions testing gate sequence для source/test code определяется как `format/check -> typecheck -> lint -> test`; automation path в `.github/workflows/test.yml` запускается на `pull_request` и `push` в `master`, использует `Node.js 22` и repo-level `pnpm` contract, выполняет `pnpm quality:check`, а затем `pnpm test`, так что workflow не вводит альтернативный порядок или package-local command set.

## 4. Non-functional requirements (NFR)

- **Determinism:** Один и тот же локальный bootstrap profile должен поднимать одну и ту же deployment topology без скрытых ручных шагов.
- **Operability:** Запуск, остановка и smoke-проверка cell должны быть доступны через небольшое число root `pnpm` commands.
- **Traceability:** Platform deviations и `F-0001` realignment должны быть зафиксированы в dossier/ADR, а не оставаться в коммитах без контекста.
- **Safety baseline:** Уже на этой фазе нельзя допускать `privileged`, `docker.sock` и неописанные RW mounts как “временный” дефолт.
- **Consistency:** Style/quality contract должен одинаково применяться к source и tests, чтобы проверка не расходилась по зонам репозитория.

## 5. Design (compact)

### 5.1 API surface

- Внешняя operator API-поверхность этой фичи намеренно минимальна.
- Предлагаемые root entrypoints и команды:

```text
pnpm typecheck
pnpm format
pnpm format:check
pnpm lint
pnpm lint:fix
pnpm quality:fix
pnpm quality:check
pnpm test
pnpm cell:up
pnpm cell:down
pnpm smoke:cell
```

- Канонический developer flow для changed code:

```text
pnpm format
pnpm typecheck
pnpm lint
pnpm test
```

- Канонический automation/read-only flow:

```text
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
```

- Предлагаемый phase-0 runtime entrypoint:

```ts
type CoreRuntimeConfig = {
  postgresUrl: string;
  fastModelBaseUrl: string;
  seedRootPath: string;
  seedConstitutionPath: string;
  seedBodyPath: string;
  seedSkillsPath: string;
  workspaceBodyPath: string;
  workspaceSkillsPath: string;
  modelsPath: string;
  dataPath: string;
  host: string;
  port: number;
};

interface CoreRuntimeApp {
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<{
    ok: boolean;
    postgres: boolean;
    fastModel: boolean;
    configuration: boolean;
  }>;
}
```

- HTTP surface в phase 0 ограничивается:
  - `GET /health`
- `GET /health` используется для container readiness/smoke и не подменяет будущую operator API из `CF-009`.
- Platform health surface remains owned by `F-0002`: later seams may enrich `GET /health` with their diagnostics, but they do not inherit authority over readiness semantics, startup dependency policy or the public boundary itself.
- Materialization contract для reopened change:
  - `/seed` mounts tracked initialization content in read-only mode;
  - writable `/workspace`, `/models` и `/data` are created or attached separately from `seed`;
  - startup materializes required body/skills/bootstrap files from `seed` before boot handoff;
  - reseed or reset semantics must be explicit and may not silently overwrite live runtime state.
- Root quality gate contract для `SL-F0002-06`:
  - `pnpm format` и `pnpm format:check` используют `Biome` formatter against repo code + root config files.
  - `pnpm lint` и `pnpm lint:fix` выполняют composite lint stage: `Biome` lint pass plus root `ESLint` typed lint config.

### 5.2 Data model changes

- Эта фича владеет infra bootstrap для PostgreSQL, но не полным domain schema phase 0/1.
- В scope входят:
  - механизм применения baseline migrations из `infra/migrations/`;
  - readiness для `pg-boss`;
  - schema-version/bootstrap metadata, достаточные для boot/runtime wiring.
- Не входят:
  - полноценные доменные таблицы `ticks`, `episodes`, `goals`, `beliefs`, `memetic_units` и т.д.; ими владеют следующие feature seams.
- Если для containerized boot smoke понадобится минимальный boot-related metadata layer, он должен быть ограничен platform/bootstrap boundary и не захватывать domain ownership у `CF-002`/`CF-003`.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- Compose cell стартует при валидном `core`, но `constitution.yaml` не примонтирован или недоступен по expected path.
- `seed` и writable runtime volume accidentally point to the same tracked host path, из-за чего generated files снова попадают в Git workspace.
- Materialization step silently overwrites an already-lived body/worktree instead of only initializing an empty or explicitly reset runtime volume.
- PostgreSQL поднимается, но baseline migration/bootstrap не применён, из-за чего boot health даёт ложноположительный сигнал.
- `vllm-fast` недоступен или ещё не готов принимать OpenAI-compatible requests, а `core` ошибочно считает cell “готовой”.
- Локальный host filesystem не позволяет desired mount posture или non-root запись в нужные volumes.
- Уже реализованный `F-0001` проходит in-memory tests, но не отражает фактический dependency set containerized cell.
- Formatter/linter применяются только к `src`, но пропускают `test`, что делает gate sequence частичным.
- Typecheck охватывает application code, но не включает test files, из-за чего порядок `format -> typecheck -> lint` не является полным repo contract.
- Локальный или CI gate начинает с lint, а форматирование остаётся ручным шагом, что приводит к шумным diff и нестабильному стилю.

## 6. Definition of Done

- Phase-0 platform scaffold и deployment cell согласованы с разделами `3.1`, `5.1`, `6` и `14.2`-`14.5` архитектуры либо имеют явные ADR-оговорки.
- Root monorepo и package/workspace manifests позволяют единообразно запускать checks и локальную cell orchestration через `pnpm`.
- Docker Compose bootstrap и smoke/invariant suite проверяют минимум: Postgres connectivity, `vllm-fast` reachability, read-only `seed` boundary, materialized runtime `workspace/data/model` surfaces и readiness `core`.
- `F-0001` обновлён через controlled `change-proposal`, а не остаётся со старыми boot assumptions.
- Tracked repo content and mutable runtime state are no longer mixed: `seed/*` remains the only initialization boundary, while `workspace/*`, `models/*` and `data/*` are treated as generated runtime volumes.
- Root quality/style gates для source и tests поставлены как единый contract с порядком `format -> typecheck -> lint`.
- `docs/ssot/index.md` синхронизирован, dossier lint проходит без ошибок и предупреждений.

## 7. Slicing plan (2–8 increments)

### Slice SL-F0002-01: Monorepo scaffold normalization
Delivers: root/platform scaffold, который делает repo shape и package boundaries явными и каноническими.
Covers: AC-F0002-01
Exit criteria:
- `pnpm` workspace однозначно описывает apps/packages.
- Repo layout либо приведён к архитектуре, либо точечные отклонения зафиксированы документально.
Tasks:
- **T-F0002-01:** Нормализовать root `pnpm`/TypeScript scaffold и root scripts для platform workflows. Covers: AC-F0002-01.
- **T-F0002-02:** Добавить отсутствующие baseline package/app/layout placeholders и manifests для phase-0 monorepo shape. Covers: AC-F0002-01.

### Slice SL-F0002-02: Core process entrypoint and minimal health boundary
Delivers: явный `polyphony-core` entrypoint на каноническом стеке с env/config contract и минимальной health/readiness boundary.
Covers: AC-F0002-02
Exit criteria:
- `core` стартует как отдельный process entrypoint, а не только через тестовый harness.
- Health boundary не расползается в полноценную operator API.
Tasks:
- **T-F0002-03:** Добавить `polyphony-core` runtime entrypoint и config loading для PostgreSQL, `vllm-fast` и volume paths. Covers: AC-F0002-02.
- **T-F0002-04:** Встроить минимальную AI SDK-backed reasoning boundary за `Hono` и `GET /health` без выхода в поздний API scope. Covers: AC-F0002-02.

### Slice SL-F0002-03: Deployment cell and baseline container posture
Delivers: compose-managed phase-0 cell с явными сервисами, сетями, mounts и baseline posture.
Covers: AC-F0002-03, AC-F0002-04
Exit criteria:
- Compose описывает `core`, `postgres`, `vllm-fast` и их wiring.
- Baseline container posture проверяется конфигом, а отклонения документируются.
Tasks:
- **T-F0002-05:** Добавить Dockerfiles/Compose manifests для phase-0 deployment cell и internal networks. Covers: AC-F0002-03.
- **T-F0002-06:** Зафиксировать baseline mount policy и container posture (`non-root`, no `privileged`, no `docker.sock`) или ADR-отклонения. Covers: AC-F0002-04.

### Slice SL-F0002-04: PostgreSQL bootstrap and cell smoke suite
Delivers: infra bootstrap для Postgres/`pg-boss` readiness и smoke/invariant suite для containerized startup.
Covers: AC-F0002-05
Exit criteria:
- Platform bootstrap можно выполнить неинтерактивно.
- Smoke suite ловит broken DB/model/mount wiring до запуска higher-level runtime features.
Tasks:
- **T-F0002-07:** Реализовать baseline migration/bootstrap path для PostgreSQL и `pg-boss` readiness. Covers: AC-F0002-05.
- **T-F0002-08:** Добавить containerized smoke/invariant suite для readiness `core`, Postgres, constitution volume и `vllm-fast`. Covers: AC-F0002-05.

### Slice SL-F0002-05: F-0001 realignment to the delivered cell
Delivers: согласованное состояние docs/runtime boundary, в котором boot/recovery больше не опирается на несуществующий substrate.
Covers: AC-F0002-06
Exit criteria:
- `F-0001` отражает delivered dependency set и verification path.
- Изменение оформлено как controlled realignment, а не как неявный drift.
Tasks:
- **T-F0002-09:** Подготовить и применить `change-proposal` к `F-0001` по `depends_on`, boot assumptions и verification plan. Covers: AC-F0002-06.

### Slice SL-F0002-06: Root quality gates and GitHub Actions test automation
Delivers: единый formatter/typecheck/lint/test contract для source и tests на root-level `pnpm` interface плюс минимальный GitHub Actions testing workflow без расхождения с локальным automation path.
Covers: AC-F0002-07, AC-F0002-08
Exit criteria:
- Root commands одинаково покрывают application и test code и остаются единственным automation contract для локального и GitHub Actions paths.
- Repo-level flow и GitHub Actions testing workflow явно фиксируют порядок `quality:check` затем `test` без скрытого shell-only обходного пути.
Tasks:
- **T-F0002-10:** Выбрать и закрепить единый formatter/linter toolchain и root commands для source/test code. Covers: AC-F0002-07.
- **T-F0002-11:** Реализовать и задокументировать канонический gate sequence `format/check -> typecheck -> lint -> test` для local и GitHub Actions testing workflows. Covers: AC-F0002-08.
- **T-F0002-12:** Добавить `.github/workflows/test.yml` с trigger-ами `pull_request` и `push` в `master`, `Node.js 22`, repo-level `pnpm` setup и вызовом `pnpm quality:check` затем `pnpm test`. Covers: AC-F0002-07, AC-F0002-08.
- **T-F0002-13:** Добавить platform-level test coverage, которая проверяет GitHub Actions workflow triggers и использование canonical root commands без альтернативного CI command path. Covers: AC-F0002-07, AC-F0002-08.

### Slice SL-F0002-07: Seed initialization boundary and materialized runtime volumes
Delivers: immutable `seed` initialization layout, separated writable runtime volumes and deterministic materialization rules that prevent tracked repo content from mixing with generated runtime state.
Covers: AC-F0002-01, AC-F0002-02, AC-F0002-03, AC-F0002-04, AC-F0002-05, AC-F0002-06
Exit criteria:
- Tracked initialization content is mounted only through `/seed` in read-only mode.
- `workspace/*`, `models/*` and `data/*` are materialized writable runtime volumes and no longer act as canonical tracked repo content.
- Boot/runtime checks and smoke coverage prove the `seed -> materialized runtime` handoff before active startup.
Tasks:
- **T-F0002-14:** Move tracked initialization body, skills, constitution and any bootstrap manifests under `seed/*` and update root scaffold guidance accordingly. Covers: AC-F0002-01, AC-F0002-02.
- **T-F0002-15:** Rewire the deployment cell to mount `/seed` read-only and attach separate writable runtime volumes for `/workspace`, `/models` and `/data`. Covers: AC-F0002-03, AC-F0002-04.
- **T-F0002-16:** Implement deterministic materialization of writable runtime body/skills/bootstrap files from `seed` before active boot handoff, without silent overwrite of live runtime state. Covers: AC-F0002-02, AC-F0002-05.
- **T-F0002-17:** Realign `F-0001`, ignore policy and platform verification so boot/recovery and repo hygiene follow the new `seed` boundary. Covers: AC-F0002-06.

### Slice SL-F0002-08: AI SDK substrate realignment
Delivers: platform-level replacement of the historical Mastra runtime substrate with `AI SDK + Hono`, keeping the same deployment cell, health-only public boundary and seed/materialized-runtime contract.
Covers: AC-F0002-01, AC-F0002-02
Exit criteria:
- `apps/core` no longer depends on `@mastra/core` for phase-0 runtime startup.
- The canonical phase-0 entrypoint uses AI SDK provider wiring for local OpenAI-compatible model services and keeps `GET /health` as the only public route.
- Platform docs and runtime naming no longer encode Mastra as the canonical substrate.
Tasks:
- **T-F0002-18:** Replace the historical `phase0-mastra` bootstrap with an AI SDK-backed runtime boundary and align file/module naming with the new substrate. Covers: AC-F0002-01, AC-F0002-02.
- **T-F0002-19:** Keep `Hono` as the sole HTTP ingress and prove that the phase-0 public surface remains health-only after the substrate migration. Covers: AC-F0002-02.

## 8. Suggested issue titles

- `F-0002 / SL-F0002-01 Monorepo scaffold normalization` → [SL-F0002-01](#slice-sl-f0002-01-monorepo-scaffold-normalization)
- `F-0002 / SL-F0002-02 Core process entrypoint and minimal health boundary` → [SL-F0002-02](#slice-sl-f0002-02-core-process-entrypoint-and-minimal-health-boundary)
- `F-0002 / SL-F0002-03 Deployment cell and baseline container posture` → [SL-F0002-03](#slice-sl-f0002-03-deployment-cell-and-baseline-container-posture)
- `F-0002 / SL-F0002-04 PostgreSQL bootstrap and cell smoke suite` → [SL-F0002-04](#slice-sl-f0002-04-postgresql-bootstrap-and-cell-smoke-suite)
- `F-0002 / SL-F0002-05 F-0001 realignment to the delivered cell` → [SL-F0002-05](#slice-sl-f0002-05-f-0001-realignment-to-the-delivered-cell)
- `F-0002 / SL-F0002-06 Root quality gates and GitHub Actions test automation` → [SL-F0002-06](#slice-sl-f0002-06-root-quality-gates-and-github-actions-test-automation)
- `F-0002 / SL-F0002-07 Seed initialization boundary and materialized runtime volumes` → [SL-F0002-07](#slice-sl-f0002-07-seed-initialization-boundary-and-materialized-runtime-volumes)
- `F-0002 / SL-F0002-08 AI SDK substrate realignment` → [SL-F0002-08](#slice-sl-f0002-08-ai-sdk-substrate-realignment)

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0002-01 | `test/platform/monorepo-scaffold.test.ts` → `test("AC-F0002-01 exposes the canonical pnpm monorepo scaffold and workspace layout")`; `apps/core/test/platform/core-runtime.test.ts` → `test("AC-F0002-01 loads the phase-0 runtime config from env and repo defaults")` | planned |
| AC-F0002-02 | `apps/core/test/platform/core-runtime.test.ts` → `test("AC-F0002-02 serves a minimal GET /health boundary with readiness state")`; `apps/core/test/platform/core-runtime.test.ts` → `test("AC-F0002-02 materializes writable runtime paths from seed before startup handoff")`; `apps/core/test/platform/core-runtime.test.ts` → `test("AC-F0002-02 keeps the phase-0 boundary health-only and surfaces dependency loss after startup")` | planned |
| AC-F0002-03 | `infra/docker/test/compose-config.test.ts` → `test("AC-F0002-03 renders the canonical compose cell with phase-0 service wiring")` | done |
| AC-F0002-04 | `infra/docker/test/container-posture.test.ts` → `test("AC-F0002-04 enforces baseline container posture and declared mounts")`; `apps/core/test/platform/runtime-seed.test.ts` → `test("AC-F0002-04 rejects runtime paths that collapse back under the tracked seed boundary")` | done |
| AC-F0002-05 | `apps/core/test/platform/runtime-seed.test.ts` → `test("AC-F0002-05 materializes empty runtime volumes from seed and preserves live runtime state on reuse")`; `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0002-05 initializes postgres and pgboss readiness before core reports ready")` | done |
| AC-F0002-06 | `docs/features/F-0001-constitutional-boot-recovery.md`; `apps/core/test/platform/containerized-boot.integration.test.ts` → `test("AC-F0002-06 aligns F-0001 boot assumptions with the delivered deployment cell")` | done |
| AC-F0002-07 | `test/platform/root-quality-gates.test.ts` → `test("AC-F0002-07 exposes canonical quality and style commands for source and test code")`; `test/platform/github-actions-ci.test.ts` → `test("AC-F0002-07 exposes a GitHub Actions testing workflow that reuses the canonical root command contract")` | done |
| AC-F0002-08 | `test/platform/root-quality-gates.test.ts` → `test("AC-F0002-08 preserves the canonical gate order format then typecheck then lint for source and test workflows")`; `test/platform/github-actions-ci.test.ts` → `test("AC-F0002-08 preserves the canonical GitHub Actions order quality:check then test")` | done |

План тестов:

- Root-level smoke checks для workspace/package layout и command contract.
- Containerized smoke/invariant tests against Docker Compose cell.
- Integration tests для `core` entrypoint и minimal health surface.
- Dossier change verification для `F-0001` realignment как часть feature completion.
- Platform verification for the `seed -> materialized runtime` handoff, including repo ignore policy and non-overwrite semantics.
- Root-level config/tests для quality/style commands, GitHub Actions workflow triggers и gate order contract.
- Consumed cross-cutting invariants:
  - `Baseline Router Invariants` in `docs/architecture/system.md` treats router diagnostics as an enrichment of the existing platform-owned health surface, not as a separate readiness authority or public API boundary.

## 10. Decision log (ADR blocks)

### ADR-F0002-01: Baseline container substrate belongs to platform scope, while mature hardening stays separate
- Status: Accepted
- Context: Архитектурный аудит показал, что container/cell/networks/volumes нужны уже в phase 0, но если смешать их с mature safety perimeter, platform bootstrap будет блокироваться поздними governance/hardening задачами.
- Decision: `F-0002` владеет baseline deployment cell, networks, volumes и минимальной container posture, а `CF-014` оставляет за собой restricted-shell hardening, secrets policy maturation, human override flows и richer safety kernel.
- Alternatives: Держать всё container/security в одной поздней фиче; размазать substrate по runtime и infra без единого владельца.
- Consequences: Phase-0 platform substrate появляется вовремя; безопасность не исчезает, но получает отдельный mature seam вместо implicit backlog drift.

### ADR-F0002-02: Phase-0 deployment cell ограничивается `core + postgres + vllm-fast`
- Status: Accepted
- Context: Канонический deployment layout включает jobs, workshop, `vllm-deep` и `vllm-pool`, но phase 0 архитектуры требует только минимальный технический скелет с одним `vllm-fast` и базовым agent runtime.
- Decision: Для `F-0002` обязательной поставкой считаются `core`, `postgres` и `vllm-fast`; `pg-boss` readiness настраивается на platform уровне, но operational ticks/jobs, workshop, `vllm-deep` и `vllm-pool` остаются за следующими feature seams.
- Alternatives: Сразу поднимать всю canonical cell; делать `core` без какого-либо model service и откладывать first organ ещё дальше.
- Consequences: Phase-0 remains implementable; early cell stays faithful to architecture without prematurely absorbing later-phase components.

### ADR-F0002-03: Phase-0 ingress остаётся health-only, хотя runtime уже построен на AI SDK + Hono
- Status: Accepted
- Context: После ADR `2026-03-25` архитектура использует `AI SDK` только как internal reasoning/model-integration слой, а canonical HTTP ingress должен оставаться repo-owned через `Hono`; ранний platform substrate всё ещё не должен преждевременно открывать operator/control API до `CF-009`.
- Decision: `core` поставляется как `TypeScript + AI SDK + Hono` runtime, где AI SDK живёт за internal reasoning boundary, а публичная HTTP surface на этом шаге намеренно ограничена `GET /health`; richer operator routes будут введены отдельной API feature.
- Alternatives: Дать framework-owned server layer стать каноническим ingress; сохранить `Mastra` как phase-0 substrate несмотря на новое repo-level ADR.
- Consequences: Stack и runtime substrate остаются каноническими, но HTTP perimeter по-прежнему минимален и не конфликтует с backlog seam для operator API.

### ADR-F0002-04: `vllm-fast` в phase 0 поставляется как OpenAI-compatible stub service
- Status: Accepted
- Context: Полноценный production `vLLM` runtime тяжелее и требует отдельного model-serving seam, но platform substrate уже сейчас должен иметь реальный service name, network contract и OpenAI-compatible endpoint для `core`.
- Decision: В `F-0002` `vllm-fast` реализован как lightweight Python 3.12 OpenAI-compatible stub container, сохраняющий канонические service name и `/v1/*` contract; полная `vLLM` поставка остаётся за следующим model ecology seam.
- Alternatives: Тянуть полноценный `vLLM` уже в `CF-020`; исключить model service из phase-0 cell совсем.
- Consequences: Deployment cell и router/agent wiring поставлены без ложной смены API-контракта, но inference quality/performance intentionally remain out of scope for this platform feature.

### ADR-F0002-05: Quality/style gates становятся частью platform contract, а не локальной настройки пакета
- Status: Accepted
- Context: После поставки базового monorepo scaffold выяснилось, что root-level commands покрывают runtime и smoke checks, но не закрепляют formatter/linter toolchain и порядок quality gates для source и tests.
- Decision: Расширить `F-0002` через controlled `change-proposal`, чтобы canonical root scaffold включал formatter/linter contract для application и test code, а repo-level decision о порядке `format -> typecheck -> lint` был вынесен в cross-cutting ADR.
- Alternatives: Оставить quality/style gates на усмотрение отдельных пакетов; оформить их как отдельную позднюю governance feature.
- Consequences: Root scaffold становится полнее и лучше соответствует архитектурным hooks/gates expectations, а последующая реализация может идти без повторного выбора базового quality contract и без повторного спора о `Biome` vs `ESLint`.

### ADR-F0002-06: GitHub Actions становится каноническим minimum-CI substrate для root automation contract
- Status: Accepted
- Context: После фиксации root-level quality gates и container smoke у репозитория остаётся локальный automation contract, но нет in-repo CI substrate, который повторяет его на pull request boundary. Пользовательский запрос требует завести GitHub Actions как минимум для test workflow, не вводя параллельный набор CI-команд и не растягивая change сразу до полного deploy/promotion pipeline.
- Decision: Расширить `F-0002` через controlled `change-proposal`, чтобы минимальный GitHub Actions testing workflow стал частью platform contract. Первая поставка обязана жить в `.github/workflows/*`, запускаться как минимум на `pull_request` и `push` в `master` и использовать existing root `pnpm quality:check` затем `pnpm test`; deploy/release automation остаётся за следующим отдельным shaping step.
- Alternatives: Оставить CI внешним или ручным процессом; оформить GitHub Actions как отдельную новую feature вне `F-0002`; пытаться сразу доставить полный CD/promotion pipeline без промежуточного CI baseline.
- Consequences: PR-level automation становится частью canonical repo scaffold, local и GitHub Actions paths остаются согласованными, а более тяжёлые deploy/release workflows можно shape-ить отдельно без повторного спора о базовом CI substrate.

### ADR-F0002-07: `seed` становится единственным tracked initialization boundary, а все остальные runtime volumes считаются generated state
- Status: Accepted
- Context: Текущая volume policy смешивает tracked repo content (`workspace/body`, `workspace/skills`, `workspace/constitution`) с writable runtime areas (`models`, `data`). В таком дизайне Git hygiene и runtime behavior конфликтуют: generated outputs оказываются рядом с canonical source, а ignore policy превращается в набор исключений по паттернам.
- Decision: В platform contract вводится единый read-only `/seed` mount как источник tracked initialization content. `body`, `skills`, `constitution` и любые bootstrap manifests должны входить в cell через `/seed`, а writable `/workspace`, `/models` и `/data` materialize-иться отдельно и считаться generated runtime state. Worktrees, body evolution и runtime outputs больше не имеют права мутировать `/seed` напрямую.
- Alternatives: Продолжать смешивать tracked и generated content в `workspace/*`; игнорировать only-selected patterns внутри live body tree; оставить разделение на усмотрение поздних body/skills features.
- Consequences: Repo hygiene становится детерминированной, все non-seed volumes можно защищать ignore policy без двусмысленности, а будущие body/skills/workshop seams получают жёсткую ownership boundary между versioned seed и mutable runtime state.

## 11. Progress & links

- Status: `proposed` → `shaped` → `planned` → `done` → `planned` → `done` → `planned` → `done` → `planned` → `done` → `planned`
- Issue: -
- PRs:
  - -
- Code:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `.dockerignore`
  - `apps/core/src/main.ts`
  - `apps/core/src/platform/core-config.ts`
  - `apps/core/src/platform/core-runtime.ts`
  - `apps/core/src/platform/runtime-seed.ts`
  - `apps/core/src/platform/phase0-mastra.ts`
  - `apps/core/test/platform/core-runtime.test.ts`
  - `apps/core/test/platform/runtime-seed.test.ts`
  - `apps/core/test/platform/containerized-boot.integration.test.ts`
  - `packages/db/src/bootstrap.ts`
  - `packages/db/src/cli/bootstrap.ts`
  - `infra/docker/compose.yaml`
  - `infra/docker/core/Dockerfile`
  - `infra/docker/vllm-fast/Dockerfile`
  - `infra/docker/vllm-fast/server.py`
  - `infra/docker/test/compose-config.test.ts`
  - `infra/docker/test/container-posture.test.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/001_platform_bootstrap.sql`
  - `.github/workflows/test.yml`
  - `biome.json`
  - `eslint.config.js`
  - `tsconfig.eslint.json`
  - `test/platform/github-actions-ci.test.ts`
  - `test/platform/root-quality-gates.test.ts`
  - `README.md`
  - `AGENTS.md`
  - `.gitignore`
  - `docs/architecture/system.md`
  - `docs/backlog/feature-candidates.md`
  - `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
  - `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
  - `docs/features/F-0001-constitutional-boot-recovery.md`
  - `seed/constitution/constitution.yaml`

## 12. Change log

- **v1.0 (2026-03-19):** Initial dossier created from candidate `CF-020` via feature intake.
- **v1.1 (2026-03-19):** Expanded dossier into compact platform spec with testable AC, deployment cell design, DoD and two platform-scope ADR decisions.
- **v1.2 (2026-03-19):** Added execution-ready slice plan, task map and planned coverage references; status advanced to `planned`.
- **v1.3 (2026-03-19):** Implemented the canonical `pnpm` monorepo scaffold, `TypeScript + Mastra + Hono` phase-0 core entrypoint, PostgreSQL/`pg-boss` bootstrap path, buildable Docker Compose deployment cell and AC-linked scaffold/container tests; status advanced to `done`.
- **v1.4 (2026-03-19):** Added two implementation ADRs documenting the deliberate phase-0 boundary: health-only ingress despite Mastra runtime substrate, and an OpenAI-compatible `vllm-fast` stub that preserves service wiring until the dedicated model-serving seam lands.
- **v1.5 (2026-03-19):** Applied a controlled change proposal to extend `F-0002` with root-level quality/style gates for source and tests, including new AC for shared formatter/linter coverage and the canonical gate order `format -> typecheck -> lint`; status returned to `planned` pending implementation.
- **v1.6 (2026-03-19):** Implemented `SL-F0002-06` by adding root-level Biome-based `format/format:check/lint/lint:fix` commands, canonical `quality:fix` and `quality:check` sequences, expanded typechecking to repo tests and `infra/**/*.ts`, AC-linked platform tests for the gate contract, and updated developer-facing repo guidance; status advanced back to `done`.
- **v1.7 (2026-03-19):** Applied a corrective change proposal to the quality-gate contract after aligning with the reference `aequitas-api` stack: `Biome` remains the formatter/style checker, while root typed linting is provided by `ESLint`; root scripts, config files, developer guidance and AC-linked tests were updated accordingly while preserving the canonical gate order `format -> typecheck -> lint`.
- **v1.8 (2026-03-21):** Applied a controlled change proposal to extend `F-0002` with GitHub Actions minimum-CI coverage: `AC-F0002-07` and `AC-F0002-08` now require an in-repo GitHub Actions testing workflow that reuses the canonical root automation contract (`pnpm quality:check` then `pnpm test`) on `pull_request` and `push` to `master`; status returned to `planned` pending implementation.
- **v1.9 (2026-03-21):** Implemented the minimum GitHub Actions testing substrate by adding `.github/workflows/test.yml` for `pull_request` and `push` to `master`, wiring it to `Node.js 22`, `pnpm quality:check` and `pnpm test`, adding AC-linked platform tests for workflow triggers/order, and updating developer-facing runtime notes; status advanced back to `done`.
- **v1.10 (2026-03-21):** Removed the fixed `pnpm` version pin from `.github/workflows/test.yml` so the minimum CI workflow keeps using the canonical repo-level `pnpm` contract without coupling the workflow to a hard-coded package-manager version.
- **v1.11 (2026-03-22):** Applied a controlled platform change proposal that replaces mixed tracked/runtime volume ownership with a `seed -> materialized runtime volumes` boundary: architecture and backlog now treat `seed/*` as the only tracked initialization source, while `workspace/*`, `models/*` and `data/*` become generated runtime state; `F-0002` status returned to `planned` pending implementation.
- **v1.12 (2026-03-22):** Implemented `SL-F0002-07` by moving tracked initialization content to `seed/*`, rewiring the deployment cell to mount read-only `/seed` plus writable named runtime volumes, materializing runtime body/skills/models/data before active boot handoff, aligning `F-0001` and the phase-0 deployment ADR to the new boundary, and enforcing repo hygiene by ignoring all non-seed runtime volumes; status advanced back to `done`.
- **v1.13 (2026-03-24):** `change-proposal`: aligned `F-0002` with the architecture-level baseline router invariants by making the platform-owned health boundary explicit. `GET /health` remains the readiness and diagnostics surface owned by the platform seam, while router-provided profile diagnostics only enrich that payload and do not create a second platform authority.
- **v1.14 (2026-03-25):** `change-proposal`: applied the repo-level runtime-substrate migration from `Mastra` to `AI SDK`. `F-0002` now defines the canonical phase-0 platform as `TypeScript + AI SDK + Hono`, adds an explicit platform refactor slice for replacing the historical `phase0-mastra` boundary, and returns to `planned` until the delivered runtime entrypoint and dependency baseline are physically migrated.
