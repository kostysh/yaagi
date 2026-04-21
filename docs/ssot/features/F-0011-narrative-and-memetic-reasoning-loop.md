---
id: F-0011
title: Нарративный и меметический контур рассуждения
status: done
coverage_gate: strict
owners: ["@codex"]
area: cognition
depends_on: [F-0003, F-0004, F-0005, F-0009]
impacts: [runtime, db, memory, cognition, narrative]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/ssot/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/ssot/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/ssot/features/F-0009-context-builder-and-structured-decision-harness.md"
    - "docs/adr/ADR-2026-03-23-subject-state-evidence-refs.md"
---

# F-0011 Нарративный и меметический контур рассуждения

## 1. Context & Goal

- **User problem:** После `F-0003`, `F-0004` и `F-0005` система уже умеет безопасно жить тиками, загружать bounded subject-state snapshot и принимать нормализованные stimuli, но у неё всё ещё нет канонического owner-а для narrative continuity и memetic competition. Если этот шов не intaken явно, следующие cognition slices начинают либо писать durable narrative/memetic state ad hoc из runtime/context paths, либо прятать незрелые tensions и patterns в `psm_json` или другие чужие surfaces, что архитектура прямо запрещает.
- **Goal:** Создать канонический dossier-owner для `Memetic Arena`, `Narrative Manager` и `field journal` как одного phase-1 cognition seam: он должен потреблять delivered tick/perception/subject-state surfaces, держать разделение между tick-local candidates и durable memetic units, владеть narrative/memetic read-write boundary, отдавать bounded downstream cognition contract и не размывать ownership соседних memory/governor/consolidation seams.
- **Non-goals:** Operator API, executive/action layer, subject-state ownership, baseline model routing, full consolidation/compaction lifecycle, graceful shutdown biography, governor policy gates, workshop/eval pipeline и controlled body evolution в этот intake не входят.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0003` tick runtime and continuity bridge, `F-0004` versioned subject-state store, `F-0005` perception ingress/buffer and `F-0009` bounded context/decision harness. This dossier keeps `memetics + narrative + field journal` in one seam, fixes a read-only downstream contract toward later cognition consumers, and leaves durable promotion/merge/split/compaction paths explicitly separated into `CF-018`.

## 2. Scope

### In scope

- Канонический owner для `Memetic Arena`, `Narrative Manager` и `field journal` как одного cognition seam.
- Tick-local candidate assembly, activation/reinforcement/decay for existing durable units, coalition formation и handoff bounded narrative/memetic outputs downstream cognition paths.
- Narrative spine updates, field journal maintenance и явное различение facts / interpretations / direction на narrative surfaces.
- Ownership над future narrative/memetic surfaces `memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries` с явно ограниченными write paths.
- Shaped-level фиксация `Memetic Lifecycle` contract: bootstrap baseline set, tick-local candidate vs durable unit boundary, `no raw-ingest-to-durable`, `provenance required`, ordinary tick write policy и downstream bounded output contract.

### Out of scope

- Durable promotion, merge, split, quarantine, retire, compaction and retention semantics for narrative/memetic state; these stay with `CF-018` as the allowed compaction/promotion seam.
- Governor/operator labeling paths for new durable units; these stay with `CF-016` and later governance seams.
- Direct writes to `psm_json`, `goals`, `beliefs`, `entities` or `relationships`; those remain owned by `F-0004`.
- Alternative self-model schemas, hidden caches or narrative/memetic mirrors outside the canonical PostgreSQL surfaces.
- Expanded model ecology, operator-facing introspection API, reporting jobs, public HTTP endpoints and workshop/development ledger surfaces.

### Constraints

- `memetic candidate` и `memetic unit` are different entities and must not collapse into one storage or lifecycle concept.
- Первый `wake` tick не может зависеть от прошлого narrative/memetic цикла; bootstrap seed set must come from constitution, identity core and initial goals/beliefs.
- Raw `stimulus_inbox.normalized_json`, user messages and other single-shot payloads cannot be persisted verbatim as durable `memetic_units`.
- Ordinary ticks may update activation/reinforcement/decay on existing units, maintain `memetic_edges` between existing durable units and write coalition/narrative/journal outputs, but durable promotion of new units must go only through explicit allowed paths owned by `CF-018` or future governor/operator gates.
- This seam owns only narrative/memetic surfaces. Direct writes to subject-state tables in `F-0004` are forbidden; reads and deltas must continue through canonical owner contracts.
- `F-0011` must consume the versioned bounded subject-state snapshot as input and must not introduce an alternative ad hoc self-model schema outside the existing subject-state contract.
- The first delivered shape remains internal to the existing `core` monolith: no new public route, sidecar or environment contract is allowed just to support narrative/memetic reasoning.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0011-01:** `F-0011` establishes one canonical owner seam for `Memetic Arena`, `Narrative Manager` and `field journal`: bootstrap before the first `wake` tick materializes a minimal memetic baseline from constitution, identity core and initial goals/beliefs, while ordinary ticks continue from that baseline without depending on a nonexistent previous narrative cycle.
- **AC-F0011-02:** Tick-local memetic candidate assembly consumes only canonical inputs from the current tick context: current stimulus/perception aggregates from `F-0005`, bounded subject-state snapshot from `F-0004`, bounded recent episodes/timeline anchors from `F-0003`, active durable memetic units, field-journal excerpts and resource posture; raw `stimulus_inbox` payloads, user messages and other single-shot inputs must not be persisted verbatim as durable `memetic_units`.
- **AC-F0011-03:** Ordinary supported cognition ticks may update activation, reinforcement and decay fields on existing `memetic_units`, maintain `memetic_edges` between already durable units, create `coalitions` rows and append `narrative_spine_versions` / `field_journal_entries`, but they must not silently create a new durable `memetic_unit`; promotion, merge, split, quarantine, retire and compaction semantics require an explicit consolidation/governor/operator path outside this feature.
- **AC-F0011-04:** One-off unresolved tensions and immature patterns remain in `field_journal_entries` and related narrative surfaces until sufficient repeated evidence exists for future durable promotion, and every durable memetic unit or narrative revision written by this seam keeps provenance anchors to episodes, goals, beliefs, entities, narrative tensions or model-organ decisions.
- **AC-F0011-05:** `F-0011` exposes one bounded downstream cognition contract with at least `activeMemeticUnits`, `winningCoalition`, `coalitionDiagnostics`, `affectPatch`, `narrativeSummary`, `fieldJournalExcerpts`, `narrativeTensions` and `provenanceAnchors`; downstream seams consume this contract read-only and do not receive implicit write authority over narrative/memetic storage.
- **AC-F0011-06:** The feature owns only canonical narrative/memetic surfaces (`memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries`) and must not directly mutate `psm_json`, `goals`, `beliefs`, `entities` or `relationships` outside canonical `F-0004` owner contracts.

## 4. Non-functional requirements (NFR)

- **Continuity:** Narrative and memetic state must remain compatible with one subjective timeline rather than a parallel hidden history.
- **Traceability:** Durable units and narrative revisions must preserve provenance anchors instead of opaque, anchorless summaries.
- **Scope discipline:** This seam must not absorb consolidation/governor/subject-state ownership under the pretext of “making cognition work”.
- **Determinism:** Candidate assembly and bounded downstream outputs should be reproducible from canonical tick/perception/subject-state inputs.
- **Replay safety:** Retry/replay of the same tick must not create impossible duplicate durable units or bypass the explicit promotion boundary.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0011` does not add a new public HTTP or operator API in the shaped phase. Its only contract surface is an internal cognition boundary inside the existing `core` runtime.
- The seam consumes already delivered canonical inputs and returns one bounded read model for downstream cognition consumers.
- Compact contract for this dossier:

