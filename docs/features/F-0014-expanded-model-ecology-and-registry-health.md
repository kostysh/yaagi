---
id: F-0014
title: Расширенная модельная экология и здоровье реестра
status: done
coverage_gate: strict
owners: ["@codex"]
area: models
depends_on: [F-0002, F-0008, F-0013]
impacts: [runtime, db, models, observability, api]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/features/F-0012-homeostat-and-operational-guardrails.md"
    - "docs/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0014 Расширенная модельная экология и здоровье реестра

## 1. Context & Goal

- **User problem:** После `F-0002`, `F-0008` и `F-0013` система уже имеет каноническую deployment cell, baseline organ routing и bounded operator `/models`, но richer organ ecology по-прежнему не имеет явного владельца. Без отдельного dossier-owner phase-2 registry, health diagnostics, quarantine/fallback policy и optional organ services начинают расползаться между baseline router, operator API, Homeostat и future workshop seams, а архитектурные границы `reflection`, structured refusal и separation `selection/admission` быстро размываются.
- **Goal:** Зафиксировать один canonical owner для expanded model ecology beyond baseline `vllm-fast`: feature должна владеть richer registry source state, health/fallback/quarantine metadata для `vllm-deep`, `vllm-pool` и non-baseline shared roles, поставлять bounded source diagnostics для `F-0013` и source contract для будущих `CF-015` reports, и при этом расширять уже delivered baseline router invariants вместо их переоткрытия.
- **Non-goals:** Workshop training/eval/promotion pipeline, specialist organ birth/retirement, operator route ownership, baseline `GET /health` ownership, baseline `reflection` policy and direct governor/development execution не входят в этот intake.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0002` deployment cell and local model substrate, `F-0008` baseline model router and `F-0013` bounded operator introspection route family. `F-0012` already expects `CF-015` read-only model-organ reports for `organ_error_rate`; this dossier therefore owns the upstream richer model-health source state, not the final reporting seam itself.

## 2. Scope

### In scope

- Canonical owner for expanded organ/profile registry beyond the baseline slice from `F-0008`.
- Canonical richer shared-role vocabulary beyond baseline `reflex` / `deliberation` / `reflection`, including:
  - `code`
  - `embedding`
  - `reranker`
  - `classifier`
  - `safety`
- Registry and source-health ownership for optional phase-2 local organs and shared model services such as:
  - `vllm-deep`
  - `vllm-pool`
  - `embedding`
  - `reranker`
- Canonical richer source diagnostics for downstream consumers:
  - bounded operator `/models` projection in `F-0013`
  - future derived `model organ health report` in `CF-015`
- Explicit quarantine, fallback-chain and eligibility semantics for richer organ ecology that extend the baseline router contract without changing its already delivered invariants.
- Canonical metadata for richer profiles/capabilities, including organ kind, endpoint/service identity, declared capabilities, operational availability, quarantine state, fallback predecessor and operational status.
- Logical split of owner surfaces inside the existing `model_registry` family: baseline rows/pointers remain `F-0008`, richer rows plus companion source diagnostics become `F-0014`.

### Out of scope

- Reopening already delivered baseline router invariants from `F-0008`, including explicit `reflection` policy, structured refusal and separation of `selection` from tick `admission`.
- Ownership of operator HTTP routes such as `GET /models`; that remains `F-0013`.
- Ownership of derived read-only `model organ health report` / `profile-health report`; that remains `CF-015`.
- Workshop datasets/training/eval/promotion and candidate-model lifecycle; those remain `F-0015`.
- Specialist organ rollout, staged promotion, retirement policy and specialist birth governance; those remain `CF-019`.
- Governor policy writes, freeze/development proposals or direct human-override logic; those remain `CF-016` and later safety/governance seams.
- Silent promotion of new boot-required dependencies beyond the constitution/platform owners.

### Constraints

- `F-0014` extends the delivered baseline router contract; it must not weaken or replace the explicit-only `reflection` path, structured refusal semantics or the `selection != admission` rule already owned by `F-0008` and `F-0003`.
- Additional organs/services remain optional until constitution/platform owners explicitly elevate them into the required boot dependency set. This seam may not silently make `vllm-deep`, `vllm-pool`, `embedding` or `reranker` mandatory at startup.
- `F-0014` owns richer registry and source-health surfaces only. It must not become a convenience writer for `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `action_log`, `development_ledger`, narrative/memetic tables, operator route state or reporting snapshots.
- Downstream projections for `/models` and future reports must stay bounded, machine-readable and owner-shaped. Raw table dumps, ad hoc JSON blobs and hidden proxy metrics are forbidden.
- The seam must extend the existing `model_registry` family and explicit companion source surfaces; introducing a second shadow registry is forbidden.
- Fallback and quarantine behavior must be explicit in durable registry/health surfaces. Unsupported or policy-forbidden role requests must still resolve via explicit refusal rather than silent remap.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0014-01:** `F-0014` establishes one canonical owner seam for expanded model ecology beyond the baseline `F-0008` slice: richer organ/profile source state, quarantine/fallback metadata and bounded source diagnostics are no longer allowed to live ad hoc in router handlers, operator route code or reporting helpers.
- **AC-F0014-02:** The canonical richer-model contract covers the non-baseline shared-role vocabulary (`code`, `embedding`, `reranker`, `classifier`, `safety`) and the phase-2 optional organ families named by the backlog (`vllm-deep`, `vllm-pool`, `embedding`, `reranker`) with explicit metadata for organ kind, service identity, declared capabilities, operational status and fallback predecessor; baseline `vllm-fast` and first baseline profiles remain with the already delivered `F-0002` / `F-0008` contracts.
- **AC-F0014-03:** `F-0014` defines one canonical richer source-diagnostics contract that downstream seams may consume without inventing shadow state: it exposes machine-readable availability, degradation/quarantine state, error-rate/latency posture and fallback readiness per richer organ/profile for bounded operator projection in `F-0013` and for derived report materialization in `CF-015`; `F-0012` does not read this source state directly.
- **AC-F0014-04:** Expanded fallback and quarantine semantics extend, but do not reopen, the baseline router invariants: explicit `reflection` handling, structured refusal for unsupported roles/capabilities and the separation between model selection and tick admission remain intact; richer ecology may add declared fallback chains and quarantine evidence, but it may not introduce hidden silent fallback or hidden best-effort remap.
- **AC-F0014-05:** Optional phase-2 organ services degrade gracefully when absent or unhealthy: missing `vllm-deep`, `vllm-pool`, `embedding` or `reranker` surfaces must appear as explicit unavailable/degraded/quarantined source state rather than startup-critical hidden dependencies or fabricated healthy profiles.
- **AC-F0014-06:** Ownership boundaries remain explicit after shaping: `F-0014` owns richer model-registry source rows and companion health/fallback source surfaces, `F-0013` stays owner of operator HTTP publication, `CF-015` stays owner of derived read-only `model organ health reports`, `F-0015` stays owner of workshop/promotion preparation, and `CF-019` stays owner of specialist lifecycle policy.
- **AC-F0014-07:** The feature extends the existing `model_registry` family without creating a shadow registry: baseline rows and continuity pointers remain `F-0008`, while richer-role rows plus explicit companion health/fallback source surfaces become `F-0014`-owned and machine-readable enough for later implementation without relying on untyped JSON conventions alone.

