---
id: F-0009
title: Context Builder и structured decision harness
status: shaped
owners: ["@codex"]
area: cognition
depends_on: [F-0003, F-0004, F-0005, F-0008]
impacts: [runtime, db, perception, memory, models, cognition]
created: 2026-03-24
updated: 2026-03-24
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
---

# F-0009 Context Builder и structured decision harness

## 1. Context & Goal

- **User problem:** После `F-0003`, `F-0004`, `F-0005` и `F-0008` у системы уже есть канонический tick runtime, versioned subject-state snapshot, perception intake и baseline organ selection, но всё ещё нет явного owner-а для bounded cognitive handoff между этими delivered seams и будущим action boundary. Без этого следующий этап либо начнёт собирать prompt/context ad hoc прямо внутри runtime или executive path, либо quietly размазает ownership между router, memory и будущими narrative/tool seams.
- **Goal (what success means):** В репозитории появляется отдельный canonical owner для `Context Builder` и одного bounded `Mastra Decision Agent`, который собирает decision input только из уже delivered canonical surfaces, вызывает model-backed reasoning через уже выбранный organ/profile и возвращает строго структурированное решение для downstream runtime/executive seams без захвата ownership над action execution, narrative/memetic reasoning или subject-state writes.
- **Current phase baseline:** На момент intake уже delivered `F-0001`-`F-0008`. Runtime lifecycle, bounded versioned subject-state snapshot, perception buffer/intake и baseline router считаются обязательным substrate этого feature; executive center, tool gateway, narrative/memetic cognition, governor, homeostat и richer model ecology ещё не delivered и не могут quietly прилипнуть к этому seam.
- **Non-goals:** Executive/tool execution, action approval/audit, direct state mutation, narrative spine, field journal, memetic arena, operator-facing introspection API, richer model ecology, workshop/governor logic и отдельная parallel self-model schema не входят в этот intake.

## 2. Scope

### In scope

- Канонический `Context Builder`, который собирает bounded decision input из delivered runtime/perception/state/router surfaces.
- Один bounded `Mastra Decision Agent`, работающий как cognitive harness текущего тика, а не как owner личности или памяти.
- Канонический schema contract для structured decision envelope и validator, который отсекает invalid/free-form model output до downstream handoff.
- Явный ownership boundary между context assembly, model-backed decision, runtime admission и future executive execution.
- Передача version/conflict/truncation markers в decision input, чтобы downstream reasoning не получал silently ambiguous or partial context.

### Out of scope

- Исполнение tools, shell/http/git wrappers, постановка jobs и append-only action audit; этим владеет будущий `CF-007`.
- Narrative/memetic reasoning, coalition formation, field journal и durable promotions; этим владеет будущий `CF-005` и соседние cognition seams.
- Subject-state schema evolution, direct writes в `psm_json`, goals, beliefs, entities, relationships или model registry.
- Router policy и organ selection rules beyond consuming already selected baseline profile from `F-0008`.
- Новые external services, alternative runtime topology или отдельный cognitive sidecar outside the delivered `core` monolith.

### Constraints

- Feature строится только на already delivered canonical stack/path: `TypeScript + Mastra + Hono + PostgreSQL` внутри existing `core` runtime.
- Canonical input surfaces ограничены delivered owners: `F-0005` perception batch/intake, `F-0004` bounded versioned subject-state snapshot, `F-0003` active tick + recent episodes/timeline context, `F-0008` selected organ/profile and routing metadata.
- Feature не получает blanket write authority: он не может bypass-ить runtime admission, subject-state store, router continuity contract или future executive/governor boundaries.
- Structured decision должен быть machine-validated; свободный текст как единственный output contract запрещён.
- Unsupported or incompatible context/profile conditions должны завершаться explicit structured refusal/failure before any downstream action/state side effect.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0009-01:** `ContextBuilder.build(...)` собирает один canonical bounded decision context только из delivered owner surfaces: `PerceptualContext` / current trigger from `F-0005`, bounded versioned `SubjectStateSnapshot` from `F-0004`, bounded recent episode/timeline slice from `F-0003`, selected baseline profile metadata from `F-0008` и current resource posture from the singleton subject-state anchor; feature не вводит parallel self-model schema, shadow prompt store или ad hoc context source вне этих owners.
- **AC-F0009-02:** Canonical decision context carries explicit source metadata for each bounded section: `subjectStateSchemaVersion` where applicable, `truncated: boolean`, stable `sourceIds` / references, and `conflictMarkers` / compatibility markers when input is partial, stale or incompatible; required-context incompatibility returns structured `context_incompatible` refusal before any agent call instead of silently dropping the problematic slice.
- **AC-F0009-03:** Один bounded `Mastra Decision Agent` получает canonical decision context и возвращает ровно один JSON decision envelope conforming to the delivered `TickDecisionV1` schema with at least `observations[]`, `interpretations[]`, declarative `action`, `episode.summary`, `episode.importance` and `developmentHints[]`; свободный prose-only model response не считается delivered decision surface.
- **AC-F0009-04:** Decision envelope проходит обязательную schema validation before downstream handoff; invalid JSON, missing required fields, unsupported enum values or schema-breaking model output завершается explicit structured failure/refusal and validation evidence, without direct action execution, job dispatch, router mutation or subject-state writes.
- **AC-F0009-05:** Decision harness потребляет уже selected baseline profile from `F-0008` и не становится owner-ом model routing или tick admission: отсутствие compatible selected profile, profile eligibility drift или unsupported decision mode завершают flow как structured refusal before agent call вместо silent re-routing, hidden fallback или runtime admission expansion.
- **AC-F0009-06:** Первая delivered версия harness-а остаётся reactive-first bounded seam: end-to-end runtime wiring обязательна для `reactive` path, тогда как `deliberative` / `contemplative` context assembly and decision validation may be callable and contract-testable but не расширяют сами по себе `F-0003` admission matrix, executive execution scope or public API surface.