```ts
type NarrativeMemeticInputs = {
  tickId: string;
  decisionMode: "wake" | "reactive" | "deliberative" | "contemplative";
  perceptionSummary: {
    stimulusRefs: string[];
    urgency: number;
    novelty: number;
    resourcePressure: number;
    summary: string;
  };
  subjectStateSnapshot: {
    subjectStateSchemaVersion: string;
    goals: Record<string, unknown>[];
    beliefs: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
    agentState: Record<string, unknown>;
  };
  recentEpisodes: Array<{
    episodeId: string;
    tickId: string;
    summary: string;
    sourceRefs: string[];
  }>;
  activeMemeticUnits: Array<{
    unitId: string;
    label: string;
    activation: number;
    reinforcement: number;
    decay: number;
    provenanceAnchors: string[];
  }>;
  fieldJournalExcerpts: Array<{
    entryId: string;
    summary: string;
    tensionMarkers: string[];
    provenanceAnchors: string[];
  }>;
  resourcePostureJson: Record<string, unknown>;
};

type TickLocalMemeticCandidate = {
  candidateId: string;
  abstractLabel: string;
  supportingRefs: string[];
  sourceKinds: Array<"stimulus" | "episode" | "goal" | "belief" | "entity" | "journal">;
  durablePromotionAllowed: false;
};

type NarrativeMemeticOutputs = {
  activeMemeticUnits: Array<{
    unitId: string;
    label: string;
    activation: number;
    reinforcement: number;
    decay: number;
  }>;
  winningCoalition: {
    coalitionId: string;
    vector: string;
    strength: number;
    memberUnitIds: string[];
  } | null;
  coalitionDiagnostics: {
    suppressedUnitIds: string[];
    supportEdges: string[];
    conflictMarkers: string[];
  };
  affectPatch: Record<string, unknown>;
  narrativeSummary: {
    currentChapter: string;
    summary: string;
    continuityDirection: string;
  };
  fieldJournalExcerpts: Array<{
    entryId: string;
    summary: string;
    maturityState: "immature" | "tracking" | "escalated";
  }>;
  narrativeTensions: Array<{
    tensionId: string;
    summary: string;
    severity: number;
  }>;
  provenanceAnchors: string[];
};
```

