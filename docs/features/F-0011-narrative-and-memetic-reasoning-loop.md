---
id: F-0011
title: Нарративный и меметический контур рассуждения
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: cognition
depends_on: [F-0003, F-0004, F-0005]
impacts: [runtime, db, memory, cognition, narrative]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/features/F-0009-context-builder-and-structured-decision-harness.md"
    - "docs/adr/ADR-2026-03-23-subject-state-evidence-refs.md"
---

# F-0011 Нарративный и меметический контур рассуждения

## 1. Context & Goal

- **User problem:** После `F-0003`, `F-0004` и `F-0005` система уже умеет безопасно жить тиками, загружать bounded subject-state snapshot и принимать нормализованные stimuli, но у неё всё ещё нет канонического owner-а для narrative continuity и memetic competition. Если этот шов не intaken явно, следующие cognition slices начинают либо писать durable narrative/memetic state ad hoc из runtime/context paths, либо прятать незрелые tensions и patterns в `psm_json` или другие чужие surfaces, что архитектура прямо запрещает.
- **Goal:** Создать канонический dossier-owner для `Memetic Arena`, `Narrative Manager` и `field journal` как одного phase-1 cognition seam: он должен потреблять delivered tick/perception/subject-state surfaces, держать разделение между tick-local candidates и durable memetic units, владеть narrative/memetic read-write boundary и не размывать ownership соседних memory/governor/consolidation seams.
- **Non-goals:** Operator API, executive/action layer, subject-state ownership, baseline model routing, full consolidation/compaction lifecycle, graceful shutdown biography, governor policy gates, workshop/eval pipeline и controlled body evolution в этот intake не входят.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0003` tick runtime and continuity bridge, `F-0004` versioned subject-state store, `F-0005` perception ingress/buffer and `F-0009` bounded context/decision harness. This intake keeps `memetics + narrative + field journal` in one dossier, while durable promotion/merge/split/compaction paths remain explicitly separated into `CF-018`.

## 2. Scope

### In scope

- Канонический owner для `Memetic Arena`, `Narrative Manager` и `field journal` как одного cognition seam.
- Tick-local candidate assembly, activation/reinforcement/decay for existing durable units, coalition formation и handoff их bounded outputs downstream cognition paths.
- Narrative spine updates, field journal maintenance и явное различение facts / interpretations / direction на narrative surfaces.
- Ownership над future narrative/memetic surfaces `memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries` с явно ограниченными write paths.
- Intake-level фиксация `Memetic Lifecycle` contract: bootstrap baseline set, tick-local candidate vs durable unit boundary, `no raw-ingest-to-durable`, `provenance required`.

### Out of scope

- Durable promotion, merge, split, quarantine, retire, compaction and retention semantics for narrative/memetic state; these stay with `CF-018` as the allowed compaction/promotion seam.
- Governor/operator labeling paths for new durable units; these stay with `CF-016` and later governance seams.
- Direct writes to `psm_json`, `goals`, `beliefs`, `entities` or `relationships`; those remain owned by `F-0004`.
- Alternative self-model schemas, hidden caches or narrative/memetic mirrors outside the canonical PostgreSQL surfaces.
- Expanded model ecology, operator-facing introspection API, reporting jobs and workshop/development ledger surfaces.

### Constraints

- `memetic candidate` и `memetic unit` are different entities and must not collapse into one storage or lifecycle concept.
- Первый `wake` tick не может зависеть от прошлого narrative/memetic цикла; bootstrap seed set must come from constitution, identity core and initial goals/beliefs.
- Raw `stimulus_inbox.normalized_json`, user messages and other single-shot payloads cannot be persisted verbatim as durable `memetic_units`.
- Ordinary ticks may update activation/reinforcement/decay on existing units and write narrative/journal outputs, but durable promotion of new units must go only through explicit allowed paths owned by `CF-018` or future governor/operator gates.
- This seam owns only narrative/memetic surfaces. Direct writes to subject-state tables in `F-0004` are forbidden; reads and deltas must continue through canonical owner contracts.
- `F-0011` must consume the versioned bounded subject-state snapshot as input and must not introduce an alternative ad hoc self-model schema outside the existing subject-state contract.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0011-01:** The feature establishes one canonical owner seam for `Memetic Arena`, `Narrative Manager` and `field journal`: bootstrap before the first `wake` tick materializes a minimal memetic baseline from constitution, identity core and initial goals/beliefs, while ordinary ticks continue from that baseline without depending on a nonexistent previous narrative cycle.
- **AC-F0011-02:** Tick-local memetic candidate assembly consumes only canonical inputs from the current tick context: current stimulus/perception aggregates, retrieved episodes, active goals/beliefs, bounded subject-state snapshot, active durable units, field-journal excerpts and resource posture; raw `stimulus_inbox` payloads and other single-shot inputs must not be persisted verbatim as durable `memetic_units`.
- **AC-F0011-03:** Normal `wake` / `reactive` / later supported cognition ticks may update activation, reinforcement, decay, coalition rows and narrative/field-journal outputs for existing patterns, but they must not silently create new durable `memetic_units`; promotion, merge, split, quarantine and retire semantics require an explicit consolidation/governor/operator path outside this feature.
- **AC-F0011-04:** One-off unresolved tensions and immature patterns remain in `field_journal_entries` and related narrative surfaces until sufficient repeated evidence exists for future durable promotion, and every durable memetic unit must keep provenance anchors to episodes, goals, beliefs, entities, narrative tensions or model-organ decisions.
- **AC-F0011-05:** The feature owns only narrative/memetic surfaces (`memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries`) and exposes their bounded outputs downstream; it must not directly mutate `psm_json`, `goals`, `beliefs`, `entities` or `relationships` outside canonical owner contracts.

## 4. Non-functional requirements (NFR)

- **Continuity:** Narrative and memetic state must remain compatible with one subjective timeline rather than a parallel hidden history.
- **Traceability:** Durable units and narrative revisions must preserve provenance anchors instead of opaque, anchorless summaries.
- **Scope discipline:** This seam must not absorb consolidation/governor/subject-state ownership under the pretext of “making cognition work”.
- **Determinism:** Candidate assembly and bounded downstream outputs should be reproducible from canonical tick/perception/subject-state inputs.

## 5. Design (compact)

### 5.1 Runtime / cognition surface

- `F-0011` sits after delivered tick, perception and bounded subject-state inputs, and before or alongside future enriched context assembly.
- The seam consumes canonical inputs from `F-0003`, `F-0004` and `F-0005`, and later exposes bounded narrative/memetic outputs to downstream cognition consumers such as `F-0009`.
- Ownership split fixed at intake:
  - `F-0011` owns candidate assembly, activation/reinforcement/decay on existing units, coalition formation, narrative spine and field journal updates.
  - `CF-018` owns durable promotion/merge/split/quarantine/retire/compaction transitions.
  - `F-0004` remains the only canonical writer for subject-state tables.

### 5.2 Data model surface

- Canonical narrative/memetic surfaces for this dossier are:
  - `memetic_units`
  - `memetic_edges`
  - `coalitions`
  - `narrative_spine_versions`
  - `field_journal_entries`
- Exact table schemas, transaction boundaries and read models are deferred to `spec-compact`, but the ownership boundary is fixed by this intake.

### 5.3 Edge cases and failure modes

- The first post-boot cycle must not require prior narrative state.
- One-off emotional or interpretive spikes must stay in journal/narrative surfaces until repeated evidence exists.
- Ordinary ticks must not become a backdoor for durable promotion of one-off stimuli.
- Any attempt to bypass `F-0004` and write subject-state tables directly from this seam is an architecture defect.

### 5.4 Verification surface

- `spec-compact` must define verification that covers:
  - bootstrap seed behavior for the first cycle;
  - tick-local candidate vs durable unit separation;
  - provenance and `no raw-ingest-to-durable` invariants;
  - ownership boundaries between `F-0011`, `F-0004` and `CF-018`;
  - bounded narrative/memetic outputs for downstream cognition consumers.

## 6. Slicing plan

- To be added during `plan-slice`.

## 7. Task list

- To be added during `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0011-01 | `spec-compact` to define bootstrap and first-cycle verification | planned |
| AC-F0011-02 | `spec-compact` to define candidate-assembly and no-raw-ingest verification | planned |
| AC-F0011-03 | `spec-compact` to define promotion-boundary and ordinary-tick write-path verification | planned |
| AC-F0011-04 | `spec-compact` to define provenance and field-journal boundary verification | planned |
| AC-F0011-05 | `spec-compact` to define write-authority boundary verification | planned |

