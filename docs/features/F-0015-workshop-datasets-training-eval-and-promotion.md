---
id: F-0015
title: Контур workshop для датасетов, обучения, оценки и promotion
status: done
coverage_gate: strict
owners: ["@codex"]
area: workshop
depends_on: [F-0002, F-0003, F-0014]
impacts: [runtime, db, models, workshop, artifacts, observability]
created: 2026-03-25
updated: 2026-03-26
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/features/F-0014-expanded-model-ecology-and-registry-health.md"
---

# F-0015 Контур workshop для датасетов, обучения, оценки и promotion

## 1. Context & Goal

- **User problem:** После `F-0002`, `F-0003` и `F-0014` система уже имеет каноническую deployment cell, PostgreSQL/`pg-boss` worker substrate и richer model ecology, но у workshop-контура по-прежнему нет явного dossier-owner. Без отдельного owner seam датасеты, training runs, eval suites, candidate registration и promotion/rollback evidence начинают расползаться между `core`, richer `model_registry`, future governor и specialist rollout policy, а затем появляются скрытые direct-write paths в active profile pointers и несогласованные training/eval артефакты.
- **Goal:** Зафиксировать один canonical owner для workshop lifecycle: feature должна владеть dataset construction, redaction/split discipline, LoRA/QLoRA/shared-model training, eval suites, candidate registration, full staged candidate lifecycle semantics (`candidate -> shadow -> limited-active -> active -> stable -> rollback`), artifact packaging и bounded promotion/rollback handoff через canonical owner gates, не забирая у соседних seams ownership над live activation, specialist lifecycle, policy approval или body/code evolution.
- **Non-goals:** Specialist organ birth/staged rollout/retirement, direct operator HTTP publication, baseline/richer registry source ownership, development governor policy approval, code/body evolution и reporting/read-model ownership не входят в этот intake.
- **Current substrate / baseline:** Delivered prerequisites already exist as the canonical deployment cell and mutable artifact volumes in `F-0002`, the canonical PostgreSQL/`pg-boss` scheduler/worker substrate in `F-0003`, and the richer model source surfaces in `F-0014`. Architecture already fixes one `polyphony-workshop` worker, internal core↔workshop protocol examples and the durable surfaces `datasets`, `training_runs` and `eval_runs`; this dossier turns those architectural promises into one explicit feature owner.

## 2. Scope

### In scope

- Canonical owner for workshop source surfaces and lifecycle around:
  - dataset construction
  - dataset provenance, redaction and split manifests
  - LoRA / QLoRA training runs
  - shared-model / adapter candidate registration
  - durable candidate lifecycle state
  - candidate stage-transition audit
  - offline / regression eval suites
  - artifact packaging
  - promotion / rollback handoff packages
- Canonical workshop runtime path on the existing substrate:
  - `polyphony-workshop` worker
  - PostgreSQL / `pg-boss` job families from `F-0003`
  - internal core↔workshop protocol over bounded HTTP/JSON plus artifact volumes
- Durable source-of-truth evidence for:
  - which dataset produced a candidate
  - which eval suites passed or failed
  - which predecessor / rollback target is attached to a candidate
  - which artifact URI / model package is being proposed for promotion
- Full lifecycle semantics for stages `candidate`, `shadow`, `limited-active`, `active`, `stable` and `rollback`, including which transitions are workshop-shaped but future-executed by neighbouring owner gates.
- One explicit boundary between workshop-owned candidate preparation and downstream owner gates that activate or govern live model usage.
- Canonical retention / audit trail for workshop artifacts and run metadata without inventing a parallel shadow registry.

### Out of scope