- `TickLocalMemeticCandidate` is intentionally ephemeral. The shaped spec forbids a durable `candidate == unit` shortcut.
- Downstream consumers such as `F-0009` may enrich their context with `NarrativeMemeticOutputs`, but they stay read-only with respect to narrative/memetic persistence.

### 5.2 Runtime and deployment surface

- `F-0011` sits after delivered tick/perception/state substrates and before or alongside downstream context assembly.
- The seam lives inside the existing `core` monolith and may not require:
  - a new sidecar or worker topology;
  - a new public route;
  - a new environment variable contract just for narrative/memetic cognition.
- Ownership split fixed by this spec:
  - `F-0011` owns candidate assembly, activation/reinforcement/decay on existing units, coalition formation, narrative spine updates, field journal maintenance and bounded downstream outputs.
  - `CF-018` owns durable promotion/merge/split/quarantine/retire/compaction transitions.
  - `F-0004` remains the only canonical writer for subject-state tables.
- Ordinary cognition tick transaction policy:
  - read canonical inputs from `F-0003`, `F-0004` and `F-0005`;
  - compute an ephemeral candidate set;
  - optionally update activation/reinforcement/decay fields on existing `memetic_units`;
  - optionally create or update `memetic_edges` only when both endpoints already exist as durable units;
  - append `coalitions`, `narrative_spine_versions` and `field_journal_entries`;
  - emit one bounded `NarrativeMemeticOutputs` read model;
  - never create a new durable `memetic_unit` in the ordinary tick path.

### 5.3 Data model changes

- Canonical persistent surfaces for this dossier are:
  - `memetic_units`
  - `memetic_edges`
  - `coalitions`
  - `narrative_spine_versions`
  - `field_journal_entries`