## 4. Non-functional requirements (NFR)

- **Determinism:** Один и тот же bounded input и одинаковое router/state/perception состояние должны давать один и тот же decision envelope shape and validation verdict.
- **Boundedness:** Context assembly остаётся size-bounded и не превращается в unbounded prompt dump из всех доступных tables/history surfaces.
- **Traceability:** Должно быть возможно отследить, какой selected profile, какие bounded inputs и какой validation verdict привели к decision handoff.
- **Scope discipline:** Feature не должен quietly перетянуть в себя executive, router, memory, narrative или governance ownership под предлогом "полного decision loop".

## 5. Design (compact)

### 5.1 Runtime and deployment surface

- Архитектурный backbone остаётся explicit: `Build context -> Select model organs -> Call Mastra Decision Agent -> Validate structured decision -> Execute one action or conscious inaction`.
- Эта фича intentionally sits between already delivered router/runtime/state/perception seams and the future executive boundary:
  - `F-0005` remains the owner of signal normalization, `StimulusEnvelope` persistence and `PerceptualContext` assembly.
  - `F-0004` remains the owner of bounded versioned subject-state snapshots and all identity-bearing writes.
  - `F-0008` remains the owner of profile registration and selection/refusal policy.
  - `F-0003` remains the owner of tick admission, active-tick continuity, episode commit and runtime lifecycle ordering.
  - `CF-007` remains the future owner of action execution and approval.
- First delivered runtime shape is internal only:
  - no new public HTTP route;
  - no new sidecar/service outside the delivered `core` monolith;
  - no new env contract beyond already delivered runtime/model/deployment seams.
- Compact internal contract for the shaped scope:

```ts
type DecisionMode = "reactive" | "deliberative" | "contemplative";

type ContextSectionMeta = {
  truncated: boolean;
  sourceIds: string[];
  conflictMarkers: string[];
};

type DecisionContext = {
  tickId: string;
  decisionMode: DecisionMode;
  selectedModelProfileId: string;
  selectedRole: "reflex" | "deliberation" | "reflection";
  perceptualContext: {
    tickId: string;
    summary: string;
    urgency: number;
    novelty: number;
    resourcePressure: number;
  };
  perceptualMeta: ContextSectionMeta;
  subjectState: {
    subjectStateSchemaVersion: string;
    agentState: Record<string, unknown>;
    goals: Record<string, unknown>[];
    beliefs: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
  };
  subjectStateMeta: ContextSectionMeta;
  recentEpisodes: Array<{
    episodeId: string;
    tickId: string;
    summary: string;
    resultJson: Record<string, unknown>;
    createdAt: string;
  }>;
  episodeMeta: ContextSectionMeta;
  resourcePostureJson: Record<string, unknown>;
};

type TickDecisionV1 = {
  observations: string[];
  interpretations: string[];
  action: {
    type: "none" | "tool_call" | "reflect" | "schedule_job";
    summary: string;
    tool?: string;
    argsJson?: Record<string, unknown>;
  };
  episode: {
    summary: string;
    importance: number;
  };
  developmentHints: string[];
};

type DecisionResult =
  | { accepted: true; decision: TickDecisionV1 }
  | {
      accepted: false;
      reason:
        | "context_incompatible"
        | "selected_profile_missing"
        | "selected_profile_ineligible"
        | "unsupported_decision_mode"
        | "decision_schema_invalid";
      detail: string;
    };
```