- Specialist organ birth, staged traffic rollout, retirement policy and specialist-specific lifecycle governance; those remain `CF-019`.
- Direct writes to active model continuity pointers such as `ticks.selected_model_profile_id` or `agent_state.current_model_profile_id`; those remain with `F-0008` / runtime continuity.
- Ownership of richer source `model_registry`, `model_profile_health` or `model_fallback_links`; those remain `F-0014`.
- Governor approval policy, human-review requirements, freeze/development gates and final governance decisions; those remain `CF-016`.
- Operator-facing API routes such as `/models`, `/health` or future workshop-facing HTTP endpoints; those remain `F-0013` or later API seams.
- Code/body evolution, worktrees, body eval suites and code rollback; those remain `CF-012`.
- Reporting/read-model publication for workshop metrics or promotion summaries; those remain future observability seams such as `CF-015`.

### Constraints

- The workshop seam must run on the canonical runtime/deployment path that already exists in `F-0002` and `F-0003`; introducing a second queue/runtime/orchestrator stack is forbidden.
- Workshop may prepare candidates and promotion packages, but it may not silently activate them by direct mutation of baseline profile pointers or richer registry source rows outside canonical owner gates.
- `F-0015` owns lifecycle semantics and durable candidate rows, but transition execution into live usage still requires bounded approval/activation handoff through `CF-016`, `F-0008`, `F-0014` and, for specialist-specific policy, `CF-019`.
- Training datasets must preserve provenance and secret-redaction discipline. Raw autobiographical prose, unreviewed secrets or unbounded operator dumps must not become direct train-set material.
- The seam must support both shared-adapter training and future specialist candidates without preemptively seizing `CF-019` specialist lifecycle policy.
- Promotion and rollback evidence must remain machine-readable and durable. Hidden filesystem-only promotion state is forbidden.
- `promotion-package` becomes a bounded projection over canonical candidate lifecycle state; introducing a second shadow source of truth for promotion state is forbidden.
- Workshop workers are not identity-bearing actors; they execute bounded jobs under canonical runtime control and may not invent autonomous policy.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0015-01:** `F-0015` establishes one canonical owner seam for workshop lifecycle surfaces: dataset construction, training runs, eval runs, `model_candidates`, `candidate_stage_events` and bounded promotion-package projection may no longer live ad hoc in runtime helpers, richer registry code or operator/debug scripts.
- **AC-F0015-02:** The canonical workshop runtime path reuses the delivered PostgreSQL/`pg-boss` substrate and one bounded internal core↔workshop protocol. Dataset build, train, eval, promote and rollback requests must route through explicit workshop jobs/contracts rather than a shadow orchestrator or direct shell workflow.
- **AC-F0015-03:** Dataset construction is canonical and auditable: every durable workshop dataset preserves source provenance, redaction/dedup metadata and train/validation/holdout split manifests derived from canonical episodes, evaluations and human labels rather than raw unbounded autobiographical text dumps.
- **AC-F0015-04:** Training and evaluation lifecycle is canonical for the workshop seam: LoRA/QLoRA or equivalent bounded training runs, offline/regression eval suites, resulting artifacts and candidate-registration evidence all remain linked by durable run metadata and status transitions.
- **AC-F0015-05:** Candidate lifecycle semantics are canonical and complete in this seam: `candidate`, `shadow`, `limited-active`, `active`, `stable` and `rollback` are durable, machine-readable states with explicit transition evidence, but `F-0015` shapes rather than unilaterally executes transitions into live activation.
- **AC-F0015-06:** Promotion and rollback handoff is explicit and machine-readable: every candidate proposed for a later-stage transition carries a predecessor reference, rollback target, required eval evidence and artifact/package reference; `promotion-package` is a bounded DTO over canonical lifecycle state rather than a second source-of-truth table.
- **AC-F0015-07:** Ownership boundaries remain explicit after shaping: `F-0015` owns workshop preparation surfaces and candidate lifecycle truth, `F-0014` owns richer model-registry source state, `F-0008` owns baseline continuity pointers, `CF-016` owns governance approval and freeze policy, `CF-019` owns specialist rollout/retirement policy overlays, `CF-012` owns body/code evolution, and `F-0013` remains the operator HTTP publication seam.
- **AC-F0015-08:** Workshop artifacts and metadata live on one canonical artifact path and one canonical metadata path: datasets, reports, adapters, lifecycle events and training/eval metadata must be recoverable through durable DB rows plus explicit artifact URIs rather than scattered unindexed files or route-local caches.
- **AC-F0015-09:** Secret-redaction and train-set hygiene are first-class workshop requirements: the seam must forbid direct export of secrets, raw credentials or unreviewed autobiographical prose into training artifacts, and must keep the resulting evidence attached to the dataset manifest.