## 4. Non-functional requirements (NFR)

- **Determinism:** The same registry state and the same health evidence must produce the same availability/fallback view for downstream consumers.
- **Operational clarity:** Optional organ absence, degradation or quarantine must be represented explicitly and readably, not by silent remap or hidden startup behavior.
- **Phase discipline:** This seam must not smuggle in workshop, specialist rollout or operator-route ownership under the pretext of “richer model support”.
- **Auditability:** Quarantine/fallback decisions and health summaries must stay attributable to canonical registry/health surfaces rather than opaque helper heuristics.
- **Boot safety:** Expanded ecology must not silently enlarge the required boot dependency set.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0014` does not own a new public HTTP route family. Public publication of richer model diagnostics remains bounded by `F-0013`.
- The seam owns internal contracts for:
  - `ExpandedModelProfile`
  - `ExpandedModelProfileHealth`
  - `ExpandedFallbackLink`
  - `OperatorRicherRegistryHealthSummary`
  - `ModelOrganHealthReportInput`
- Downstream consumers read these contracts only through canonical owner adapters; they do not mutate richer registry or source-health state directly.
- Compact contract shape fixed by this dossier:

```ts
type ExpandedModelRole = 'code' | 'embedding' | 'reranker' | 'classifier' | 'safety';

type ExpandedModelProfile = {
  modelProfileId: string;
  role: ExpandedModelRole;
  serviceId: 'vllm-deep' | 'vllm-pool' | string;
  endpoint: string;
  baseModel: string;
  capabilities: string[];
  status: 'active' | 'degraded' | 'disabled';
};