- `TickDecisionV1` is intentionally declarative:
  - `action` is a proposal/handoff payload, not an execution right;
  - no direct tool call, job enqueue or state mutation happens inside this feature;
  - future seams may enrich the architecture-level `TickDecision`, but this first delivered version must remain bounded to fields that are already actionable without grabbing narrative/executive/governor ownership.

### 5.2 Delivery boundaries by mode

- Reactive-first delivery is the canonical shaped plan for the first implementation:
  - `reactive` must be able to run `build context -> call agent -> validate decision` end-to-end inside the existing tick runtime.
  - `deliberative` and `contemplative` must already use the same context and decision schema contract, but may remain contract-testable/internal until `F-0003` runtime admission and later cognition seams explicitly expand those paths.
- `wake` stays outside this feature.
- `consolidation` and `developmental` remain out of scope and may not be silently tunneled through this harness.

### 5.3 Data model changes

- First delivered version does **not** introduce a new permanent `decision_contexts`, `decision_history` or prompt-log table.
- Decision/context artifacts are transient runtime payloads for this seam; durable biography remains owned by existing `ticks`, `episodes`, `timeline_events` and downstream seams.
- If neighbouring seams later need durable trace metadata, they must attach it through their existing canonical write boundaries rather than by letting `F-0009` create a parallel history store.
- This feature therefore depends on existing data owners instead of becoming one:
  - reads `stimulus_inbox`-derived perception context through `F-0005`;
  - reads bounded versioned subject-state via `F-0004`;
  - reads selected profile and routing metadata via `F-0008`;
  - may hand validated decision payload back to `F-0003` / future `CF-007`, but does not own their writes.

### 5.4 Edge cases

- Subject-state snapshot is compatible but truncated because bounded limits were hit.
- Recent-episode slice is empty or partially unavailable for a valid reactive tick.
- Selected profile exists but is no longer eligible at handoff time.
- Model returns non-JSON text, malformed JSON or enum values outside the delivered decision schema.
- Perception summary is present, but source references include conflicting or stale context markers.
- Caller attempts to use `deliberative` / `contemplative` as if they were already runtime-admissible in the delivered phase.

### 5.5 Failure modes and refusal boundaries

- Missing selected profile: `selected_profile_missing` refusal before agent call.
- Selected profile became unavailable/unhealthy after routing: `selected_profile_ineligible` refusal before agent call.
- Incompatible or stale bounded input contract: `context_incompatible` refusal before agent call.
- Agent produced invalid or schema-breaking output: `decision_schema_invalid` refusal after validation.
- Any refusal/failure path of this seam must remain side-effect free with respect to:
  - subject-state writes;
  - router writes or re-selection;
  - action execution;
  - public API expansion.

### 5.6 Verification surface

- Fast path:
  - contract tests for `DecisionContext` shape and section metadata;
  - integration tests for builder composition from delivered perception/state/episode/profile inputs;
  - contract/integration tests for `TickDecisionV1` schema validation and refusal paths;
  - integration tests proving the harness consumes selected profile without rerouting.
- Runtime integration:
  - one reactive-path integration test proving the full `build -> call -> validate` harness can run inside the delivered runtime path;
  - explicit tests proving `deliberative` / `contemplative` remain bounded contracts and do not silently expand admission/execution scope.
- Containerized smoke:
  - because this feature changes runtime behavior, final implementation must include a deployment-cell smoke proving the existing `core` cell can execute one bounded reactive decision path without opening new public API surface.
- Manual/operator surface:
  - no new operator API is required in this feature;
  - inspection remains via logs, existing health surface and AC-linked tests.

## 6. Definition of Done

