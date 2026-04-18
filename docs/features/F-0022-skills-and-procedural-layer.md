---
id: F-0022
title: Слой skills и процедур
status: planned
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
    - `spec-compact` shaped the seam without introducing lifecycle states or a separate registry.
- **User problem:** Архитектура и концепт уже фиксируют skills как отдельный procedural layer тела, но в репозитории всё ещё нет законченного runtime-контракта, который отвечает на простые вопросы: что считается skill, как проверить соответствие skill-спецификации, где лежит canonical source, где лежит runtime-копия и какие skills рантайм вообще имеет право видеть и использовать.
- **Goal:** Зафиксировать implementation-ready план для repo-owned skill packages: `seed/skills` остаётся Git-tracked source of truth, `workspace/skills` остаётся materialized writable runtime tree, встроенная утилита валидации проверяет каждый найденный skill, runtime держит внутренний список только валидных skills, а usable-skill proof для первой версии определяется как `валидный package в seed -> materialization в workspace -> повторная валидация materialized copy -> успешная загрузка adapter'ом`.
- **Non-goals:** Эта фича не вводит lifecycle-state модель для skills, не создаёт отдельный DB/runtime registry, не переоткрывает bounded tool admission из `F-0010`, не превращается в workshop/governor review pipeline, не требует нового public HTTP/CLI surface и не поглощает broader body-evolution lifecycle.
- **Current substrate / baseline:** `F-0002` уже закрепил canonical `seed/** -> workspace/**` materialization boundary, включая `seed/skills` и `workspace/skills`. `F-0010` уже владеет bounded action/tool contract. `F-0020` и repo-level AI SDK ADR уже закрепили runtime substrate, поэтому `F-0022` может формализовать skills как repo-owned procedural packages, встроенный validator и valid-only runtime listing без передачи ownership framework-слою.

### Terms & thresholds

- **Versioned skill package:** Git-tracked package под `seed/skills/<skill-id>/`, который представляет навык как repo-owned procedural artifact, а не как runtime-local helper.
- **Materialized skills tree:** writable runtime tree под `workspace/skills/`, полученный из `seed/skills` и допускающий runtime-local derivatives без мутации seed boundary.
- **Skill validation utility:** встроенная каноническая проверка skill package и всего дерева skills на соответствие skill-спецификации.
- **Valid skill list:** внутренний runtime-список skills, которые найдены в каноническом дереве и прошли валидацию по спецификации.
- **Active skill list:** внутренний runtime-список skills, которые не только валидны, но и успешно загружены adapter'ом для фактического использования.
- **Skill adapter load:** bounded runtime operation, которая читает materialized skill package и строит AI SDK-compatible prompt/tool surface, не забирая ownership над packaging.
- **Usable skill:** skill, который одновременно валиден по спецификации, materialized в `workspace/skills` и успешно загружен runtime adapter'ом.

## 2. Scope

### In scope

- Canonical owner seam для skills как repo-owned versioned procedural packages, а не как свойства tools, prompts или model profiles.
- Явное разделение между `seed/skills` как Git-tracked source of truth и `workspace/skills` как materialized writable runtime tree.
- Канонический package contract для skill folder, центрированный вокруг `SKILL.md` и bounded support subtrees `references/`, `scripts/`, `assets/`.
- Встроенная утилита валидации для одного skill package и для всего дерева skills.
- Внутренний runtime-listing contract, по которому в рантайме листятся только валидные skills.
- Adapter boundary, через который runtime читает materialized skills и проецирует их в AI SDK-compatible prompt/tool surface.
- Auto-reload только по изменениям в `workspace/skills`, включая повторную валидацию и обновление valid/active lists.
- Fail-closed semantics для invalid package, broken materialization, unreadable skill package, invalid-after-reload и adapter-load failure.

### Out of scope

- Любая lifecycle-state модель вида `draft/active/deprecated` или отдельный approval pipeline для skills.
- Отдельный DB/runtime registry, который ведёт skill lifecycle независимо от package tree.
- Tool admission, capability authorization и bounded action semantics из `F-0010`.
- Workshop/governor-owned mutation review, specialist rollout, release automation и broader governance seams.
- Генеративное изменение identity core, memory, PSM, narrative spine или constitution surfaces.
- Новый public HTTP API, operator endpoint или user-facing CLI только ради listing/diagnostics skills в первой версии.

### Constraints