type ExpandedModelProfileHealth = {
  modelProfileId: string;
  availability: 'available' | 'degraded' | 'unavailable';
  quarantineState: 'clear' | 'active';
  healthy: boolean | null;
  errorRate: number | null;
  latencyMsP95: number | null;
  checkedAt: string;
};

type ExpandedFallbackLink = {
  modelProfileId: string;
  fallbackTargetProfileId: string | null;
  linkKind: 'predecessor' | 'degraded_fallback';
  allowed: boolean;
  reason: string;
};

type OperatorRicherRegistryHealthSummary = {
  available: boolean;
  owner: 'F-0014';
  generatedAt: string | null;
  organs: Array<{
    modelProfileId: string;
    role: ExpandedModelRole;
    serviceId: string;
    availability: ExpandedModelProfileHealth['availability'];
    quarantineState: ExpandedModelProfileHealth['quarantineState'];
    fallbackTargetProfileId: string | null;
    errorRate: number | null;
    latencyMsP95: number | null;
  }>;
};

type ModelOrganHealthReportInput = {
  generatedAt: string;
  profiles: Array<{
    modelProfileId: string;
    role: ExpandedModelRole;
    serviceId: string;
    availability: ExpandedModelProfileHealth['availability'];
    quarantineState: ExpandedModelProfileHealth['quarantineState'];
    fallbackTargetProfileId: string | null;
    errorRate: number | null;
    latencyMsP95: number | null;
  }>;
};
```
- `OperatorRicherRegistryHealthSummary` is source-owned by `F-0014` but route-owned by `F-0013` as a bounded projection.
- `ModelOrganHealthReportInput` is source-owned by `F-0014` but report-owned by `CF-015`.

### 5.2 Runtime and deployment surface

- The seam lives inside the existing `core` monolith and the delivered deployment cell from `F-0002`.
- Additional local services such as `vllm-deep` and `vllm-pool` remain optional runtime dependencies until separately promoted by platform/constitution owners.
- `F-0008` remains the owner of baseline routing invariants, baseline rows in `model_registry` and continuity pointers; `F-0014` extends richer registry source state that the router and `/models` projection may read.
- `F-0013` remains the only owner of operator-facing `/models`; `F-0014` supplies the richer source diagnostics that route may later publish.
- `CF-015` remains the only owner of derived reporting/read models and must materialize `model organ health reports` from `F-0014` source surfaces plus delivered baseline diagnostics.

### 5.3 Data model changes

- This seam extends the existing `model_registry` family and adds explicit companion source surfaces; it does **not** create a second shadow registry.
- Logical writer split is fixed as:
  - `F-0008`: baseline rows in `model_registry` where role is `reflex` / `deliberation` / `reflection`, plus `ticks.selected_model_profile_id` and `agent_state.current_model_profile_id`;
  - `F-0014`: richer rows in `model_registry` where role is `code` / `embedding` / `reranker` / `classifier` / `safety`, plus explicit companion source surfaces for runtime health and fallback links.
- Canonical source surfaces for this dossier are:
  - `model_registry` richer-role slice
  - `model_profile_health`
  - `model_fallback_links`
- `model_profile_health` must minimally preserve:
  - `model_profile_id`
  - `service_id`
  - `availability`
  - `quarantine_state`
  - `healthy`
  - `error_rate`
  - `latency_ms_p95`
  - `checked_at`
  - `source_json`
- `model_fallback_links` must minimally preserve:
  - `model_profile_id`
  - `fallback_target_profile_id`
  - `link_kind`
  - `allowed`
  - `reason`
  - `updated_at`
- `CF-015` later derives `model_health_reports` from these source surfaces and from delivered baseline diagnostics; that derived read model is explicitly outside `F-0014`.

### 5.4 Edge cases and failure modes

- Optional service absent at boot: richer registry surfaces mark it unavailable without turning startup into a hidden hard failure.
- Organ degraded or quarantined: fallback chain must stay explicit and auditable; silent remap is forbidden, and missing fallback target must stay explicit rather than degrading into baseline remap.
- Downstream `/models` publication lagging behind richer registry delivery: richer source diagnostics must still exist canonically even if the operator route temporarily exposes only a bounded subset or an unavailable placeholder.
- `CF-015` not yet delivered: Homeostat stays indirect and may only consume derived report surfaces once that seam exists; `F-0014` must not turn itself into an ad hoc reporting seam to compensate.
- Requests for unsupported specialist capabilities before `CF-019`: must stay explicit refusal or future-owned unavailable state, not improvised specialist routing.

### 5.5 Verification surface

- Expected verification includes contract coverage for registry/health/fallback shapes, integration coverage with baseline router consumers, bounded `/models` projection inputs, explicit unavailable/degraded paths for optional organs, and source-vs-report ownership separation.
- Because this seam may touch runtime model-service wiring and deployment-cell posture, the container smoke path is expected once implementation materially changes startup or runtime behavior.

## 6. Definition of Done

- `F-0014` is the canonical owner of richer model ecology source state, bounded source diagnostics and explicit fallback/quarantine metadata beyond the baseline router slice.
- Additional organ families are represented in canonical registry/health surfaces without silently changing the required boot dependency set.
- `F-0013`, `CF-015`, `F-0012`, `F-0015` and `CF-019` boundaries remain explicit and aligned.
- The baseline router invariants from `F-0008` stay intact and are not reopened by richer ecology delivery.
- The existing `model_registry` family is extended through an explicit logical owner split and companion source surfaces rather than a second shadow registry or under-specified JSON drift.
- Architecture, backlog and SSOT index all point to this dossier as the canonical owner of expanded model ecology and registry health.

## 7. Slicing plan

### Slice SL-F0014-01: Expanded registry contract and optional organ catalog
Delivers: canonical richer registry shape for optional organ families, capability metadata and explicit operational status without changing baseline boot requirements.
Covers: AC-F0014-01, AC-F0014-02, AC-F0014-05
Verification: `packages/contracts/test/models/expanded-registry.contract.test.ts`, `packages/db/test/models/expanded-registry-store.integration.test.ts`, `packages/db/test/models/registry-surface-split.integration.test.ts`
Exit criteria:
- Richer non-baseline profiles persist through one canonical contract/store path without introducing a shadow registry or widening baseline writer authority.
- Optional organ families expose explicit capability, service identity and availability metadata before any runtime consumer attempts to route through them.
- Registry reads needed by neighbouring seams can distinguish baseline-role rows from richer-role rows through explicit adapter/store boundaries instead of ad hoc role filtering.

### Slice SL-F0014-02: Source diagnostics for operator projection and reporting input
Delivers: canonical richer source diagnostics for bounded `/models` projection and explicit report input contract for future `CF-015`, plus the linked realignment of the already delivered `F-0013` `/models` boundary onto a bounded `F-0014` source adapter.
Covers: AC-F0014-01, AC-F0014-03, AC-F0014-06, AC-F0014-07
Verification: `apps/core/test/models/registry-health.integration.test.ts`, `apps/core/test/models/ownership-boundary.contract.test.ts`, `apps/core/test/platform/operator-models.integration.test.ts`
Exit criteria:
- Richer source diagnostics are materialized canonically even when `F-0013` still publishes only a bounded subset of them.
- The delivered `/models` route in `F-0013` reads richer summaries only through an explicit `F-0014` adapter and never reaches into raw source tables.
- `F-0012` remains an indirect consumer through `CF-015` report inputs only; this slice does not create a direct Homeostat read path over richer source state.

### Slice SL-F0014-03: Explicit fallback and quarantine policy
Delivers: durable fallback/quarantine semantics that extend richer ecology while preserving baseline structured refusal and `selection != admission`.
Covers: AC-F0014-04, AC-F0014-05, AC-F0014-06, AC-F0014-07
Verification: `apps/core/test/models/richer-fallback.contract.test.ts`, `apps/core/test/models/ownership-boundary.contract.test.ts`, `apps/core/test/runtime/model-router.integration.test.ts`
Exit criteria:
- Fallback and quarantine links are durable, explicit and auditable rather than inferred from incidental runtime heuristics.
- Baseline router invariants remain unchanged: unsupported richer roles still fail explicitly, and richer fallback cannot silently collapse into baseline remap.
- The already delivered `F-0008` selection/read path is realigned to coexist with richer rows in one physical registry family without seizing ownership of those richer rows.

### Slice SL-F0014-04: Runtime/deployment closure for optional organ services
Delivers: optional service wiring, degraded/unavailable startup semantics and final runtime/smoke closure when richer services affect runtime posture.
Covers: AC-F0014-02, AC-F0014-03, AC-F0014-05
Verification: `apps/core/test/models/optional-organs.integration.test.ts`, `apps/core/test/models/registry-health.integration.test.ts`, `infra/docker/deployment-cell.smoke.ts`
Exit criteria:
- Optional richer services can be present, absent or degraded without silently joining the required boot dependency set.
- Runtime wiring and health adapters emit the same richer availability/quarantine shape used by the canonical source-diagnostics contract.
- If startup/runtime posture changes, deployment-cell smoke proves the richer ecology remains optional and bounded on the canonical container path.

## 8. Task list

- **T-F0014-01:** Define the canonical richer registry shape and metadata boundary for optional organ families in `SL-F0014-01`. Covers: AC-F0014-01, AC-F0014-02.
- **T-F0014-02:** Align persistent storage for richer registry state without creating a shadow registry in `SL-F0014-01`. Covers: AC-F0014-01, AC-F0014-02.
- **T-F0014-03:** Define the bounded richer source-diagnostics contract for `F-0013` and the separate report-input contract for `CF-015` in `SL-F0014-02`. Covers: AC-F0014-03, AC-F0014-06.
- **T-F0014-04:** Add degraded/unavailable semantics for absent optional services and prove Homeostat remains an indirect `CF-015` consumer in `SL-F0014-02`. Covers: AC-F0014-03, AC-F0014-05, AC-F0014-06.
- **T-F0014-05:** Define explicit fallback-chain and quarantine semantics in `SL-F0014-03`. Covers: AC-F0014-04, AC-F0014-05, AC-F0014-07.
- **T-F0014-06:** Prove baseline invariants and the logical owner split remain intact while richer ecology is introduced in `SL-F0014-03`. Covers: AC-F0014-04, AC-F0014-06, AC-F0014-07.
- **T-F0014-07:** Wire optional richer services into canonical runtime/deployment paths without making them mandatory in `SL-F0014-04`. Covers: AC-F0014-02, AC-F0014-05.
- **T-F0014-08:** Add final runtime and conditional smoke verification for richer ecology delivery in `SL-F0014-04`. Covers: AC-F0014-03, AC-F0014-05.
- **T-F0014-09:** Realign the delivered `F-0013` `/models` publication path and its AC-linked tests onto the bounded `SL-F0014-02` richer source adapter, without transferring route ownership. Covers: AC-F0014-03, AC-F0014-06.
- **T-F0014-10:** Realign the delivered `F-0008` baseline registry readers and selection assumptions to coexist with the `SL-F0014-03` richer-role slice inside one physical `model_registry` family. Covers: AC-F0014-04, AC-F0014-07.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0014-01 | `packages/contracts/test/models/expanded-registry.contract.test.ts` → `test("AC-F0014-01 expanded registry is the only canonical richer-model owner surface")` | done |
| AC-F0014-02 | `packages/db/test/models/expanded-registry-store.integration.test.ts` → `test("AC-F0014-02 richer organ families persist explicit capability and status metadata without replacing baseline ownership")` | done |
| AC-F0014-03 | `apps/core/test/models/registry-health.integration.test.ts` → `test("AC-F0014-03 richer source diagnostics feed bounded operator projection and CF-015 report input without creating shadow state")`; `infra/docker/deployment-cell.smoke.ts` → bounded `/models` deployment-cell projection `// Covers: AC-F0014-03` | done |
| AC-F0014-04 | `apps/core/test/models/richer-fallback.contract.test.ts` → `test("AC-F0014-04 richer fallback preserves explicit reflection, structured refusal and selection-admission separation")`; `apps/core/test/models/model-router.integration.test.ts` → richer-row coexistence in the shared registry family `// Covers: AC-F0014-04` | done |
| AC-F0014-05 | `apps/core/test/models/optional-organs.integration.test.ts` → `test("AC-F0014-05 optional richer organs degrade explicitly without becoming hidden boot-critical dependencies")`; `infra/docker/deployment-cell.smoke.ts` → bounded unavailable richer-organ summary in the canonical container path `// Covers: AC-F0014-05` | done |
| AC-F0014-06 | `apps/core/test/models/ownership-boundary.contract.test.ts` → `test("AC-F0014-06 richer model ecology stays separate from operator publication, CF-015 reporting, homeostat consumption and specialist lifecycle policy")`; `apps/core/test/platform/operator-models.integration.test.ts` → bounded `F-0013` projection over `F-0014` source state `// Covers: AC-F0014-06` | done |
| AC-F0014-07 | `packages/db/test/models/registry-surface-split.integration.test.ts` → `test("AC-F0014-07 richer registry source state extends the model_registry family without a shadow registry")` | done |

