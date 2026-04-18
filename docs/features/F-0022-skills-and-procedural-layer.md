---
id: F-0022
title: Слой skills и процедур
status: shaped
coverage_gate: deferred
owners: ["@codex"]
area: skills
depends_on: ["F-0002", "F-0010", "F-0020"]
impacts: ["runtime", "workspace", "tooling", "skills"]
created: 2026-04-18
updated: 2026-04-18
links:
  issue: ""
  pr: []
  docs:
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/backlog/feature-candidates.md"
    - "docs/backlog/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-013
  - Backlog delivery state at intake: defined
  - Canonical backlog read used for intake:
    - `backlog-engineer status`
    - `backlog-engineer queue`
    - `backlog-engineer items --item-keys "CF-013"`
  - Supporting source traceability:
    - ../architecture/system.md
    - ../polyphony_concept.md
    - ../backlog/feature-candidates.md
    - ../backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-007
    - CF-020
    - CF-023
  - Intake reconciliation note:
    - Intake follows the canonical backlog truth for `CF-013`: `delivery_state=defined`, no blockers, dependencies `CF-007`, `CF-020`, `CF-023`.
    - No backlog actualization was required during intake because the source set and dependency set remained aligned with the current backlog graph.
- **User problem:** Архитектура и концепт уже фиксируют skills как отдельный procedural layer тела, но в репозитории ещё нет явного контракта, который отделяет canonical skill package от ad hoc prompt snippets, runtime-local copies и framework-owned helper surfaces. Пока этот seam не оформлен, непонятно, что именно считается skill, где живёт source of truth и когда skill можно считать реально пригодным к использованию runtime.
- **Goal:** Зафиксировать один canonical owner seam для repo-owned versioned skill packages: `seed/skills` остаётся Git-tracked source of truth, `workspace/skills` остаётся materialized writable runtime tree, runtime adapter читает materialized package и проецирует его в AI SDK-compatible prompt/tool surface, а usable-skill proof для первой версии определяется как `корректный package в seed -> materialization в workspace -> успешная загрузка adapter'ом`.
- **Non-goals:** Эта фича не вводит lifecycle-state модель для skills, не создаёт отдельный DB/runtime registry, не переоткрывает bounded tool admission из `F-0010`, не превращается в workshop/governor review pipeline и не поглощает broader body-evolution lifecycle.
- **Current substrate / baseline:** `F-0002` уже закрепил canonical `seed/** -> workspace/**` materialization boundary, включая `seed/skills` и `workspace/skills`. `F-0010` уже владеет bounded action/tool contract. `F-0020` и repo-level AI SDK ADR уже закрепили runtime substrate, поэтому `F-0022` может формализовать skills как repo-owned procedural packages без передачи ownership framework-слою и без добавления новой lifecycle surface.

### Terms & thresholds

- **Versioned skill package:** Git-tracked package под `seed/skills/<skill-id>/`, который представляет навык как repo-owned procedural artifact, а не как runtime-local или framework-owned helper.
- **Materialized skills tree:** writable runtime tree под `workspace/skills/`, полученный из `seed/skills` и допускающий runtime-local derivatives без мутации seed boundary.
- **Skill adapter load:** bounded runtime operation, которая читает materialized skill package и строит AI SDK-compatible prompt/tool surface, не забирая ownership над packaging.
- **Usable skill:** skill, который одновременно имеет корректный canonical package в `seed/skills`, materialized copy в `workspace/skills` и успешный adapter load для текущего runtime.

## 2. Scope

### In scope

- Canonical owner seam для skills как repo-owned versioned procedural packages, а не как свойства tools, prompts или model profiles.
- Явное разделение между `seed/skills` как Git-tracked source of truth и `workspace/skills` как materialized writable runtime tree.
- Канонический package contract для skill folder, центрированный вокруг `SKILL.md` и bounded support subtrees `references/`, `scripts/`, `assets/`.
- Adapter boundary, через который runtime читает materialized skills и проецирует их в AI SDK-compatible prompt/tool surface.
- Явное usable-skill proof для первой версии: `package present and valid -> materialized -> adapter loaded`.
- Fail-closed semantics для invalid package, broken materialization, unreadable skill package и adapter-load failure.

### Out of scope

- Любая lifecycle-state модель вида `draft/active/deprecated` или отдельный approval pipeline для skills.
- Отдельный DB/runtime registry, который ведёт skill lifecycle независимо от package tree.
- Tool admission, capability authorization и bounded action semantics из `F-0010`.
- Workshop/governor-owned mutation review, specialist rollout, release automation и broader governance seams.
- Генеративное изменение identity core, memory, PSM, narrative spine или constitution surfaces.