- Skills остаются procedural layer тела и не могут трактоваться как память, identity-bearing runtime owner или самостоятельный model-serving substrate.
- Канонический source of truth для skills остаётся только в `seed/skills`; runtime-generated content и mutable derivatives не должны silently становиться tracked source.
- Runtime работает с materialized tree в `workspace/skills`, а не присваивает прямое writable ownership над `seed/skills`.
- Встроенная утилита валидации является каноническим правилом определения `valid/invalid`; наличие папки само по себе не делает её usable skill.
- Runtime может листить внутри себя только skills из valid skill list; invalid skills не попадают в usable/runtime list.
- Invalid skills не должны использоваться рантаймом, но причины их отбраковки должны оставаться видимыми в owner-only diagnostics.
- Runtime adapter может только проецировать skills в AI SDK-compatible prompt/tool surface; packaging ownership и usable-skill truth не переходят framework-слою.
- Auto-reload в первой версии наблюдает только `workspace/skills`; изменение `seed/skills` само по себе ничего не публикует в runtime, пока не произошло materialization.
- Drift между `seed/skills` и `workspace/skills` обнаруживается не live-watch'ем по seed, а на следующем materialization cycle, startup rematerialization или explicit sync; до этого stale workspace copy не считается новым canonical truth.
- При invalid package, materialization failure или adapter-load failure система обязана fail-closed и не может подменять skill raw prompt snippet'ом или ad hoc script'ом.
- Stage остаётся на каноническом repo stack из `README.md`: `pnpm`, `Node.js 22`, `TypeScript`, `AI SDK`, корневые quality gates и container smoke path для runtime-affecting implementations.

### Assumptions (optional)

- Delivered prerequisites `F-0002`, `F-0010` и `F-0020` уже достаточны, чтобы оформить explicit skills seam без reopening deployment cell, bounded action layer или model-serving substrate.
- Для первой версии file/package-oriented seam достаточен; richer governance и registry concerns могут остаться в follow-up seams, если когда-нибудь появится доказанная необходимость.
- Первая реализация может начать с одного минимального demo-skill, который нужен как доказательство end-to-end пути, а не как полноценный продуктовый skill.

### Open questions (optional)

- none

### Unresolved-decision triage

#### Normative now

- `F-0022` не вводит lifecycle-state модель для skills; skill трактуется как package contract, а не как stateful entity со стадиями.
- Встроенная утилита валидации является каноническим способом определить, соответствует ли skill спецификации.
- Valid skill list строится только из `workspace/skills` после materialization и валидации.
- Active skill list строится только из valid skills после успешного adapter load.
- Runtime auto-reload в первой версии следит только за `workspace/skills`.
- Invalid skills остаются видимыми в diagnostics, но не попадают в runtime list и не считаются usable.

#### Implementation freedom

- Конкретная форма validator/materializer/adapter implementation остаётся implementation freedom, пока сохраняются canonical roots, valid-only listing и fail-closed behavior.
- Конкретная внутренняя структура adapter projection остаётся implementation freedom, пока packaging ownership не уходит framework-слою и failure semantics остаются явными.
- Конкретная форма owner-only diagnostics/verification output остаётся implementation freedom, пока она показывает найденные, валидные и активные skills вместе с причиной отказа.

#### Temporary assumptions