## 4. Non-functional requirements (NFR)

- **Determinism:** Given the same source inputs, redaction policy and training/eval configuration, the workshop metadata trail should reconstruct the same candidate lineage and decision basis.
- **Auditability:** Every candidate, promotion package and rollback reference must remain attributable to datasets, runs, eval evidence and artifact URIs.
- **Operational safety:** Workshop failures or optional service absence must degrade explicitly without silently corrupting active model continuity or turning workshop into a boot-critical dependency.
- **Boundary discipline:** The seam must not smuggle in specialist rollout, governor approval or code-evolution ownership under the umbrella of “training pipeline”.
- **Recoverability:** Artifact paths and run metadata must support later rollback, reporting and snapshot consumers without re-parsing opaque ad hoc files.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0015` does not own a public HTTP route family in this intake.
- The seam owns bounded internal workshop request/result contracts and canonical job payloads for:
  - dataset build
  - training run launch
  - eval run launch
  - candidate registration
  - candidate stage-transition recording
  - promotion / rollback package preparation
- Compact contract shape fixed by this dossier:

```ts
type WorkshopDatasetBuildRequest = {
  requestId: string;
  datasetKind: "sft" | "eval" | "specialist";
  sourceEpisodeIds: string[];
  sourceEvalRunIds: string[];
  redactionProfile: string;
};

type WorkshopTrainingRequest = {
  requestId: string;
  targetKind: "shared_adapter" | "specialist_candidate";
  targetProfileId: string | null;
  datasetId: string;
  method: "lora" | "qlora" | "other_bounded_method";
};

type WorkshopEvalRequest = {
  requestId: string;
  subjectKind: "adapter_candidate" | "specialist_candidate";
  subjectRef: string;
  suiteName: string;
};

type RegisterModelCandidateRequest = {
  requestId: string;
  candidateKind: "shared_adapter" | "specialist_candidate";
  targetProfileId: string | null;
  datasetId: string;
  trainingRunId: string;
  latestEvalRunId: string;
  artifactUri: string;
  predecessorProfileId: string | null;
  rollbackTarget: string | null;
  requiredEvalSuite: string;
  lastKnownGoodEvalReportUri: string | null;
};

type RecordCandidateStageTransitionRequest = {
  requestId: string;
  candidateId: string;
  toStage: "candidate" | "shadow" | "limited-active" | "active" | "stable" | "rollback";
  triggerKind: "workshop_eval_passed" | "approval_granted" | "activation_confirmed" | "rollback_requested";
  evidenceRefs: string[];
  requestedByOwner: "F-0015" | "CF-016" | "F-0008" | "F-0014" | "CF-019" | "CF-018";
};