- `F-0009` is `shaped` with explicit reactive-first phase boundary and no hidden ownership grab over executive, narrative/memetic, router or subject-state seams.
- Compact design fixes the internal `DecisionContext` and `TickDecisionV1` contracts, refusal boundaries and the absence of a new durable decision-history table in the first delivery.
- Verification plan explicitly includes fast contract/integration coverage and a required deployment-cell smoke path for the eventual implementation.
- `docs/backlog/feature-candidates.md`, `docs/ssot/index.md` and architecture coverage map stay aligned on this feature’s owner and status.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0009-01: Bounded context assembly substrate
Delivers: canonical `DecisionContext` / refusal metadata contract plus `ContextBuilder.build(...)` composed only from already delivered owner surfaces.
Covers: AC-F0009-01, AC-F0009-02
Verification: `contract`, `integration`
Exit criteria:
- Context assembly reads only `F-0005`, `F-0004`, `F-0003` and `F-0008` provider surfaces and does not introduce a parallel prompt/state store.
- Each bounded section carries explicit version/truncation/source/conflict metadata.
- Incompatible required input is rejected as `context_incompatible` before any agent invocation.
Tasks:
- **T-F0009-01:** Materialize the canonical cognition contract module for `DecisionContext`, section metadata and refusal/result types at the runtime boundary. Covers: AC-F0009-01, AC-F0009-02.
- **T-F0009-02:** Implement bounded context assembly from delivered perception, subject-state, recent-episode and selected-profile provider surfaces, including compatibility checks and section metadata. Covers: AC-F0009-01, AC-F0009-02.

### Slice SL-F0009-02: Structured decision agent and validation harness
Delivers: one bounded Mastra-backed decision call that yields only validated `TickDecisionV1` or explicit structured refusal.
Covers: AC-F0009-03, AC-F0009-04
Verification: `contract`, `integration`
Exit criteria:
- The harness passes canonical `DecisionContext` into the bounded decision agent and accepts only schema-valid `TickDecisionV1`.
- Invalid JSON, missing fields, enum drift or schema-breaking output fail before downstream handoff.
- The harness performs no direct action execution, job enqueue or state mutation.
Tasks:
- **T-F0009-03:** Implement schema validation/parsing for `TickDecisionV1` and the explicit `decision_schema_invalid` refusal path. Covers: AC-F0009-03, AC-F0009-04.
- **T-F0009-04:** Wire the bounded Mastra agent invocation so it consumes `DecisionContext` and surfaces validated `DecisionResult` objects without side effects. Covers: AC-F0009-03, AC-F0009-04.

### Slice SL-F0009-03: Selected-profile consumption and reactive runtime handoff
Delivers: end-to-end reactive runtime wiring that consumes the already selected baseline profile and hands validated decisions back to the existing runtime path without rerouting.
Covers: AC-F0009-05, AC-F0009-06
Verification: `integration`
Exit criteria:
- Reactive ticks execute `build context -> call agent -> validate decision` using the selected profile handed off by `F-0008`.
- Missing/ineligible selected profiles and unsupported decision modes refuse before agent call without silent reroute or admission expansion.
- `deliberative` / `contemplative` remain callable contract surfaces but do not become runtime-admissible as part of this slice.
Tasks:
- **T-F0009-05:** Wire `runtime-lifecycle` and the phase-0 Mastra boundary so the harness consumes `selected_model_profile_id` from the existing continuity path instead of performing hidden rerouting. Covers: AC-F0009-05, AC-F0009-06.
- **T-F0009-06:** Add runtime integration tests proving reactive selected-profile handoff and refusal behavior for missing/ineligible profiles and unsupported decision modes. Covers: AC-F0009-05, AC-F0009-06.

### Slice SL-F0009-04: Phase-boundary verification and deployment-cell closure
Delivers: final verification proving the bounded reactive decision path inside the canonical deployment cell without API, dependency or durable-store creep.
Covers: AC-F0009-06
Verification: `integration`, `smoke`
Exit criteria:
- The deployment cell proves one bounded reactive decision path through the existing `core` runtime shape.
- No new public HTTP route, sidecar/service or durable `decision_contexts` / `decision_history` table appears as part of the first delivery.
- All AC-linked fast suites and the required smoke path exist so the dossier can close after implementation.
Tasks:
- **T-F0009-07:** Add deployment-cell smoke coverage for the bounded reactive decision path and assert no new public API surface is required. Covers: AC-F0009-06.
- **T-F0009-08:** Close the AC-linked fast verification surface for context assembly, decision validation and runtime handoff in the final implementation snapshot. Covers: AC-F0009-01, AC-F0009-02, AC-F0009-03, AC-F0009-04, AC-F0009-05, AC-F0009-06.

## 8. Suggested issue titles