- Первая версия не требует отдельного DB/runtime registry поверх package tree.
- Первая версия не требует отдельного operator-facing activation API; valid/active truth остаётся внутренним repo/runtime contract.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0022-01:** `F-0022` является единственным canonical owner seam для skills как repo-owned procedural packages.
- **AC-F0022-02:** `F-0002` остаётся owner'ом общего seed/workspace materialization boundary, на которую опирается `F-0022`.
- **AC-F0022-03:** `F-0010` остаётся owner'ом bounded tools/actions и не переезжает в skill packaging seam.
- **AC-F0022-04:** `F-0020` и AI SDK substrate остаются owner'ами runtime model/provider bridge и не становятся owner'ами skill packaging truth.
- **AC-F0022-05:** Навык считается canonical skill только когда он представлен как repo-owned package под `seed/skills/<skill-id>/`.
- **AC-F0022-06:** Canonical skill package contract центрирован вокруг `SKILL.md` и bounded support subtrees `references/`, `scripts/`, `assets/`.
- **AC-F0022-07:** `seed/skills` является единственным Git-tracked source of truth для skills.
- **AC-F0022-08:** Runtime использует materialized writable tree под `workspace/skills` как runtime surface для skills.
- **AC-F0022-09:** Presence только canonical package в `seed/skills` не является достаточным доказательством usable skill.
- **AC-F0022-10:** Presence только materialized copy в `workspace/skills` не является достаточным доказательством usable skill.
- **AC-F0022-11:** Успешный runtime adapter load является обязательным условием usable-skill verdict.
- **AC-F0022-12:** Runtime adapter может проецировать skill package в AI SDK-compatible prompt/tool surface без передачи ownership над packaging и usable truth framework-слою.
- **AC-F0022-13:** Invalid skill package делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-14:** Missing или failed materialization делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-15:** Failed adapter load делает skill unavailable и обязует систему fail-closed.
- **AC-F0022-16:** Первая версия seam не вводит lifecycle-state модель для skills.
- **AC-F0022-17:** Первая версия seam не требует отдельного DB/runtime registry для учёта skill lifecycle.
- **AC-F0022-18:** Verification surface обязана явно покрывать package-contract validation.
- **AC-F0022-19:** Verification surface обязана явно покрывать separation `seed/skills` vs `workspace/skills`, materialization correctness и usable proof.
- **AC-F0022-20:** Verification surface обязана явно покрывать adapter load и fail-closed negative paths.
- **AC-F0022-21:** В системе существует встроенная утилита валидации одного skill package на соответствие skill-спецификации.
- **AC-F0022-22:** В системе существует встроенная утилита валидации всего дерева skills, которая разделяет valid и invalid skills.
- **AC-F0022-23:** Внутренний runtime-listing contract публикует только valid skills и не включает invalid entries.
- **AC-F0022-24:** Invalid skills остаются наблюдаемыми в owner-only diagnostics вместе с понятной причиной отказа.
- **AC-F0022-25:** Auto-reload наблюдает только `workspace/skills` и при каждом изменении заново валидирует затронутый skill.
- **AC-F0022-26:** Если skill после reload становится invalid или перестаёт загружаться adapter'ом, он удаляется из active skill list и остаётся unavailable.
- **AC-F0022-27:** Skill может вернуться в active skill list только после нового успешного цикла `validation -> load`.

## 4. Non-functional requirements (NFR)

- **NFR-F0022-01 Provenance visibility:** Для каждого найденного skill owner-only diagnostics или verification artifact должны содержать поля `skill_id`, `seed_path`, `workspace_path`, `validation_verdict`, `adapter_load_verdict` и `active_state`. Observable signal: эти поля присутствуют целиком в одном canonical evidence surface.
- **NFR-F0022-02 Recoverability:** После restart, workspace loss, interrupted materialization или interrupted reload первая availability check обязана возвращать `usable = false` до нового успешного `validation + load`. Observable signal: pre-reload verdict остаётся `false`, post-reload verdict становится `true` только после нового successful cycle.
- **NFR-F0022-03 Seed protection:** Канонические runtime flows должны производить `0` write operations under `seed/skills/**`. Observable signal: runtime verification и changed-scope audit не фиксируют mutating writes по seed paths.

## 5. Design (compact)

### 5.1 API surface

- Новый public HTTP/API surface этой фичей не вводится.
- Machine-facing contract этой фичи ограничен внутренним repo/runtime seam:
  1. найти canonical skill package в `seed/skills/<skill-id>/`;
  2. проверить его встроенной утилитой валидации;
  3. materialize-ить его в `workspace/skills/<skill-id>/`;
  4. повторно проверить materialized copy или всё дерево `workspace/skills`;
  5. включить skill в valid skill list только после успешной валидации;
  6. загрузить валидный materialized package через runtime adapter;
  7. включить skill в active skill list только после успешного шага 6.
- Компактная структура planning-level evidence:

```ts
type SkillValidationResult = {
  skillId: string;
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type SkillTreeValidationResult = {
  rootPath: string;
  allSkills: SkillValidationResult[];
  validSkills: SkillValidationResult[];
  invalidSkills: SkillValidationResult[];
};

type SkillCatalogEntry = {
  skillId: string;
  seedPath: string;
  workspacePath: string;
  validationVerdict: "valid" | "invalid";
  materialization: "materialized" | "missing" | "failed";
  adapterLoad: "loaded" | "not_loaded" | "failed";
  listed: boolean;
  active: boolean;
};
```