type WorkshopPromotionPackage = {
  candidateId: string;
  candidateStage: "shadow" | "limited-active" | "active" | "stable" | "rollback";
  candidateKind: "shared_adapter" | "specialist_candidate";
  targetProfileId: string | null;
  predecessorProfileId: string | null;
  rollbackTarget: string | null;
  requiredEvalSuite: string;
  lastKnownGoodEvalReportUri: string | null;
  artifactUri: string;
};
```

- `RegisterModelCandidateRequest` and `RecordCandidateStageTransitionRequest` write canonical workshop lifecycle truth.
- `WorkshopPromotionPackage` is a bounded projection assembled from canonical lifecycle state and evidence; it is not a second durable source of truth.
- These contracts are workshop-owned preparation surfaces only. Live activation, operator publication and policy approval remain with neighbouring owners.

### 5.2 Runtime and deployment surface

- The seam lives on the existing deployment cell from `F-0002` as one bounded `polyphony-workshop` worker plus core-side adapters.
- Job execution must reuse the canonical PostgreSQL/`pg-boss` substrate from `F-0003`.
- Internal communication follows the architecture-fixed core↔workshop protocol shape: bounded HTTP/JSON commands plus artifact exchange through canonical runtime volumes.
- Workshop may read canonical source surfaces from episodes/evals/model registry, but it must write only its own source surfaces plus bounded candidate/promotion packages.
- Optional training services remain non-identity-bearing and must not enlarge the boot-critical dependency set silently.

### 5.3 Data model changes

- Canonical durable source surfaces owned or shaped by this dossier are:
  - `datasets`
  - `training_runs`
  - `eval_runs`
  - `model_candidates`
  - `candidate_stage_events`
- `datasets` must minimally preserve:
  - `dataset_id`
  - `dataset_kind`
  - `source_manifest_json`
  - `source_episode_ids_json`
  - `split_manifest_json`
  - `status`
  - `created_at`
- `training_runs` must minimally preserve:
  - `run_id`
  - `target_kind`
  - `target_profile_id`
  - `dataset_id`
  - `method`
  - `hyperparams_json`
  - `metrics_json`
  - `artifact_uri`
  - `status`
  - `started_at`
  - `ended_at`
- `eval_runs` must minimally preserve:
  - `eval_run_id`
  - `subject_kind`
  - `subject_ref`
  - `suite_name`
  - `metrics_json`
  - `pass`
  - `report_uri`
  - `created_at`
- `model_candidates` must minimally preserve:
  - `candidate_id`
  - `candidate_kind`
  - `target_profile_id`
  - `dataset_id`
  - `training_run_id`
  - `latest_eval_run_id`
  - `artifact_uri`
  - `stage`
  - `predecessor_profile_id`
  - `rollback_target`
  - `required_eval_suite`
  - `last_known_good_eval_report_uri`
  - `status_reason`
  - `created_at`
  - `updated_at`
- `candidate_stage_events` must minimally preserve:
  - `event_id`
  - `candidate_id`
  - `from_stage`
  - `to_stage`
  - `trigger_kind`
  - `evidence_json`
  - `requested_by_owner`
  - `created_at`
- `model_candidates` and `candidate_stage_events` stay separate from active profile pointers and richer registry source rows.

### 5.4 Edge cases and failure modes

- Dataset build with unredacted secrets or invalid provenance must fail before a durable training dataset is registered.
- Failed training or eval runs must remain durable as failed evidence, not disappear into transient worker logs.
- Missing predecessor / rollback target must block promotion-package completion rather than silently promoting a candidate without rollback metadata.
- Attempted stage entry into `shadow`, `limited-active`, `active` or `stable` without the required external handoff/approval evidence must fail rather than let workshop self-activate a model.
- Workshop worker unavailability must degrade boundedly; it must not block baseline core startup or silently invent healthy/evaluated candidate state.
- Shared-adapter candidates and future specialist candidates may share workshop infrastructure, but unsupported specialist rollout policy must remain explicit future-owned state rather than improvised activation.
- `promotion-package` assembly must read canonical candidate lifecycle rows and stage events; it may not drift into a shadow promotion table or filesystem-only manifest.

### 5.5 Verification surface

- Expected verification includes contract coverage for workshop job payloads, dataset provenance/redaction manifests, training/eval store flows, candidate/promotion package assembly and no-foreign-write boundaries.
- Integration coverage should prove workshop writes stay on canonical source surfaces and do not seize active routing or richer registry ownership.
- If implementation materially changes runtime startup, workshop service wiring or deployment-cell posture, container smoke is mandatory at feature closure.

## 6. Definition of Done

- `F-0015` is the canonical owner of workshop dataset/training/eval/candidate lifecycle surfaces and bounded promotion-package projection.
- Dataset provenance, split/redaction discipline and artifact lineage are durable and machine-readable.
- Full staged lifecycle semantics (`candidate`, `shadow`, `limited-active`, `active`, `stable`, `rollback`) are canonically fixed without giving workshop unilateral live-activation authority.
- Promotion and rollback packages are explicit and do not bypass `F-0008`, `F-0014`, `CF-016` or `CF-019` boundaries.
- The workshop seam runs on the canonical deployment / PostgreSQL / `pg-boss` substrate instead of a parallel orchestration path.
- Workshop does not become a direct writer for operator routes, active profile pointers, richer registry source state, governor policy surfaces or body/code evolution surfaces.
- Architecture, backlog and SSOT index all point to this dossier as the canonical owner of the workshop pipeline.

## 7. Slicing plan

Implementation order is strict: `SL-F0015-01 -> SL-F0015-02 -> SL-F0015-03 -> SL-F0015-04`.

Planning defaults fixed by this step:
- First implementation wave must make the lifecycle substrate generic for both `shared_adapter` and `specialist_candidate`, but only shared-adapter paths are expected to reach live handoff in the first delivery wave.
- Specialist candidates reuse the same workshop stores/contracts immediately, while specialist-specific rollout fractions, retirement and traffic policy remain deferred to `CF-019`.
- No slice in this dossier may introduce direct writes to active profile pointers or richer `model_registry` rows; every such boundary stays external by design.

### Slice SL-F0015-01: Dataset construction and provenance boundary
Delivers: canonical dataset manifests, provenance/redaction/split discipline and one explicit dataset-build contract over the delivered episode/eval sources.
Covers: AC-F0015-01, AC-F0015-02, AC-F0015-03, AC-F0015-09
Verification: `packages/contracts/test/workshop/dataset-build.contract.test.ts`, `packages/db/test/workshop/datasets-store.integration.test.ts`
Exit criteria:
- Workshop datasets are materialized through one canonical contract/store path.
- Provenance and redaction evidence are durable and machine-readable.
- Raw ad hoc exports no longer masquerade as canonical train-set input.
- One canonical dataset adapter/store boundary exists for later training/eval slices; no direct runtime helper writes remain.

### Slice SL-F0015-02: Training and eval lifecycle
Delivers: canonical training-run and eval-run lifecycle for shared adapters and future specialist candidates without taking ownership of specialist rollout policy.
Covers: AC-F0015-02, AC-F0015-04, AC-F0015-08
Verification: `packages/db/test/workshop/training-runs.integration.test.ts`, `apps/core/test/workshop/eval-pipeline.integration.test.ts`
Exit criteria:
- Training and eval runs are durable, linked and auditable.
- Artifact URIs and metrics stay attached to the run lineage.
- Workshop infrastructure can serve shared-adapter and future specialist candidates without claiming specialist lifecycle ownership.
- Candidate registration preconditions are explicit: no candidate row may appear without linked dataset, training and latest eval evidence.

### Slice SL-F0015-03: Candidate lifecycle and bounded promotion handoff
Delivers: explicit `model_candidates` lifecycle surface, `candidate_stage_events` audit trail and bounded promotion-package assembly with predecessor, rollback target and required eval evidence.
Covers: AC-F0015-05, AC-F0015-06, AC-F0015-07, AC-F0015-08
Verification: `apps/core/test/workshop/candidate-lifecycle.contract.test.ts`, `apps/core/test/workshop/promotion-package.contract.test.ts`, `apps/core/test/workshop/ownership-boundary.integration.test.ts`
Exit criteria:
- Full staged lifecycle semantics are encoded in one canonical store/contract path.
- Candidate promotion packages are durable and machine-readable.
- Workshop can prepare activation-ready evidence without mutating active routing or richer registry source rows directly.
- Ownership boundaries to `F-0008`, `F-0014`, `CF-016` and `CF-019` remain explicit in code and contract coverage.
- The `F-0014` workshop-owner realignment introduced at intake is confirmed not to require hidden runtime/test changes; if deeper coupling is discovered, it is reopened explicitly through this dossier rather than left as drift.
- Shared-adapter candidates may produce real handoff-ready packages in this dossier; specialist candidates must stop at the same lifecycle substrate without inventing specialist-only rollout semantics.

### Slice SL-F0015-04: Runtime closure and deployment alignment
Delivers: canonical workshop job family wiring, artifact-volume closure and conditional smoke coverage when workshop wiring materially affects runtime/deployment posture.
Covers: AC-F0015-02, AC-F0015-08, AC-F0015-09
Verification: `apps/core/test/workshop/workshop-runtime.integration.test.ts`, `infra/docker/deployment-cell.smoke.ts`
Exit criteria:
- Workshop jobs run on the canonical PostgreSQL/`pg-boss` substrate and artifact volumes.
- Worker/runtime failure modes stay bounded and explicit.
- Deployment-cell smoke covers workshop wiring if the live container/runtime path changes materially.
- No new public HTTP route family is introduced; only internal workshop wiring and bounded runtime adapters are closed here.

## 8. Task list

- **T-F0015-01 (SL-F0015-01):** Define the canonical dataset-build request/result contract and provenance/redaction manifest schema. Covers: AC-F0015-02, AC-F0015-03, AC-F0015-09.
- **T-F0015-02 (SL-F0015-01):** Implement/store canonical `datasets` rows from bounded episode/eval inputs without ad hoc export scripts. Covers: AC-F0015-01, AC-F0015-03.
- **T-F0015-03 (SL-F0015-02):** Shape training-run lifecycle and persistent metadata for shared adapters and future specialist candidates. Covers: AC-F0015-02, AC-F0015-04, AC-F0015-08.
- **T-F0015-04 (SL-F0015-02):** Shape eval-run lifecycle and report lineage for regression/holdout suites. Covers: AC-F0015-04, AC-F0015-08.
- **T-F0015-05 (SL-F0015-03):** Define `model_candidates` as the canonical durable lifecycle surface with the full staged state machine. Covers: AC-F0015-01, AC-F0015-05, AC-F0015-08.
- **T-F0015-06 (SL-F0015-03):** Define `candidate_stage_events` and the bounded `promotion-package` projection with predecessor, rollback and eval evidence requirements. Covers: AC-F0015-05, AC-F0015-06, AC-F0015-08.
- **T-F0015-09 (SL-F0015-03):** Prove workshop handoff does not seize ownership from `F-0008`, `F-0014`, `CF-016` or `CF-019`, and validate the `F-0014` owner-boundary realignment introduced by `feature-intake`. Covers: AC-F0015-07.
- **T-F0015-07 (SL-F0015-04):** Wire workshop jobs onto the canonical `pg-boss`/artifact-volume path and bound failure behavior. Covers: AC-F0015-02, AC-F0015-08.
- **T-F0015-08 (SL-F0015-04):** Add final runtime/smoke verification for workshop delivery when live deployment posture changes and preserve dataset hygiene on the live path. Covers: AC-F0015-08, AC-F0015-09.
- **T-F0015-10 (SL-F0015-04):** Keep the first implementation wave shared-adapter-first: specialist candidates must reuse the same lifecycle substrate without adding specialist-specific rollout or retirement logic. Covers: AC-F0015-05, AC-F0015-07.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0015-01 | `packages/db/test/workshop/datasets-store.integration.test.ts` → canonical workshop source surfaces and no shadow lifecycle helpers `// Covers: AC-F0015-01` | done |
| AC-F0015-02 | `packages/contracts/test/workshop/job-contracts.contract.test.ts`, `apps/core/test/workshop/workshop-runtime.integration.test.ts` → canonical core↔workshop job payloads and queue-family wiring on PostgreSQL/`pg-boss` `// Covers: AC-F0015-02` | done |
| AC-F0015-03 | `packages/contracts/test/workshop/dataset-build.contract.test.ts`, `packages/db/test/workshop/datasets-store.integration.test.ts` → provenance, reviewed redaction and split manifests `// Covers: AC-F0015-03` | done |
| AC-F0015-04 | `packages/db/test/workshop/training-runs.integration.test.ts`, `apps/core/test/workshop/eval-pipeline.integration.test.ts` → durable training/eval lineage and candidate evidence `// Covers: AC-F0015-04` | done |
| AC-F0015-05 | `apps/core/test/workshop/candidate-lifecycle.contract.test.ts` → full staged lifecycle semantics and external-gate transition requirements `// Covers: AC-F0015-05` | done |
| AC-F0015-06 | `apps/core/test/workshop/promotion-package.contract.test.ts` → predecessor, rollback target, required eval evidence and DTO-over-lifecycle semantics in bounded promotion handoff `// Covers: AC-F0015-06` | done |
| AC-F0015-07 | `apps/core/test/workshop/ownership-boundary.integration.test.ts` → workshop does not seize `F-0008` / `F-0014` / `CF-016` / `CF-019` ownership `// Covers: AC-F0015-07` | done |
| AC-F0015-08 | `packages/db/test/workshop/artifact-lineage.integration.test.ts`, `apps/core/test/workshop/workshop-runtime.integration.test.ts` → canonical artifact URI and lifecycle-event lineage plus bounded startup degradation with no scattered hidden state `// Covers: AC-F0015-08` | done |
| AC-F0015-09 | `packages/contracts/test/workshop/dataset-build.contract.test.ts`, `infra/docker/deployment-cell.smoke.ts` → secret-redaction guardrails and bounded deployment-cell workshop wiring `// Covers: AC-F0015-09` | done |