- The shaped spec intentionally does **not** introduce a durable `memetic_candidates` table. Tick-local candidates may stay in memory or another explicitly transient form because candidate lifecycle is not durable state.
- Core schema contract by surface:
  - `memetic_units`: durable abstracted unit with `unit_id`, `abstract_label`, `canonical_summary`, `activation_score`, `reinforcement_score`, `decay_score`, `status`, `last_activated_tick_id`, `created_by_path`, `created_at`, `updated_at`, `provenance_anchors_json`. Ordinary ticks may update scores and provenance on existing rows only; row creation belongs to bootstrap or `CF-018`/governor-owned paths.
  - `memetic_edges`: relation rows between existing durable units with `edge_id`, `source_unit_id`, `target_unit_id`, `relation_kind`, `strength`, `confidence`, `tick_id`, `updated_at`. Ordinary ticks may add or refresh edges only when both endpoints already exist durably.
  - `coalitions`: per-tick competition result with `coalition_id`, `tick_id`, `decision_mode`, `vector`, `member_unit_ids_json`, `support_score`, `suppression_score`, `winning`, `created_at`.
  - `narrative_spine_versions`: append-only narrative revisions with `version_id`, `tick_id`, `based_on_version_id`, `current_chapter`, `summary`, `continuity_direction`, `tensions_json`, `created_at`, `provenance_anchors_json`.
  - `field_journal_entries`: append-only unresolved or immature patterns with `entry_id`, `tick_id`, `entry_type`, `summary`, `interpretation`, `tension_markers_json`, `maturity_state`, `linked_unit_id`, `created_at`, `provenance_anchors_json`.
- Required access and index intent:
  - `memetic_units`: index for active lookup by `status` plus recent activation ordering; provenance must remain queryable.
  - `memetic_edges`: index by `source_unit_id`, `target_unit_id` and `relation_kind`.
  - `coalitions`: index by `tick_id` and `winning`.
  - `narrative_spine_versions`: index by `tick_id` and chronological append order.
  - `field_journal_entries`: index by `maturity_state`, `tick_id` and recent append order.

### 5.4 Edge cases and failure modes

- Bootstrap-before-first-tick must produce a minimal baseline even when there is no prior journal, coalition or narrative revision.
- Replay or retry of the same tick must not duplicate durable units or create impossible coalition/narrative history.
- A tick with no winning durable coalition may still append field-journal and narrative updates with `winningCoalition: null`.
- One-off emotional, interpretive or conflict spikes must stay in journal/narrative surfaces until repeated evidence exists; they are not a shortcut to durable promotion.
- Any attempt to back-write `psm_json`, `goals`, `beliefs`, `entities` or `relationships` from this seam is an architecture defect.
- Any attempt to persist a raw single-shot payload as a durable `memetic_unit` is invalid even if the payload has high urgency or salience.

### 5.5 Verification surface

- Delivered fast-path verification covers:
  - bootstrap seeding before the first `wake` tick;
  - canonical candidate assembly inputs and `no raw-ingest-to-durable`;
  - ordinary tick writes for existing units only;
  - provenance anchors on durable units and narrative revisions;
  - bounded `NarrativeMemeticOutputs` shape and read-only downstream consumption;
  - explicit write-authority boundaries against `F-0004` and `CF-018`.
- Runtime integration proves wake/bootstrap wiring and reactive downstream handoff inside the existing tick lifecycle, including canonical `selected_coalition_id` continuity on the completed tick path.
- Because the feature changes runtime behavior, implementation closure requires the canonical deployment-cell smoke path.

## 6. Definition of Done

- `F-0011` is `done` with explicit separation between ordinary tick writes and `CF-018`-owned durable transition classes.
- The feature delivers one bounded downstream cognition contract and one internal input contract without introducing a public API or a parallel self-model store.
- Canonical runtime and DB surfaces are live for `memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions` and `field_journal_entries`, while durable `memetic_candidates` storage is still intentionally absent.
- Wake/bootstrap seeding, ordinary existing-unit updates, coalition persistence, narrative/journal append and downstream context handoff are implemented on the canonical completed-tick path.
- Direct writes to `psm_json`, `goals`, `beliefs`, `entities` and `relationships` remain forbidden outside the existing `F-0004` owner contract.
- Verification now covers bootstrap, candidate-vs-unit separation, provenance, downstream contract shape, runtime handoff and owner-boundary enforcement, including deployment-cell smoke.
- Architecture coverage and global index remain aligned with the delivered status and owner boundary.