## 9. Decision log (ADR blocks)

### ADR-F0011-01: Keep memetics, narrative spine and field journal in one dossier
- Status: Accepted
- Date: 2026-03-25
- Context: `CF-005` grouped `memetics + narrative + field journal` in one cognition seam, while backlog watchpoints required an explicit intake decision on whether to split that ownership before shaping. Architecture already treats these surfaces as one narrative/memetic cognition owner, but durable promotion/compaction belongs to a later consolidation seam.
- Decision: Keep `memetics`, `narrative spine` and `field journal` in one feature dossier `F-0011`, while leaving durable promotion/merge/split/compaction transitions explicitly out of scope for this dossier and owned by `CF-018`.
- Alternatives: Split memetic and narrative surfaces into separate dossiers now; fold consolidation/promotion into the same dossier.
- Consequences: `F-0011` owns the runtime cognition boundary for narrative/memetic state, while shaping must preserve the explicit separation to consolidation and subject-state owners.

## 10. Progress & links

- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Candidate source: `CF-005`
- Delivered prerequisites: `F-0003`, `F-0004`, `F-0005`
- Optional process artifacts:
  - `.dossier/verification/F-0011/...`
  - `.dossier/reviews/F-0011/...`
  - `.dossier/steps/F-0011/...`

## 11. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-005`; intake keeps memetics, narrative spine and field journal in one dossier and explicitly leaves durable promotion/compaction to `CF-018`.