- Error interpretation rules:
  - `validationVerdict = invalid` -> `listed = false`, `active = false`
  - `materialization = missing | failed` -> `listed = false`, `active = false`
  - `adapterLoad = not_loaded | failed` -> `active = false`
  - `listed = true` допустим только при `valid + materialized`
  - `active = true` допустим только при `listed + loaded`

### 5.2 Runtime / deployment surface

- Runtime surface стартует от уже delivered boundary `seed/skills -> workspace/skills` из `F-0002`.
- `@yaagi/skills` владеет canonical skill validator, чтением package shape и внутренними validation results.
- `apps/core` владеет путями `seed/skills` и `workspace/skills`, materialization, workspace watcher/reload flow и owner-only diagnostics.
- `polyphony-core` и связанные runtime consumers читают только materialized skills; они не становятся owner'ами versioned skill packages.
- AI SDK-compatible prompt/tool projection остаётся adapter concern; framework не становится owner'ом package truth.
- Invalid skills остаются видимыми только в diagnostics и verification evidence; они не публикуются как runtime-usable.
- Seed/workspace drift reconcile path для первой версии ограничен тремя событиями: startup rematerialization, explicit materialization run и explicit sync. Workspace watcher не обязан и не может сам по себе отслеживать seed drift в реальном времени.
- Если later implementation затронет startup/materialization path или runtime admission behavior, repo overlay требует как targeted local verification path, так и containerized smoke path.
- Canonical path semantics:
  - versioned skill authoring происходит только под `seed/skills`;
  - runtime consumption и watch/reload происходят только под `workspace/skills`;
  - путь вне этих roots не считается допустимым source для canonical skill seam.

### 5.3 Data model changes

- Отдельная DB schema change этой фичей не требуется.
- Канонические данные этой фичи — это repo-owned package tree в `seed/skills` и materialized runtime tree в `workspace/skills`.
- Отдельный lifecycle registry, activation table или duplicate persistent catalog для первой версии не вводятся.
- Planning target для первой версии — внутренний in-memory runtime catalog, который отличает:
  - найденные skills;
  - valid skill list;
  - active skill list.

### 5.4 Edge cases and failure modes

#### Adversarial semantics

| Case | Classification | Operations / boundary | Invariant / observable result | Required proof / rationale |
|---|---|---|---|---|
| Sequential success | specified | `seed validation -> materialization -> workspace validation -> list valid -> adapter load -> list active` | skill становится активным только после успешного завершения всей цепочки для одного и того же `skill_id` | contract + integration |
| Invalid input | specified | malformed package, missing canonical files/subtrees, path outside canonical roots | invalid package никогда не попадает ни в valid list, ни в active list; observable result — explicit diagnostic reason | contract + negative integration |
| Mixed tree | specified | в одном дереве одновременно есть valid и invalid skills | runtime listing содержит только valid skills, diagnostics сохраняет invalid entries с причинами | tree integration |
| Dependency failure / timeout | specified | materialization failure, unreadable workspace copy, adapter load failure/timeout | failure keeps `listed = false` or `active = false`; система не скрывает failure raw prompt fallback'ом | integration + failure-path coverage |
| Duplicate or replay after completion | specified | повторный validation/load для того же неизменённого `skill_id` | replay конвергирует к одному logical skill identity и одному final state | integration |
| Concurrent duplicate or racing request | specified | overlapping reload runs для одного `skill_id` | stale or partial result не может переопределить более свежую current package truth; invalid-after-reload skill не должен вернуться в active list от устаревшего completion | integration / race harness |
| Concurrent conflicting request | N/A | стадия не вводит public/operator write API, который конкурирующе назначает разные package identities одному `skill_id` | outside current owner boundary |
| Partial side effect / crash / restart | specified | interrupted materialization or adapter load, crash before final publication | partial workspace copy или interrupted load не создают active skill; после restart нужен новый successful `validation + load` cycle | restart integration |
| Stale read / late completion | specified | observer reads state до окончания reload или после уже более свежего file change | late completion для устаревшего состояния не должно silently публиковать `listed=true` или `active=true` | integration + projection contract |

#### Additional failure modes

- Package существует в `seed/skills`, но нарушает canonical shape и потому не допускается до materialization.
- Materialized tree существует, но больше не соответствует current seed truth после изменения source package; такая stale copy должна быть выявлена на следующем startup rematerialization, explicit materialization или explicit sync, а не через live watch по seed.
- Skill валиден по структуре, но adapter не может построить usable AI SDK-compatible projection.
- Runtime-local helper surfaces пытаются masquerade-ить как skills без canonical package contract.
- Skill был активен, но после reload стал invalid и должен быть удалён из active list.