## 10. Decision log (ADR blocks)

### ADR-F0015-01: Workshop owns full candidate lifecycle semantics, but not live approval or activation
- Status: Accepted
- Date: 2026-03-25
- Context: The architecture couples datasets, training, eval, candidate promotion and rollback closely, but neighbouring seams already reserve specialist rollout/retirement to `CF-019` and policy approval/freeze gates to `CF-016`.
- Decision: `F-0015` owns dataset/training/eval plus the canonical durable state machine for `candidate -> shadow -> limited-active -> active -> stable -> rollback`. Governance approval, live activation writes, specialist traffic policy and retirement remain outside this dossier.
- Alternatives: Keep only bounded handoff here; let workshop directly approve/promote live model changes.
- Consequences: The lifecycle becomes decision-complete for implementation and downstream seams can reuse one canonical contract without granting workshop extra write authority.

### ADR-F0015-02: Workshop must reuse the canonical PostgreSQL/`pg-boss` substrate and internal core↔workshop protocol
- Status: Accepted
- Date: 2026-03-25
- Context: The architecture already names one `polyphony-workshop` worker and one canonical scheduler/worker substrate from `F-0003`. Without an explicit decision, training/eval tooling tends to sprout separate orchestrators, ad hoc shell pipelines or filesystem-only state.
- Decision: Dataset build, training, eval and promotion-package preparation must run through canonical workshop jobs/contracts over PostgreSQL/`pg-boss`, bounded internal commands and artifact volumes.
- Alternatives: Use a separate external orchestrator; keep workshop state mostly in opaque files and scripts.
- Consequences: Workshop remains auditable, recoverable and aligned with the rest of the runtime lifecycle.