- `F-0009 / SL-F0009-01 Bounded context assembly substrate` -> [SL-F0009-01](#slice-sl-f0009-01-bounded-context-assembly-substrate)
- `F-0009 / SL-F0009-02 Structured decision agent and validation harness` -> [SL-F0009-02](#slice-sl-f0009-02-structured-decision-agent-and-validation-harness)
- `F-0009 / SL-F0009-03 Selected-profile consumption and reactive runtime handoff` -> [SL-F0009-03](#slice-sl-f0009-03-selected-profile-consumption-and-reactive-runtime-handoff)
- `F-0009 / SL-F0009-04 Phase-boundary verification and deployment-cell closure` -> [SL-F0009-04](#slice-sl-f0009-04-phase-boundary-verification-and-deployment-cell-closure)

## 9. Test plan & Coverage map

| AC ID | Planned verification reference | Status |
|---|---|---|
| AC-F0009-01 | `apps/core/test/cognition/context-builder.integration.test.ts` → `test("AC-F0009-01 builds canonical bounded decision context from delivered owner surfaces")` | planned |
| AC-F0009-02 | `apps/core/test/cognition/context-builder.contract.test.ts` → `test("AC-F0009-02 carries explicit version, truncation and conflict markers for bounded context sections")` | planned |
| AC-F0009-03 | `apps/core/test/cognition/decision-harness.contract.test.ts` → `test("AC-F0009-03 returns a validated TickDecisionV1 envelope from the bounded Mastra decision harness")` | planned |
| AC-F0009-04 | `apps/core/test/cognition/decision-harness.contract.test.ts` → `test("AC-F0009-04 refuses invalid decision output before downstream handoff")` | planned |
| AC-F0009-05 | `apps/core/test/cognition/decision-harness.integration.test.ts` → `test("AC-F0009-05 consumes the selected baseline profile without rerouting or expanding admission ownership")` | planned |
| AC-F0009-06 | `apps/core/test/runtime/reactive-decision-handoff.integration.test.ts` → `test("AC-F0009-06 keeps the harness reactive-first without silently expanding deliberative or contemplative admission")`; smoke in `infra/docker/deployment-cell.smoke.ts` | planned |

План верификации:

- Fast path обязателен для context schema, decision schema and refusal logic.
- Runtime integration обязателен для reactive-first handoff inside the existing tick lifecycle.
- Containerized smoke обязателен на implementation step, потому что feature меняет runtime behavior inside the canonical deployment cell.
- Coverage gaps остаются informational until the dossier moves past `shaped`; they become blocking at `planned`.

## 10. Decision log (ADR blocks)

### ADR-F0009-01: First delivered decision harness is reactive-first and does not create a new durable decision-history table
- Status: Accepted
- Context: Архитектура already defines `Context Builder`, `Mastra Decision Agent` and `TickDecision`, but the delivered runtime still admits only `wake`/`reactive`, while executive, narrative/memetic and governor seams are not yet delivered. Без явной границы feature либо попытается рано выполнить весь cognitive loop, либо создаст parallel durable store для prompts/decisions, который начнёт конкурировать с existing tick/episode biography.
- Decision: First delivered `F-0009` stays reactive-first for end-to-end runtime wiring, keeps `deliberative` / `contemplative` as callable contract surfaces only, and does not create a new permanent `decision_contexts` / `decision_history` table. The feature returns a validated declarative `TickDecisionV1` handoff payload and relies on existing canonical owners for all durable writes and execution.
- Alternatives: Wait until executive and narrative seams are delivered before intaking the harness; expand runtime admission to all decision modes immediately; create a dedicated persistent prompt/decision store in this feature.
- Consequences: The repository gets an implementable bounded cognitive harness on top of already delivered seams without widening runtime or state ownership prematurely. Future seams may enrich the decision envelope or add durable trace surfaces, but only through explicit follow-on work.

## 11. Progress & links

- Status: `proposed` → `shaped`; `plan-slice` completed with a justified alternative status retention, because repo coverage policy makes `planned` dossiers blocking until AC-linked tests exist.
- Issue: -
- PRs:
  - -
- Code:
  - Not started. Intake + `spec-compact` + `plan-slice` only.

## 12. Change log

- **v1.0 (2026-03-24):** Initial dossier created from candidate `CF-017`; intake fixed canonical dependencies on delivered runtime/state/perception/router seams and isolated the feature as a bounded cognitive harness rather than executive, narrative or state-ownership expansion.
- **v1.1 (2026-03-24):** `spec-compact` completed: acceptance criteria were tightened into testable context/decision/refusal contracts, the first delivered version was fixed as reactive-first with no new durable decision-history table, a feature-local ADR captured the phase boundary, and the dossier advanced to `shaped`.
- **v1.2 (2026-03-24):** `plan-slice` decomposed `F-0009` into four delivery slices covering bounded context assembly, structured decision validation, selected-profile reactive handoff and deployment-cell verification closure; the dossier intentionally remains `shaped` as a justified alternative because the repo coverage policy treats `planned` dossiers as blocking until AC-linked tests exist.