### 5.5 Verification surface / initial verification plan

- `AC-F0022-01`, `AC-F0022-02`, `AC-F0022-03`, `AC-F0022-04`, `AC-F0022-12`, `AC-F0022-16`, `AC-F0022-17`: spec-conformance review против architecture + adjacent feature boundaries.
- `AC-F0022-05`, `AC-F0022-06`, `AC-F0022-07`, `AC-F0022-13`, `AC-F0022-18`, `AC-F0022-21`, `AC-F0022-22`: package-contract validation coverage и repo-boundary checks для `seed/skills` и `workspace/skills`.
- `AC-F0022-08`, `AC-F0022-09`, `AC-F0022-10`, `AC-F0022-14`, `AC-F0022-19`, `AC-F0022-23`, `AC-F0022-24`: materialization + valid-only listing coverage с явным usable/unusable verdict.
- `AC-F0022-11`, `AC-F0022-15`, `AC-F0022-20`, `AC-F0022-25`, `AC-F0022-26`, `AC-F0022-27`: adapter-load, reload transitions и fail-closed negative-path coverage.

### 5.6 Representation upgrades (triggered only when needed)

#### Decision list

- Встроенная утилита валидации является canonical proof source для `valid/invalid`.
- Только skills, прошедшие validation после materialization, попадают в valid skill list.
- Только skills из valid skill list после успешного adapter load попадают в active skill list.
- Auto-reload в первой версии реагирует только на `workspace/skills`.
- Invalid skills никогда не маскируются под usable, но всегда должны иметь наблюдаемую причину отказа.

### 5.7 Definition of Done

- `F-0022` явно закрепляет skills как repo-owned procedural packages с отдельным owner seam.
- В системе спроектирована встроенная утилита валидации skill package и всего дерева skills.
- Граница `seed/skills` vs `workspace/skills` остаётся канонической и не размывается runtime-generated content.
- В рантайме существует valid-only internal listing contract.
- Invalid skills исключаются из runtime listing, но остаются видимыми в owner-only diagnostics.
- Auto-reload ограничен `workspace/skills` и не наблюдает `seed/skills` напрямую.
- Usable-skill proof для первой версии выражен без lifecycle-state модели и без отдельного registry.
- Runtime adapter boundary описан так, чтобы framework не забирал ownership над packaging и usable truth.
- Verification plan покрывает package contract, validation utility, valid-only listing, seed/workspace separation, materialization correctness, adapter load, reload transitions и negative paths.

### 5.8 Rollout / usable-skill note (triggered only when needed)

- Первая версия допускает только один canonical порядок admission:
  1. author or update canonical package under `seed/skills`;
  2. validate the package against the skill spec;
  3. materialize it into `workspace/skills`;
  4. validate the materialized copy or the whole workspace tree;
  5. publish the skill into valid skill list;
  6. load the valid materialized copy through the runtime adapter;
  7. publish the skill as active only after step 6 succeeds.
- Изменение seed package само по себе не меняет live runtime state; новый seed truth попадает в рантайм только после startup rematerialization, explicit materialization или explicit sync.
- Потеря workspace copy, invalid-after-reload state, stale workspace copy after rematerialization/sync или load failure возвращают skill в unavailable truth до следующего successful cycle.

## 6. Slicing plan (2–6 increments)

Forecast policy: slices ниже являются implementation forecast, а не отдельными продуктными обещаниями. Коммитмент живёт в AC, Definition of Done и verification gates.

### Dependency visibility

- Depends on: `F-0002`; owner: `@codex`; unblock condition: canonical `seed/skills -> workspace/skills` boundary и writable runtime areas остаются неизменными.
- Depends on: `F-0010`; owner: `@codex`; unblock condition: bounded tool/action contract остаётся отдельным seam и не переезжает в skill packaging.
- Depends on: `F-0020`; owner: `@codex`; unblock condition: AI SDK substrate остаётся adapter/runtime bridge, а не owner'ом skills packaging truth.

### SL-F0022-01: Спецификация skill-пакета и встроенный валидатор