## 7. Slicing plan

### Slice SL-F0011-01: Bootstrap baseline and canonical cognition contracts
Delivers: canonical input/output contract modules for `NarrativeMemeticInputs`, `TickLocalMemeticCandidate` and `NarrativeMemeticOutputs`, plus bootstrap baseline seeding rules for the first `wake` tick.
Covers: AC-F0011-01, AC-F0011-02, AC-F0011-05
Verification: `contract`, `integration`
Exit criteria:
- First-cycle bootstrap materializes the minimal baseline from constitution, identity core and initial goals/beliefs without requiring prior narrative state.
- Candidate assembly accepts only canonical inputs from `F-0003`, `F-0004` and `F-0005`.
- Downstream output shape is fixed and versionable before runtime wiring begins.

### Slice SL-F0011-02: Ordinary tick persistence boundary for existing durable units
Delivers: ordinary-tick write path that updates only existing durable narrative/memetic state, including coalition append, journal append and bounded edge maintenance.
Covers: AC-F0011-02, AC-F0011-03, AC-F0011-04, AC-F0011-06
Verification: `integration`, `db`
Exit criteria:
- Ordinary ticks update activation/reinforcement/decay on existing `memetic_units` only.
- `memetic_edges` are created or updated only between already durable units.
- No durable promotion path exists inside the ordinary tick transaction.
- Provenance anchors are required on durable unit and narrative writes.

### Slice SL-F0011-03: Downstream bounded read model and consumer handoff
Delivers: read-only handoff of `NarrativeMemeticOutputs` into downstream cognition consumers such as the `F-0009` context builder path.
Covers: AC-F0011-04, AC-F0011-05, AC-F0011-06
Verification: `contract`, `integration`
Exit criteria:
- `activeMemeticUnits`, `winningCoalition`, `coalitionDiagnostics`, `affectPatch`, `narrativeSummary`, `fieldJournalExcerpts`, `narrativeTensions` and `provenanceAnchors` are emitted as one bounded contract.
- Downstream consumers remain read-only with respect to narrative/memetic persistence.
- No public API or parallel history store is introduced for this handoff.

### Slice SL-F0011-04: Runtime wiring, replay safety and closure verification
Delivers: end-to-end supported tick wiring with retry/replay safety and the final verification closure for runtime-impacting slices.
Covers: AC-F0011-01, AC-F0011-03, AC-F0011-04, AC-F0011-05, AC-F0011-06
Verification: `integration`, `smoke-if-runtime-path-changes`
Exit criteria:
- Supported tick paths can execute the narrative/memetic seam without bypassing `F-0004` or `CF-018` boundaries.
- Retry/replay does not create impossible duplicate durable units or narrative history.
- If implementation changes runtime/startup/deployment behavior, the canonical deployment-cell smoke path is added before feature closure.

## 8. Task list