### Constraints

- Skills остаются procedural layer тела и не могут трактоваться как память, identity-bearing runtime owner или самостоятельный model-serving substrate.
- Канонический source of truth для skills остаётся только в `seed/skills`; runtime-generated content и mutable derivatives не должны silently становиться tracked source.
- Runtime работает с materialized tree в `workspace/skills`, а не присваивает прямое writable ownership над `seed/skills`.
- Runtime adapter может только проецировать skills в AI SDK-compatible prompt/tool surface; packaging ownership и usable-skill truth не переходят framework-слою.
- При invalid package, materialization failure или adapter-load failure система обязана fail-closed и не может подменять skill raw prompt snippet'ом или ad hoc script'ом.
- Stage остаётся на каноническом repo stack из `README.md`: `pnpm`, `Node.js 22`, `TypeScript`, `AI SDK`, корневые quality gates и container smoke path для runtime-affecting implementations.

### Assumptions (optional)

- Delivered prerequisites `F-0002`, `F-0010` и `F-0020` уже достаточны, чтобы оформить explicit skills seam без reopening deployment cell, bounded action layer или model-serving substrate.
- Для первой версии file/package-oriented seam достаточен; richer governance и registry concerns могут остаться в follow-up seams, если когда-нибудь появится доказанная необходимость.

### Open questions (optional)

- none

### Unresolved-decision triage

#### Normative now

- `F-0022` не вводит lifecycle-state модель для skills; skill трактуется как package contract, а не как stateful entity со стадиями.
- Usable-skill proof для первой версии равен `valid seed package -> materialization -> successful adapter load`.
- `seed/skills` остаётся единственным canonical source of truth, `workspace/skills` остаётся единственным writable runtime tree для skills.
- Runtime не имеет права считать skill usable после package/materialization/load failure и не имеет права silently fallback-ить к ad hoc raw prompts/scripts.

#### Implementation freedom

- Конкретная форма validator/materializer/adapter implementation остаётся implementation freedom, пока она сохраняет canonical roots и observability usable-skill proof.
- Конкретная внутренняя структура adapter projection остаётся implementation freedom, пока packaging ownership не уходит framework-слою и failure semantics остаются явными.
- Конкретная форма owner-only diagnostics/verification output остаётся implementation freedom, пока она даёт наблюдаемый usable/unusable verdict с указанием failing basis.

#### Temporary assumptions

- Первая версия не требует отдельного DB/runtime registry поверх package tree.
- Первая версия не требует отдельного operator-facing activation API; usable-skill truth остаётся внутренним repo/runtime contract.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0022-01:** `F-0022` является единственным canonical owner seam для skills как repo-owned procedural packages.
- **AC-F0022-02:** `F-0002` остаётся owner'ом общего seed/workspace materialization boundary, на которую опирается `F-0022`.
- **AC-F0022-03:** `F-0010` остаётся owner'ом bounded tools/actions и не переезжает в skill packaging seam.
- **AC-F0022-04:** `F-0020` и AI SDK substrate остаются owner'ами runtime model/provider bridge и не становятся owner'ами skill packaging truth.
- **AC-F0022-05:** Навык считается canonical skill только когда он представлен как repo-owned package под `seed/skills/<skill-id>/`.
- **AC-F0022-06:** Canonical skill package contract центрирован вокруг `SKILL.md` и bounded support subtrees `references/`, `scripts/`, `assets/`.
- **AC-F0022-07:** `seed/skills` является единственным Git-tracked source of truth для skills.
- **AC-F0022-08:** Runtime использует materialized writable tree под `workspace/skills` как runtime surface для skills.
- **AC-F0022-09:** Presence только canonical package в `seed/skills` не является достаточным доказательством usable-skill.
- **AC-F0022-10:** Presence только materialized copy в `workspace/skills` не является достаточным доказательством usable-skill.
- **AC-F0022-11:** Успешный runtime adapter load является обязательным условием usable-skill verdict.
- **AC-F0022-12:** Runtime adapter может проецировать skill package в AI SDK-compatible prompt/tool surface без передачи ownership над packaging и usable truth framework-слою.
- **AC-F0022-13:** Invalid skill package делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-14:** Missing или failed materialization делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-15:** Failed adapter load делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-16:** Первая версия seam не вводит lifecycle-state модель для skills.
- **AC-F0022-17:** Первая версия seam не требует отдельного DB/runtime registry для учёта skill lifecycle.
- **AC-F0022-18:** Verification surface обязана явно покрывать package-contract validation.
- **AC-F0022-19:** Verification surface обязана явно покрывать separation `seed/skills` vs `workspace/skills` и materialization correctness.
- **AC-F0022-20:** Verification surface обязана явно покрывать adapter load и fail-closed negative paths.