### ADR-F0015-03: `model_candidates` + `candidate_stage_events` are the lifecycle truth; `promotion-package` is a projection
- Status: Accepted
- Date: 2026-03-26
- Context: Full staged lifecycle shaping requires durable truth for candidate state and stage transitions. Leaving promotion state split between lifecycle rows, ad hoc files and separate package tables would recreate shadow state.
- Decision: Persist lifecycle truth in `model_candidates` and `candidate_stage_events`. Assemble `promotion-package` as a bounded DTO over those surfaces plus eval lineage, rather than storing it as a second independent source of truth.
- Alternatives: Keep only a package table; store most lifecycle state in filesystem manifests.
- Consequences: Workshop state stays auditable and neighbouring seams can consume a bounded projection without owning workshop lifecycle storage.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> done`
- Candidate source: `CF-011`
- Delivered prerequisites: `F-0002`, `F-0003`, `F-0014`
- Delivered code:
  - `apps/core/src/runtime/index.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/src/workshop/index.ts`
  - `apps/core/src/workshop/service.ts`
  - `apps/core/src/workshop/worker.ts`
  - `apps/core/test/workshop/candidate-lifecycle.contract.test.ts`
  - `apps/core/test/workshop/eval-pipeline.integration.test.ts`
  - `apps/core/test/workshop/ownership-boundary.integration.test.ts`
  - `apps/core/test/workshop/promotion-package.contract.test.ts`
  - `apps/core/test/workshop/workshop-runtime.integration.test.ts`
  - `apps/core/testing/workshop-fixture.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/010_workshop_pipeline.sql`
  - `packages/contracts/package.json`
  - `packages/contracts/src/workshop.ts`
  - `packages/contracts/test/workshop/dataset-build.contract.test.ts`
  - `packages/contracts/test/workshop/job-contracts.contract.test.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/workshop.ts`
  - `packages/db/test/workshop/artifact-lineage.integration.test.ts`
  - `packages/db/test/workshop/datasets-store.integration.test.ts`
  - `packages/db/test/workshop/training-runs.integration.test.ts`
  - `packages/db/testing/workshop-db-harness.ts`
- Verification:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer debt-audit --changed-only`
  - `dossier-engineer index-refresh`
  - `dossier-engineer lint-dossiers`
  - `dossier-engineer coverage-audit --dossier docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md --orphans-scope=dossier`
  - `dossier-engineer contract-drift-audit --dossier docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md --base HEAD~1`
  - `dossier-engineer dossier-verify --dossier docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md --step implementation`