- **Deliverable:** `@yaagi/skills` получает встроенную утилиту проверки одного skill package и всего дерева skills; в `seed/skills` появляется минимальный demo-skill для happy path.
- **Covers:** AC-F0022-05, AC-F0022-06, AC-F0022-07, AC-F0022-13, AC-F0022-18, AC-F0022-21, AC-F0022-22.
- **Verification artifacts:** contract tests на valid package, negative tests на missing `SKILL.md` и bad directory shape, tree-validation tests для mixed valid/invalid skills, changed-code gates `pnpm format`, `pnpm typecheck`, `pnpm lint`.
- **Depends on:** `F-0002`; unblock condition: canonical roots `seed/skills` and `workspace/skills` остаются стабильными.
- **Assumes:** validator остаётся внутренней библиотекой, а demo-skill нужен как доказательство пути, а не как продуктовая функциональность.
- **Fallback:** если текущая skill spec окажется слишком расплывчатой для детерминированной проверки, остановиться на validator contract и вернуть dossier на spec realignment, а не додумывать скрытые правила в коде.
- **Approval / decision path:** operator already chose built-in validation utility и valid-only semantics; re-ask is not required unless implementation reveals contradictory source docs.

### SL-F0022-02: Materialization, valid-only listing и boot-time verdict

- **Deliverable:** после materialization runtime валидирует `workspace/skills`, строит internal valid skill list и не пускает invalid skills в runtime listing.
- **Covers:** AC-F0022-08, AC-F0022-09, AC-F0022-10, AC-F0022-14, AC-F0022-19, AC-F0022-23, AC-F0022-24.
- **Verification artifacts:** integration tests для `seed -> workspace -> validate -> list valid`, mixed-tree tests, negative tests для `seed-only`, `workspace-only`, broken materialization, startup rematerialization / explicit sync proof for stale workspace detection.
- **Depends on:** `SL-F0022-01`; unblock condition: validator и demo-skill уже существуют.
- **Assumes:** valid skill list остаётся внутренним runtime surface и не требует отдельного public API.
- **Fallback:** если boot-time valid-only listing рано тянет лишние runtime surfaces, сохранить listing как internal service consumed by runtime lifecycle only.
- **Approval / decision path:** no extra operator choice needed; user already fixed the rule that runtime lists only valid skills.

### SL-F0022-03: Active load и auto-reload только из `workspace/skills`

- **Deliverable:** runtime следит только за `workspace/skills`, заново валидирует изменённый skill и обновляет active skill list без stale publication.
- **Covers:** AC-F0022-11, AC-F0022-12, AC-F0022-15, AC-F0022-20, AC-F0022-25, AC-F0022-26, AC-F0022-27.
- **Verification artifacts:** reload integration для valid skill, transition tests `valid -> invalid` и `invalid -> valid`, replay tests, race tests для overlapping reload, restart tests.
- **Depends on:** `SL-F0022-02`; unblock condition: single-run validation/list/load behavior already deterministic.
- **Assumes:** existing watcher/runtime substrate in `apps/core` можно расширить без inventing second watcher subsystem.
- **Fallback:** если filesystem watcher оказывается нестабилен на canonical runtime path, сохранить explicit internal reload trigger и заблокировать close-out until dossier/backlog realignment.
- **Approval / decision path:** operator explicitly chose workspace-only auto-reload; change of watch root would require re-approval.

### SL-F0022-04: Diagnostics, drift guard и real usage audit

- **Deliverable:** owner-only diagnostics показывают найденные, валидные и активные skills; добавлен drift guard между skill spec, validator, runtime listing behavior и tests; проведён real usage audit на demo-skill и mixed tree.
- **Covers:** AC-F0022-01, AC-F0022-02, AC-F0022-03, AC-F0022-04, AC-F0022-16, AC-F0022-17, AC-F0022-18, AC-F0022-19, AC-F0022-20, AC-F0022-24; NFR-F0022-01, NFR-F0022-02, NFR-F0022-03.
- **Verification artifacts:** diagnostics contract tests, spec-conformance review against `F-0002`, `F-0010`, `F-0020`, ADR-2026-03-25, real usage audit, final `dossier-verify`, independent review, step-close bundle.
- **Depends on:** `SL-F0022-03`; unblock condition: validation, listing and reload behavior are already observable.
- **Assumes:** diagnostics могут остаться internal-only и не требуют нового operator API.
- **Fallback:** если diagnostics начинают тянуть новый public surface, оставить их internal-only evidence artifact and defer public projection to a follow-up.
- **Approval / decision path:** no extra operator choice needed unless implementation tries to widen scope into public API.

### Allowed stop points