## 4. Non-functional requirements (NFR)

- **NFR-F0022-01 Provenance visibility:** Для каждого usable skill owner-only diagnostics или verification artifact должны содержать поля `skill_id`, `seed_path`, `workspace_path` и `adapter_load_verdict`. Observable signal: quartet присутствует целиком в одном canonical evidence surface.
- **NFR-F0022-02 Recoverability:** После restart, workspace loss или interrupted materialization/runtime load первая availability check обязана возвращать `usable = false` до нового успешного `materialization + adapter load`. Observable signal: pre-reload verdict остаётся `false`, post-reload verdict становится `true` только после нового successful cycle.
- **NFR-F0022-03 Seed protection:** Канонические runtime flows должны производить `0` write operations under `seed/skills/**`. Observable signal: runtime verification и changed-scope audit не фиксируют mutating writes по seed paths.

## 5. Design (compact)

### 5.1 API surface

- Новый public HTTP/API surface этой фичей не вводится.
- Machine-facing contract этой фичи ограничен внутренним repo/runtime seam:
  1. найти canonical skill package в `seed/skills/<skill-id>/`;
  2. проверить его package contract;
  3. materialize-ить его в `workspace/skills/<skill-id>/`;
  4. загрузить materialized package через runtime adapter;
  5. считать skill usable только после успешного шага 4.
- Компактная структура usable-skill evidence:

```ts
type SkillAvailabilityState = {
  skillId: string;
  seedPath: string;
  workspacePath: string;
  packageShape: "valid" | "invalid";
  materialization: "materialized" | "missing" | "failed";
  adapterLoad: "loaded" | "not_loaded" | "failed";
  usable: boolean;
};
```

- Error interpretation rules:
  - `packageShape = invalid` -> `usable = false`
  - `materialization = missing | failed` -> `usable = false`
  - `adapterLoad = not_loaded | failed` -> `usable = false`
  - `usable = true` допустим только при `valid + materialized + loaded`

### 5.2 Runtime / deployment surface

- Runtime surface стартует от уже delivered boundary `seed/skills -> workspace/skills` из `F-0002`.
- `polyphony-core` и связанные runtime consumers читают только materialized skills; они не становятся owner'ами versioned skill packages.
- AI SDK-compatible prompt/tool projection остаётся adapter concern; framework не становится owner'ом package truth.
- Если later implementation затронет startup/materialization path или runtime admission behavior, repo overlay требует как targeted local verification path, так и containerized smoke path.
- Canonical path semantics:
  - versioned skill authoring происходит только под `seed/skills`;
  - runtime consumption происходит только из `workspace/skills`;
  - путь вне этих roots не считается допустимым source для canonical skill seam.

### 5.3 Data model changes

- Отдельная DB schema change этой фичей не требуется.
- Канонические данные этой фичи — это repo-owned package tree в `seed/skills` и materialized runtime tree в `workspace/skills`.
- Отдельный lifecycle registry, activation table или duplicate skill catalog для первой версии не вводятся.

### 5.4 Edge cases and failure modes

#### Adversarial semantics

| Case | Classification | Operations / boundary | Invariant / observable result | Required proof / rationale |
|---|---|---|---|---|
| Sequential success | specified | `seed package validation -> materialization -> adapter load -> usable verdict` | skill становится usable только после успешного завершения всех трёх шагов для одного и того же `skill_id` | contract + integration |
| Invalid input | specified | malformed package, missing canonical files/subtrees, path outside canonical roots | invalid package никогда не становится usable; observable result — explicit unavailable verdict | contract + negative integration |
| Dependency failure / timeout | specified | materialization failure, unreadable workspace copy, adapter load failure/timeout | failure keeps `usable = false`; система не скрывает failure raw prompt fallback'ом | integration + failure-path coverage |
| Duplicate or replay after completion | specified | повторный validation/materialization/load для того же неизменённого `skill_id` | replay конвергирует к одному skill identity и одному usable verdict; не возникает второй logical skill identity | integration |
| Concurrent duplicate or racing request | specified | overlapping materialization/load runs для одного `skill_id` | stale or partial result не может переопределить более свежую current package truth; `usable = true` допустим только для current successful load | integration / race harness |
| Concurrent conflicting request | N/A | эта стадия не вводит public/operator write API, который конкурирующе назначает разные package identities одному `skill_id` | outside current owner boundary |
| Partial side effect / crash / restart | specified | interrupted materialization or adapter load, crash before usable verdict | partial workspace copy или interrupted load не создают usable skill; после restart нужен новый successful materialization/load cycle | restart integration |
| Stale read / late completion | specified | observer reads seed/workspace state до окончания load или после seed change | presence файлов без current successful adapter load не считается usable proof; late success для устаревшей package truth не должен silently публиковать usable verdict | integration + projection contract |