- **T-F0011-01:** Materialize canonical contract modules and bootstrap seed assembly for `SL-F0011-01`. Covers: AC-F0011-01, AC-F0011-02, AC-F0011-05.
- **T-F0011-02:** Add contract and first-cycle integration coverage for `SL-F0011-01`, including canonical-input and `no raw-ingest-to-durable` guards. Covers: AC-F0011-01, AC-F0011-02.
- **T-F0011-03:** Implement ordinary-tick persistence boundaries for `SL-F0011-02`, including existing-unit score updates, bounded edge maintenance and append-only coalition/journal/narrative writes. Covers: AC-F0011-03, AC-F0011-04, AC-F0011-06.
- **T-F0011-04:** Add database and integration coverage for `SL-F0011-02`, proving no hidden durable promotion and required provenance anchors. Covers: AC-F0011-03, AC-F0011-04, AC-F0011-06.
- **T-F0011-05:** Implement bounded downstream read-model assembly and consumer handoff for `SL-F0011-03`. Covers: AC-F0011-05, AC-F0011-06.
- **T-F0011-06:** Add contract and integration coverage for `SL-F0011-03`, proving read-only downstream consumption and no parallel history store. Covers: AC-F0011-05, AC-F0011-06.
- **T-F0011-07:** Wire supported runtime entrypoints and replay/idempotency guards for `SL-F0011-04`. Covers: AC-F0011-01, AC-F0011-03, AC-F0011-04, AC-F0011-06.
- **T-F0011-08:** Add final runtime integration coverage and conditional deployment-cell smoke for `SL-F0011-04`. Covers: AC-F0011-03, AC-F0011-05, AC-F0011-06.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0011-01 | `apps/core/test/cognition/narrative-memetic.contract.test.ts` → `test("AC-F0011-01 bootstraps a minimal baseline when no prior narrative or durable units exist")`; `apps/core/test/runtime/narrative-memetic-handoff.integration.test.ts` → `test("AC-F0011-01 seeds the narrative/memetic baseline during the wake tick before any previous cycle exists")`; `packages/db/test/narrative-memetic-store.integration.test.ts` → `test("AC-F0011-01 persists bootstrap baseline surfaces on the canonical completed-tick path")` | done |
| AC-F0011-02 | `apps/core/test/cognition/narrative-memetic.contract.test.ts` → `test("AC-F0011-02 assembles only canonical tick-local memetic candidates and keeps durable promotion disabled")` | done |
| AC-F0011-03 | `apps/core/test/cognition/narrative-memetic.contract.test.ts` → `test("AC-F0011-03 emits bounded read-model outputs while updating only existing durable units on ordinary ticks")`; `packages/db/test/narrative-memetic-store.integration.test.ts` → `test("AC-F0011-03 updates only existing durable units and persists the winning coalition without creating a new durable unit")` | done |
| AC-F0011-04 | `packages/db/test/narrative-memetic-store.integration.test.ts` → bootstrap baseline completed-tick test `// Covers: AC-F0011-04`; `packages/db/test/narrative-memetic-store.integration.test.ts` → ordinary-tick coalition persistence test `// Covers: AC-F0011-04` | done |
| AC-F0011-05 | `apps/core/test/cognition/context-builder.contract.test.ts` → bounded context enrichment contract `// Covers: AC-F0011-05`; `apps/core/test/runtime/narrative-memetic-handoff.integration.test.ts` → `test("AC-F0011-05 hands the bounded narrative/memetic read model into downstream decision flow and persists the winning coalition id")`; `infra/docker/deployment-cell.smoke.ts` → bounded reactive deployment-cell smoke `// Covers: AC-F0011-05` | done |
| AC-F0011-06 | `packages/db/test/narrative-memetic-store.integration.test.ts` → ordinary-tick coalition persistence test `// Covers: AC-F0011-06`; `apps/core/test/runtime/subject-state-delta.contract.test.ts` → subject-state persistence guard `// Covers: AC-F0011-06` | done |

## 10. Decision log (ADR blocks)

### ADR-F0011-01: Keep memetics, narrative spine and field journal in one dossier
- Status: Accepted
- Date: 2026-03-25
- Context: `CF-005` grouped `memetics + narrative + field journal` in one cognition seam, while backlog watchpoints required an explicit intake decision on whether to split that ownership before shaping. Architecture already treats these surfaces as one narrative/memetic cognition owner, but durable promotion/compaction belongs to a later consolidation seam.
- Decision: Keep `memetics`, `narrative spine` and `field journal` in one feature dossier `F-0011`, while leaving durable promotion/merge/split/compaction transitions explicitly out of scope for this dossier and owned by `CF-018`.
- Alternatives: Split memetic and narrative surfaces into separate dossiers now; fold consolidation/promotion into the same dossier.
- Consequences: `F-0011` owns the runtime cognition boundary for narrative/memetic state, while shaping must preserve the explicit separation to consolidation and subject-state owners.