| Stop point | Безопасная причина остановки | Ожидаемая проверка | Что остаётся вне stop point |
|---|---|---|---|
| After `SL-F0022-01` | Validator и skill spec уже детерминированы, но runtime ещё не строит valid list | validator tests и tree-validation tests pass | runtime listing, reload, diagnostics |
| After `SL-F0022-02` | Есть boot-time validation и valid-only list, но нет живого auto-reload | materialization + listing integration pass | reload transitions, race/restart coverage, final audit |
| After `SL-F0022-03` | Основной runtime seam работает end-to-end, включая valid-only reload behavior | reload/revalidation/race coverage pass | diagnostics close-out, final audit, final conformance proof |
| After `SL-F0022-04` | Весь planned scope delivered | full AC coverage, usage audit, step-close bundle pass | future richer skill tooling remains out of scope |

Planning close-out rule: before `plan-slice` step closure, `CF-013` must be actualized from `specified` to `planned`, unless planning reveals a blocker that forces dossier/backlog realignment instead.

### Risk-to-proof mapping

| Risk / edge case | Spec source | Required proof | Slice | Verification artifact | N/A rationale |
|---|---|---|---|---|---|
| Полный happy path проходит без скрытых промежуточных shortcuts | §5.4 Sequential success | `seed validation -> materialization -> workspace validation -> list valid -> adapter load -> list active` yields one stable active skill | `SL-F0022-02` / `SL-F0022-03` | end-to-end integration | — |
| Папка похожа на skill, но не проходит спецификацию | AC-F0022-05/06/13/21 | `validateSkillPackage` returns `valid=false` with concrete reasons; folder never enters valid list | `SL-F0022-01` | contract test | — |
| В дереве одновременно есть valid и invalid skills | AC-F0022-22/23/24 | `validateSkillTree` separates `validSkills` and `invalidSkills`; runtime listing publishes only valid skills | `SL-F0022-01` / `SL-F0022-02` | tree integration | — |
| Skill есть в seed, но ещё не попал в workspace | AC-F0022-09 | `validate(seed)` alone does not produce runtime listing or active state | `SL-F0022-02` | integration test | — |
| В workspace осталась старая копия, но current source truth уже невалидна или не загружена | AC-F0022-10/14/23 | orphaned or stale workspace copy never enters valid or active list without successful current validation and load | `SL-F0022-02` | negative integration | — |
| Materialization или adapter load падает по timeout / dependency failure | §5.4 Dependency failure / timeout | failure keeps `listed=false` or `active=false`; no raw fallback and no silent publish of active state | `SL-F0022-02` / `SL-F0022-03` | failure-path integration | — |
| Повторный reload тех же файлов не создаёт дубликаты | §5.4 Duplicate or replay after completion | same tree snapshot converges to one logical skill identity and one final valid/active state | `SL-F0022-03` | replay integration | — |
| После reload skill становится invalid | AC-F0022-25/26 | `valid -> invalid` transition removes skill from active list and records diagnostic reason | `SL-F0022-03` | reload transition test | — |
| После правки invalid skill снова становится valid | AC-F0022-25/27 | `invalid -> valid` transition restores skill only after successful revalidation and load | `SL-F0022-03` | reload transition test | — |
| Два reload события на один skill происходят почти одновременно | §5.4 concurrent/race semantics | overlapping reloads converge to one final state; stale completion cannot re-add outdated skill | `SL-F0022-03` | race integration | — |
| Старое completion приходит позже нового состояния файлов | §5.4 Stale read / late completion | late completion for stale content cannot publish `listed=true` or `active=true` over fresher state | `SL-F0022-03` | stale-result integration | — |
| Runtime падает во время reload | NFR-F0022-02 | after restart skill is active only if a fresh validation+load succeeds; crash cannot preserve false active state | `SL-F0022-03` | restart integration | — |

### Drift guard и real usage audit

- Drift guard обязан связывать четыре поверхности:
  - skill spec в `F-0022`;
  - встроенный validator;
  - runtime behavior вокруг valid/active listing;
  - tests and diagnostics evidence.
- Real usage audit обязан проверить:
  - discoverability demo-skill;
  - ясное различие между `found`, `valid` и `active`;
  - отсутствие путаницы между `seed/skills` и `workspace/skills`;
  - отсутствие скрытого fallback behavior;
  - понятную причину, по которой invalid skill не попал в runtime list.

## 7. Task list (implementation units)