#### Additional failure modes

- Package существует в `seed/skills`, но нарушает canonical shape и потому не допускается до materialization.
- Materialized tree существует, но больше не соответствует current seed truth после изменения source package.
- Adapter может открыть файлы, но не может построить valid AI SDK-compatible projection.
- Runtime-local helper surfaces пытаются masquerade-ить как skills без canonical package contract.

### 5.5 Verification surface / initial verification plan

- `AC-F0022-01`, `AC-F0022-02`, `AC-F0022-03`, `AC-F0022-04`, `AC-F0022-12`, `AC-F0022-16`, `AC-F0022-17`: spec-conformance review против architecture + adjacent feature boundaries.
- `AC-F0022-05`, `AC-F0022-06`, `AC-F0022-07`, `AC-F0022-13`, `AC-F0022-18`: package-contract validation coverage и repo-boundary checks для `seed/skills`.
- `AC-F0022-08`, `AC-F0022-09`, `AC-F0022-10`, `AC-F0022-14`, `AC-F0022-19`: materialization coverage с явным usable/unusable verdict.
- `AC-F0022-11`, `AC-F0022-15`, `AC-F0022-20`: adapter-load integration и fail-closed negative-path coverage.

### 5.6 Representation upgrades (triggered only when needed)

#### Decision list

- Если canonical package отсутствует или invalid, skill unavailable.
- Если materialized copy отсутствует или broken, skill unavailable.
- Если adapter load не был успешным, skill unavailable.
- Только `valid package + materialized copy + successful adapter load` дают usable verdict.

### 5.7 Definition of Done

- `F-0022` явно закрепляет skills как repo-owned procedural packages с отдельным owner seam.
- Граница `seed/skills` vs `workspace/skills` остаётся канонической и не размывается runtime-generated content.
- Usable-skill proof для первой версии выражен без lifecycle-state модели и без отдельного registry.
- Runtime adapter boundary описан так, чтобы framework не забирал ownership над packaging и usable truth.
- Fail-closed semantics для invalid package, materialization failure и adapter-load failure явно описаны.
- Verification plan покрывает package contract, seed/workspace separation, materialization correctness, adapter load и negative paths.

### 5.8 Rollout / usable-skill note (triggered only when needed)

- Первая версия допускает только один canonical порядок usable-skill admission:
  1. author or update canonical package under `seed/skills`;
  2. materialize it into `workspace/skills`;
  3. load the materialized copy through the runtime adapter;
  4. expose the skill as usable only after step 3 succeeds.
- Изменение seed package, потеря workspace copy или load failure возвращают skill в unavailable truth до следующего successful cycle.

## 6. Slicing plan (2–6 increments)

Forecast policy: slices ниже являются implementation forecast, а не отдельными продуктными обещаниями. Коммитмент живёт в AC, Definition of Done и verification gates.

### Dependency visibility

- Depends on: `F-0002`; owner: `@codex`; unblock condition: canonical `seed/skills -> workspace/skills` boundary и writable runtime areas остаются неизменными.
- Depends on: `F-0010`; owner: `@codex`; unblock condition: bounded tool/action contract остаётся отдельным seam и не переезжает в skill packaging.
- Depends on: `F-0020`; owner: `@codex`; unblock condition: AI SDK substrate остаётся adapter/runtime bridge, а не owner'ом skills packaging truth.

### SL-F0022-01: Canonical package contract и ownership boundary

- **Результат:** Явный package contract для skill folder и owner split между `seed/skills`, `workspace/skills` и runtime adapter.
- **Покрывает:** AC-F0022-01, AC-F0022-02, AC-F0022-03, AC-F0022-04, AC-F0022-05, AC-F0022-06, AC-F0022-07.
- **Проверка:** spec-conformance review + package-contract validation coverage.