## 10. Decision log (ADR blocks)

### ADR-F0014-01: Richer ecology may extend baseline routing inputs, but may not reopen baseline routing invariants
- Status: Accepted
- Date: 2026-03-25
- Context: `F-0008` already delivered explicit baseline router invariants for `reflection`, structured refusal and `selection != admission`. Expanded ecology needs richer health/fallback metadata, but without a hard boundary it would be easy to re-litigate those baseline decisions inside phase-2 registry work.
- Decision: `F-0014` may add richer registry, health, quarantine and fallback metadata, but any such extension must preserve the already delivered baseline invariants from `F-0008` and `F-0003`. If a future feature genuinely needs to revisit those invariants, it must do so through an explicit change-proposal against the owning dossiers.
- Alternatives: Re-open baseline router policy inside `F-0014`; defer all richer fallback/health semantics until specialist organ delivery.
- Consequences: `F-0014` gets a clear owner boundary and downstream consumers can rely on richer diagnostics without treating phase-2 ecology as a backdoor rewrite of baseline routing policy.

### ADR-F0014-02: `F-0014` owns richer source diagnostics, while `CF-015` owns derived health reports
- Status: Accepted
- Date: 2026-03-25
- Context: Intake wording was too broad and implied that `F-0014` itself might become the canonical read-only health/reporting seam for both operator and Homeostat consumers. But architecture and backlog already fix `CF-015` as the owner of derived `model organ health reports`, while `F-0013` owns `/models` publication and `F-0012` must not read raw source state directly.
- Decision: `F-0014` owns richer registry source state and bounded source diagnostics only. `F-0013` projects a bounded operator summary over that source state, and `CF-015` later materializes canonical read-only reports from it. `F-0012` continues to consume only the `CF-015` reports for `organ_error_rate`.
- Alternatives: Let `F-0014` own final reports; let Homeostat read raw richer model-health source state directly.
- Consequences: Reporting, operator publication and richer model ecology remain separate seams, and the implementation gets one explicit source-to-projection chain instead of overlapping health owners.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> done`
- Candidate source: `CF-010`
- Delivered prerequisites: `F-0002`, `F-0008`, `F-0013`
- Code:
  - `apps/core/src/platform/core-config.ts`
  - `apps/core/src/platform/core-runtime.ts`
  - `apps/core/src/platform/operator-api.ts`
  - `apps/core/src/runtime/model-ecology.ts`
  - `apps/core/src/runtime/model-router.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/test/models/model-router.integration.test.ts`
  - `apps/core/test/models/optional-organs.integration.test.ts`
  - `apps/core/test/models/ownership-boundary.contract.test.ts`
  - `apps/core/test/models/registry-health.integration.test.ts`
  - `apps/core/test/models/richer-fallback.contract.test.ts`
  - `apps/core/test/platform/operator-models.integration.test.ts`
  - `apps/core/test/runtime/health.integration.test.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/009_expanded_model_ecology.sql`
  - `packages/contracts/src/models.ts`
  - `packages/contracts/test/models/expanded-registry.contract.test.ts`
  - `packages/db/src/model-ecology.ts`
  - `packages/db/src/model-routing.ts`
  - `packages/db/test/models/expanded-registry-store.integration.test.ts`
  - `packages/db/test/models/registry-surface-split.integration.test.ts`
  - `packages/db/testing/subject-state-db-harness.ts`
- Verification:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `pnpm debt:audit:changed`
  - `node scripts/dossier.mjs index-refresh`
  - `node scripts/dossier.mjs lint-dossiers`
  - `node scripts/dossier.mjs coverage-audit --dossier docs/features/F-0014-expanded-model-ecology-and-registry-health.md --orphans-scope=dossier`
  - `node scripts/dossier.mjs contract-drift-audit --dossier docs/features/F-0014-expanded-model-ecology-and-registry-health.md --base HEAD~1`
  - `node scripts/dossier.mjs contract-drift-audit --dossier docs/features/F-0008-baseline-model-router-and-organ-profiles.md --base HEAD~1`
  - `node scripts/dossier.mjs contract-drift-audit --dossier docs/features/F-0013-operator-http-api-and-introspection.md --base HEAD~1`
- Issue: none
- PRs: none
- Process artifacts:
  - `.dossier/verification/F-0014/...`
  - `.dossier/reviews/F-0014/...`
  - `.dossier/steps/F-0014/...`

## 12. Change log

- **v1.0 (2026-03-25):** Initial dossier created from `CF-010`; intake fixes one canonical owner for expanded model ecology, richer registry health and explicit fallback/quarantine metadata while keeping baseline router invariants with `F-0008`, operator publication with `F-0013`, Homeostat consumption with `F-0012`, workshop lifecycle with `CF-011` and specialist rollout with `CF-019`.
- **v1.1 (2026-03-25):** `spec-compact`: tightened the seam into a decision-complete shaped spec. `F-0014` now owns richer source state and bounded source diagnostics rather than final reports, baseline-vs-expanded registry ownership is split explicitly, `CF-015` remains the report owner, and `F-0013` future `/models` projection is realigned onto `F-0014` as its richer source seam.
- **v1.2 (2026-03-25):** `plan-slice`: moved the dossier to `planned`, turned the four delivery slices into implementation-ready waves with explicit verification artifacts and exit criteria, and made the required realignment of delivered `F-0008`/`F-0013` code paths explicit as linked tasks instead of hidden follow-up debt.
- **v1.3 (2026-03-25):** `implementation`: delivered the richer registry source surfaces on the canonical runtime path. `model_registry` now carries explicit `service_id` continuity for baseline and richer rows, companion source tables `model_profile_health` and `model_fallback_links` are live, `vllm-deep` / `vllm-pool` probe into bounded unavailable/degraded source diagnostics without becoming boot-critical, `F-0013` `/models` now projects the bounded `F-0014` richer summary, and container smoke proves the new richer organs remain optional on the deployment-cell path.