- **T-F0022-01:** Зафиксировать validator contract для одного skill package и дерева skills в `@yaagi/skills`.
- **T-F0022-02:** Добавить минимальный demo-skill в `seed/skills` как happy-path sample для end-to-end proof.
- **T-F0022-03:** Реализовать materialization + workspace validation path без writable mutations по `seed/**`.
- **T-F0022-04:** Реализовать internal valid skill list и mixed-tree behavior, где invalid skills остаются только в diagnostics.
- **T-F0022-05:** Реализовать runtime adapter load и active skill list поверх valid skills.
- **T-F0022-06:** Реализовать workspace-only reload/revalidation semantics, включая переходы `valid -> invalid` и `invalid -> valid`.
- **T-F0022-07:** Добавить diagnostics, drift guard и real usage audit для demo-skill и reload path.

## 8. Test plan & Coverage map

### Test groups

- **Validator tests:** valid minimal demo-skill, missing `SKILL.md`, bad directory shape, unsupported tree content, mixed valid/invalid skill tree.
- **Runtime listing tests:** valid skill appears in internal list, invalid skill does not appear in internal list, invalid skill stays visible in diagnostics, seed-only presence does not produce runtime listing.
- **Materialization/load tests:** successful `seed -> workspace -> validate -> load`, broken materialization keeps skill out of active list, workspace-only or stale copy does not pass.
- **Auto-reload tests:** workspace change revalidates one skill, `valid -> invalid` removes from list, `invalid -> valid` restores to list, replay/race/stale completion do not corrupt active list.
- **Restart/fail-closed tests:** interrupted load, interrupted reload, adapter failure, restart requires fresh successful validation and load.
- **Usage audit:** clear difference between `found`, `valid` and `active`, no confusion between `seed/skills` and `workspace/skills`, invalid skills hidden from runtime use but not hidden from diagnostics.

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
| AC-F0022-11 | Positive-path integration for `valid package -> materialized copy -> adapter load -> active verdict` | planned |
| AC-F0022-12 | Adapter-boundary conformance review for AI SDK-compatible projection without ownership transfer | planned |
| AC-F0022-13 | Negative-path coverage for invalid package -> unavailable fail-closed | planned |
| AC-F0022-14 | Negative-path coverage for missing or failed materialization -> unavailable fail-closed | planned |
| AC-F0022-15 | Negative-path coverage for adapter-load failure -> unavailable fail-closed | planned |
| AC-F0022-16 | Spec-conformance proof that v1 introduces no lifecycle-state model | planned |
| AC-F0022-17 | Spec-conformance proof that v1 introduces no separate DB/runtime registry | planned |
| AC-F0022-18 | Final verification bundle links package-contract validation proof | planned |
| AC-F0022-19 | Final verification bundle links seed/workspace separation, materialization proof and valid-only listing proof | planned |
| AC-F0022-20 | Final verification bundle links adapter-load, reload and fail-closed proof | planned |
| AC-F0022-21 | Unit/contract tests for built-in single-package validator | planned |
| AC-F0022-22 | Tree-validation tests for mixed valid/invalid skill sets | planned |
| AC-F0022-23 | Integration tests proving runtime list contains only valid skills | planned |
| AC-F0022-24 | Diagnostics contract tests proving invalid skills remain observable with reason | planned |
| AC-F0022-25 | Reload integration proving workspace-only watch and revalidation | planned |
| AC-F0022-26 | Transition tests proving `valid -> invalid` removes skill from active list | planned |
| AC-F0022-27 | Transition tests proving `invalid -> valid` restores skill only after successful revalidation and load | planned |

## 9. Decision log (ADR blocks)

- none

## 10. Progress & links

- Backlog item key: CF-013
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Next expected workflow step: `implementation`
- Intake log: `.dossier/logs/F-0022/feature-intake-c01.md`
- Spec log: `.dossier/logs/F-0022/spec-compact-c01.md`
- Plan log: `.dossier/logs/F-0022/plan-slice-c01.md`
- Issue:
- PRs:

## 11. Change log

- 2026-04-18: Initial dossier created from backlog item `CF-013` at backlog delivery state `defined`.
- 2026-04-18: `spec-compact` shaped the seam as repo-owned skill packaging/materialization/adapter-consumption without lifecycle states or a separate registry.
- 2026-04-18: `plan-slice` added built-in validation utility, valid-only runtime listing, one minimal demo-skill as first proof target, workspace-only auto-reload semantics, stop points, risk-to-proof mapping, drift guard and real usage audit.