### SL-F0022-02: Materialization boundary и usable-skill proof

- **Результат:** Явный contract для `seed package -> workspace materialization -> usable verdict`.
- **Покрывает:** AC-F0022-08, AC-F0022-09, AC-F0022-10, AC-F0022-11, AC-F0022-14.
- **Проверка:** materialization integration + usable/unusable decision coverage.

### SL-F0022-03: Runtime adapter load и fail-closed availability

- **Результат:** Runtime adapter читает materialized skill package, а load failure сохраняет unavailable truth без raw fallback behavior.
- **Покрывает:** AC-F0022-12, AC-F0022-13, AC-F0022-15.
- **Проверка:** adapter-load integration + negative-path coverage.

### SL-F0022-04: Verification surface и observability tuple

- **Результат:** Named proof surfaces и owner-only diagnostics, которые делают usable-skill verdict проверяемым и воспроизводимым.
- **Покрывает:** AC-F0022-16, AC-F0022-17, AC-F0022-18, AC-F0022-19, AC-F0022-20; NFR-F0022-01, NFR-F0022-02, NFR-F0022-03.
- **Проверка:** verification bundle + conformance review.

## 7. Task list (implementation units)

- **T-F0022-01:** Зафиксировать canonical validator/contract surface для skill package под `seed/skills`.
- **T-F0022-02:** Реализовать materialization contract `seed/skills -> workspace/skills` без writable mutations по `seed/**`.
- **T-F0022-03:** Реализовать runtime adapter load поверх materialized skills tree и explicit usable/unusable verdict.
- **T-F0022-04:** Добавить fail-closed diagnostics и verification surfaces для invalid package, broken materialization, missing workspace copy и adapter-load failure.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0022-01 | Spec-conformance review of `F-0022` as sole skill-packaging owner seam | planned |
| AC-F0022-02 | Boundary review against `F-0002` ownership of seed/workspace materialization | planned |
| AC-F0022-03 | Boundary review against `F-0010` ownership of bounded tools/actions | planned |
| AC-F0022-04 | Boundary review against `F-0020` and AI SDK substrate ownership | planned |
| AC-F0022-05 | Package-root contract checks for `seed/skills/<skill-id>/` | planned |
| AC-F0022-06 | Skill package shape validation for `SKILL.md`, `references/`, `scripts/`, `assets/` | planned |
| AC-F0022-07 | Seed-protection checks proving `seed/skills` remains the only tracked source of truth | planned |
| AC-F0022-08 | Materialization integration for `seed/skills -> workspace/skills` | planned |
| AC-F0022-09 | Negative proof that seed-only presence does not imply usable skill | planned |
| AC-F0022-10 | Negative proof that workspace-only presence does not imply usable skill | planned |
| AC-F0022-11 | Positive-path integration for `valid package -> materialized copy -> adapter load -> usable verdict` | planned |
| AC-F0022-12 | Adapter-boundary conformance review for AI SDK-compatible projection without ownership transfer | planned |
| AC-F0022-13 | Negative-path coverage for invalid package -> unavailable fail-closed | planned |
| AC-F0022-14 | Negative-path coverage for missing or failed materialization -> unavailable fail-closed | planned |
| AC-F0022-15 | Negative-path coverage for adapter-load failure -> unavailable fail-closed | planned |
| AC-F0022-16 | Spec-conformance proof that v1 introduces no lifecycle-state model | planned |
| AC-F0022-17 | Spec-conformance proof that v1 introduces no separate DB/runtime registry | planned |
| AC-F0022-18 | Final verification bundle links package-contract validation proof | planned |
| AC-F0022-19 | Final verification bundle links seed/workspace separation and materialization proof | planned |
| AC-F0022-20 | Final verification bundle links adapter-load and fail-closed proof | planned |

## 9. Decision log (ADR blocks)

- none

## 10. Progress & links

- Backlog item key: CF-013
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Next expected workflow step: `plan-slice`
- Intake log: `.dossier/logs/F-0022/feature-intake-c01.md`
- Spec log: `.dossier/logs/F-0022/spec-compact-c01.md`
- Issue:
- PRs:

## 11. Change log

- 2026-04-18: Initial dossier created from backlog item `CF-013` at backlog delivery state `defined`.
- 2026-04-18: `spec-compact` shaped the seam as repo-owned skill packaging/materialization/adapter-consumption without lifecycle states or a separate registry.