### ADR-F0011-02: Ordinary ticks may update existing durable units but may not promote new ones
- Status: Accepted
- Date: 2026-03-25
- Context: Shaping needed to resolve whether ordinary cognition ticks should be purely read-only for durable memetic state or whether they may maintain existing units. A fully read-only path would make the seam unable to express activation, decay and coalition outcomes, while unrestricted writes would blur the boundary with `CF-018` and future governor-owned transitions.
- Decision: Allow ordinary ticks to update activation/reinforcement/decay and related evidence/edge state for already durable units, and to append coalition/narrative/journal rows, but forbid ordinary ticks from creating a new durable `memetic_unit` or performing promotion/merge/split/quarantine/retire/compaction transitions.
- Alternatives: Make ordinary ticks fully read-only; allow ordinary ticks to promote new durable units whenever salience is high.
- Consequences: `F-0011` can produce useful live cognition state without absorbing lifecycle ownership that belongs to `CF-018` and future governance paths.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> done`
- Candidate source: `CF-005`
- Delivered prerequisites: `F-0003`, `F-0004`, `F-0005`, `F-0009`
- Code:
  - `apps/core/src/cognition/context-builder.ts`
  - `apps/core/src/cognition/decision-harness.ts`
  - `apps/core/src/cognition/index.ts`
  - `apps/core/src/cognition/narrative-memetic.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/src/runtime/tick-runtime.ts`
  - `apps/core/test/cognition/context-builder.contract.test.ts`
  - `apps/core/test/cognition/narrative-memetic.contract.test.ts`
  - `apps/core/test/runtime/narrative-memetic-handoff.integration.test.ts`
  - `apps/core/test/runtime/subject-state-delta.contract.test.ts`
  - `infra/migrations/007_narrative_memetic_runtime.sql`
  - `packages/contracts/src/cognition.ts`
  - `packages/contracts/src/runtime.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/narrative-memetic.ts`
  - `packages/db/src/runtime.ts`
  - `packages/db/test/narrative-memetic-store.integration.test.ts`
  - `packages/db/testing/subject-state-db-harness.ts`
- Verification:
  - `pnpm quality:fix`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer index-refresh`
  - `dossier-engineer lint-dossiers`
  - `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0011-narrative-and-memetic-reasoning-loop.md --orphans-scope=dossier`
  - `dossier-engineer debt-audit --changed-only`
  - `dossier-engineer dossier-verify --dossier docs/ssot/features/F-0011-narrative-and-memetic-reasoning-loop.md --step implementation`

## 12. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-005`; intake keeps memetics, narrative spine and field journal in one dossier and explicitly leaves durable promotion/compaction to `CF-018`.
- **v1.1 (2026-03-25):** `spec-compact` shaped the feature: refined ACs, fixed ordinary tick vs consolidation ownership, defined bounded downstream narrative/memetic contract and documented core schema intent for narrative/memetic surfaces.
- **v1.2 (2026-03-25):** `plan-slice` moved the dossier to `planned`; delivery is split into four slices covering bootstrap/contracts, ordinary-tick persistence boundaries, downstream read-model handoff and runtime/replay closure verification.
- **v1.3 (2026-03-25):** Completed `implementation`: delivered canonical `NarrativeMemeticInputs` / `TickLocalMemeticCandidate` / `NarrativeMemeticOutputs` contracts, added the `memetic_units` / `memetic_edges` / `coalitions` / `narrative_spine_versions` / `field_journal_entries` runtime schema, wired wake/bootstrap and reactive completed-tick persistence through the canonical runtime path, exposed bounded narrative/memetic context to the `F-0009` handoff, and closed AC-linked contract/integration/DB coverage without creating an ordinary-tick durable promotion path.