- Issue: none
- PRs: none
- Process artifacts:
  - `.dossier/verification/F-0015/...`
  - `.dossier/reviews/F-0015/...`
  - `.dossier/steps/F-0015/...`

## 12. Change log

- **v1.0 (2026-03-25):** Initial dossier created from `CF-011`; intake fixes one canonical owner for workshop datasets, training, eval, candidate registration and bounded promotion/rollback handoff while keeping richer model-registry ownership with `F-0014`, operator publication with `F-0013`, governance approval with `CF-016`, specialist lifecycle with `CF-019` and body/code evolution with `CF-012`.
- **v1.1 (2026-03-26):** `spec-compact`: fixed the full staged candidate lifecycle as canonical workshop-owned semantics, introduced explicit `model_candidates` and `candidate_stage_events` source surfaces, made `promotion-package` a bounded projection instead of a second source of truth, and clarified that `CF-016`, `F-0008`, `F-0014` and `CF-019` execute approval/activation overlays rather than owning workshop lifecycle storage.
- **v1.2 (2026-03-26):** `plan-slice`: moved the dossier to `planned`, fixed strict delivery order `dataset -> training/eval -> candidate lifecycle -> runtime closure`, made the first implementation wave shared-adapter-first while preserving a generic specialist-capable lifecycle substrate, and turned the slices/tasks into implementation-ready closure criteria without reopening ownership boundaries.
- **v1.3 (2026-03-26):** `implementation`: delivered the canonical workshop seam on the existing PostgreSQL/`pg-boss` substrate. `@yaagi/contracts/workshop` and `@yaagi/db` now own bounded job payloads plus durable `datasets`, `training_runs`, `eval_runs`, `model_candidates` and `candidate_stage_events`; `apps/core` materializes dataset/eval/promotion artifacts on canonical volumes, starts the workshop queue family in bounded degraded mode, proves full lifecycle and ownership boundaries through AC-linked tests, and container smoke now checks workshop queue wiring and artifact paths.
- **v1.4 (2026-04-10):** `F-0016` downstream alignment: governor implementation now consumes workshop `promotion-package` DTOs through a governor-owned proposal gate, while this dossier remains the canonical lifecycle owner. No `F-0015` lifecycle truth moves into governor storage; governor proposals store only bounded handoff refs, evidence refs and rollback refs.
