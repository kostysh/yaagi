---
id: F-0014
title: Расширенная модельная экология и здоровье реестра
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: models
depends_on: [F-0002, F-0008]
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
- **Goal:** Зафиксировать один canonical owner для expanded model ecology beyond baseline `vllm-fast`: feature должна владеть richer registry/health/fallback surfaces для `vllm-deep`, `vllm-pool`, `embedding`, `reranker` и смежных shared organ capabilities, поставлять canonical read-only health surfaces для `F-0013` и `F-0012`, и при этом расширять уже delivered baseline router invariants вместо их переоткрытия.
- **Non-goals:** Workshop training/eval/promotion pipeline, specialist organ birth/retirement, operator route ownership, baseline `GET /health` ownership, baseline `reflection` policy and direct governor/development execution не входят в этот intake.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0002` deployment cell and local model substrate, `F-0008` baseline model router and `F-0013` bounded operator introspection route family. `F-0012` already expects richer read-only organ health surfaces later for `organ_error_rate`; this dossier becomes the canonical owner of those future model-health inputs instead of leaving them implied.

## 2. Scope

### In scope

- Canonical owner for expanded organ/profile registry beyond the baseline slice from `F-0008`.
- Registry and health ownership for optional phase-2 local organs and shared model services such as:
  - `vllm-deep`
  - `vllm-pool`
  - `embedding`
  - `reranker`
- Canonical read-only organ/profile health surfaces for downstream consumers:
  - `F-0013` operator `/models`
  - `F-0012` homeostat `organ_error_rate`
  - later reporting seams
- Explicit quarantine, fallback-chain and eligibility semantics for richer organ ecology that extend the baseline router contract without changing its already delivered invariants.
- Canonical metadata for richer profiles/capabilities, including organ kind, endpoint/service identity, declared capabilities, health summary, fallback predecessor and operational status.

### Out of scope

- Reopening already delivered baseline router invariants from `F-0008`, including explicit `reflection` policy, structured refusal and separation of `selection` from tick `admission`.
- Ownership of operator HTTP routes such as `GET /models`; that remains `F-0013`.
- Workshop datasets/training/eval/promotion and candidate-model lifecycle; those remain `CF-011`.
- Specialist organ rollout, staged promotion, retirement policy and specialist birth governance; those remain `CF-019`.
- Governor policy writes, freeze/development proposals or direct human-override logic; those remain `CF-016` and later safety/governance seams.
- Silent promotion of new boot-required dependencies beyond the constitution/platform owners.

### Constraints

- `F-0014` extends the delivered baseline router contract; it must not weaken or replace the explicit-only `reflection` path, structured refusal semantics or the `selection != admission` rule already owned by `F-0008` and `F-0003`.
- Additional organs/services remain optional until constitution/platform owners explicitly elevate them into the required boot dependency set. This seam may not silently make `vllm-deep`, `vllm-pool`, `embedding` or `reranker` mandatory at startup.
- `F-0014` owns richer registry and health surfaces only. It must not become a convenience writer for `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `action_log`, `development_ledger`, narrative/memetic tables or operator/governor route state.
- Downstream read models for `/models`, Homeostat and future reports must stay bounded, machine-readable and owner-shaped. Raw table dumps, ad hoc JSON blobs and hidden proxy metrics are forbidden.
- Fallback and quarantine behavior must be explicit in durable registry/health surfaces. Unsupported or policy-forbidden role requests must still resolve via explicit refusal rather than silent remap.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0014-01:** `F-0014` establishes one canonical owner seam for expanded model ecology beyond the baseline `F-0008` slice: richer organ/profile registry, health status, quarantine/fallback metadata and read-only diagnostics are no longer allowed to live ad hoc in router handlers, operator route code or reporting helpers.
- **AC-F0014-02:** The canonical registry surface covers the phase-2 optional organ families named by the backlog (`vllm-deep`, `vllm-pool`, `embedding`, `reranker`) with explicit metadata for organ kind, service/endpoint identity, declared capabilities, operational status, fallback predecessor and health summary; baseline `vllm-fast` and first baseline profile ownership remain with the already delivered `F-0002` / `F-0008` contracts.
- **AC-F0014-03:** `F-0014` defines one canonical read-only health contract for richer organ/profile diagnostics that downstream seams may consume without copying or inventing shadow state: at minimum it exposes machine-readable availability, degradation/quarantine state, error-rate/latency posture and fallback readiness per organ/profile for `F-0013`, `F-0012` and future reporting owners.
- **AC-F0014-04:** Expanded fallback and quarantine semantics extend, but do not reopen, the baseline router invariants: explicit `reflection` handling, structured refusal for unsupported roles/capabilities and the separation between model selection and tick admission remain intact; richer ecology may add declared fallback chains and quarantine evidence, but it may not introduce hidden silent fallback.
- **AC-F0014-05:** Optional phase-2 organ services degrade gracefully when absent or unhealthy: missing `vllm-deep`, `vllm-pool`, `embedding` or `reranker` surfaces must appear as explicit unavailable/degraded registry-health state rather than startup-critical hidden dependencies or fabricated healthy profiles.
- **AC-F0014-06:** Ownership boundaries remain explicit after intake: `F-0014` owns richer model-registry and health surfaces, `F-0013` stays owner of operator HTTP publication, `F-0012` stays a read-only consumer of `organ_error_rate` inputs, `CF-011` stays owner of workshop/promotion, and `CF-019` stays owner of specialist lifecycle policy.

## 4. Non-functional requirements (NFR)

- **Determinism:** The same registry state and the same health evidence must produce the same availability/fallback view for downstream consumers.
- **Operational clarity:** Optional organ absence or degradation must be represented explicitly and readably, not by silent remap or hidden startup behavior.
- **Phase discipline:** This seam must not smuggle in workshop, specialist rollout or operator-route ownership under the pretext of “richer model support”.
- **Auditability:** Quarantine/fallback decisions and health summaries must stay attributable to canonical registry/health surfaces rather than opaque helper heuristics.
- **Boot safety:** Expanded ecology must not silently enlarge the required boot dependency set.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0014` does not own a new public HTTP route family. Public publication of richer model diagnostics remains bounded by `F-0013`.
- The seam owns internal contracts for:
  - `ExpandedModelProfile`
  - `ExpandedRegistryHealthSnapshot`
  - `ExpandedFallbackPolicy`
- Downstream consumers read these contracts only through canonical owner adapters; they do not mutate richer registry or health state directly.

### 5.2 Runtime and deployment surface

- The seam lives inside the existing `core` monolith and the delivered deployment cell from `F-0002`.
- Additional local services such as `vllm-deep` and `vllm-pool` remain optional runtime dependencies until separately promoted by platform/constitution owners.
- `F-0008` remains the owner of baseline routing invariants; `F-0014` extends registry and health inputs that the router and `/models` projection may read.
- `F-0013` remains the only owner of operator-facing `/models`; `F-0014` supplies the richer canonical diagnostics that route may later publish.

### 5.3 Data model changes

- This seam is expected to extend the existing `model_registry` family or adjacent owner-owned tables rather than creating shadow registries.
- Canonical richer-model data must cover:
  - organ/service identity
  - profile/capability metadata
  - operational status
  - health/error/latency posture
  - quarantine state
  - fallback predecessor/successor metadata
- Exact schema split, indexing and retention policy are deferred to `spec-compact`.

### 5.4 Edge cases and failure modes

- Optional service absent at boot: richer registry surfaces mark it unavailable without turning startup into a hidden hard failure.
- Organ degraded or quarantined: fallback chain must stay explicit and auditable; silent remap is forbidden.
- Downstream `/models` publication lagging behind richer registry delivery: richer diagnostics must still exist canonically even if the operator route temporarily exposes only a bounded subset.
- Requests for unsupported specialist capabilities before `CF-019`: must stay explicit refusal or future-owned unavailable state, not improvised specialist routing.

### 5.5 Verification surface

- Expected verification includes contract coverage for registry/health/fallback shapes, integration coverage with baseline router consumers, explicit unavailable/degraded paths for optional organs, and smoke verification if runtime/deployment behavior changes.
- Because this seam may touch runtime model-service wiring and deployment-cell posture, the container smoke path is expected once implementation materially changes startup or runtime behavior.

## 6. Definition of Done

- `F-0014` is the canonical owner of richer model ecology, registry health and explicit fallback/quarantine metadata beyond the baseline router slice.
- Additional organ families are represented in canonical registry/health surfaces without silently changing the required boot dependency set.
- `F-0013`, `F-0012`, `CF-011` and `CF-019` boundaries remain explicit and aligned.
- The baseline router invariants from `F-0008` stay intact and are not reopened by richer ecology delivery.
- Architecture, backlog and SSOT index all point to this dossier as the canonical owner of expanded model ecology and registry health.

## 7. Slicing plan

### Slice SL-F0014-01: Expanded registry contract and optional organ catalog
Delivers: canonical richer registry shape for optional organ families, capability metadata and explicit operational status without changing baseline boot requirements.
Covers: AC-F0014-01, AC-F0014-02, AC-F0014-05
Verification: `contract`, `db`

### Slice SL-F0014-02: Richer health read model for operator and Homeostat consumers
Delivers: canonical read-only health surfaces for richer organs/profiles and bounded consumer adapters for `/models` and `organ_error_rate`.
Covers: AC-F0014-01, AC-F0014-03, AC-F0014-06
Verification: `contract`, `integration`

### Slice SL-F0014-03: Explicit fallback and quarantine policy
Delivers: durable fallback/quarantine semantics that extend richer ecology while preserving baseline structured refusal and `selection != admission`.
Covers: AC-F0014-04, AC-F0014-05, AC-F0014-06
Verification: `contract`, `integration`

### Slice SL-F0014-04: Runtime/deployment closure for optional organ services
Delivers: optional service wiring, degraded/unavailable startup semantics and final runtime/smoke closure when richer services affect runtime posture.
Covers: AC-F0014-02, AC-F0014-03, AC-F0014-05
Verification: `integration`, `smoke-if-runtime-path-changes`

## 8. Task list

- **T-F0014-01:** Define the canonical richer registry shape and metadata boundary for optional organ families in `SL-F0014-01`. Covers: AC-F0014-01, AC-F0014-02.
- **T-F0014-02:** Align persistent storage for richer registry state without creating a shadow registry in `SL-F0014-01`. Covers: AC-F0014-01, AC-F0014-02.
- **T-F0014-03:** Define the read-only richer health contract and consumer adapters for `F-0013` / `F-0012` in `SL-F0014-02`. Covers: AC-F0014-03, AC-F0014-06.
- **T-F0014-04:** Add degraded/unavailable semantics for absent optional services in `SL-F0014-02`. Covers: AC-F0014-03, AC-F0014-05.
- **T-F0014-05:** Define explicit fallback-chain and quarantine semantics in `SL-F0014-03`. Covers: AC-F0014-04, AC-F0014-05.
- **T-F0014-06:** Prove baseline invariants remain intact while richer ecology is introduced in `SL-F0014-03`. Covers: AC-F0014-04, AC-F0014-06.
- **T-F0014-07:** Wire optional richer services into canonical runtime/deployment paths without making them mandatory in `SL-F0014-04`. Covers: AC-F0014-02, AC-F0014-05.
- **T-F0014-08:** Add final runtime and conditional smoke verification for richer ecology delivery in `SL-F0014-04`. Covers: AC-F0014-03, AC-F0014-05.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0014-01 | `packages/contracts/test/models/expanded-registry.contract.test.ts` → `test("AC-F0014-01 expanded registry is the only canonical richer-model owner surface")` | planned |
| AC-F0014-02 | `packages/db/test/models/expanded-registry-store.integration.test.ts` → `test("AC-F0014-02 richer organ families persist explicit capability and status metadata without replacing baseline ownership")` | planned |
| AC-F0014-03 | `apps/core/test/models/registry-health.integration.test.ts` → `test("AC-F0014-03 richer registry health is exposed as a canonical read-only surface for operator and homeostat consumers")` | planned |
| AC-F0014-04 | `apps/core/test/models/richer-fallback.contract.test.ts` → `test("AC-F0014-04 richer fallback preserves explicit reflection, structured refusal and selection-admission separation")` | planned |
| AC-F0014-05 | `apps/core/test/models/optional-organs.integration.test.ts` → `test("AC-F0014-05 optional richer organs degrade explicitly without becoming hidden boot-critical dependencies")` | planned |
| AC-F0014-06 | `apps/core/test/models/ownership-boundary.contract.test.ts` → `test("AC-F0014-06 richer model ecology stays separate from operator publication, homeostat ownership and specialist lifecycle policy")` | planned |

## 10. Decision log (ADR blocks)

### ADR-F0014-01: Richer ecology may extend baseline routing inputs, but may not reopen baseline routing invariants
- Status: Accepted
- Date: 2026-03-25
- Context: `F-0008` already delivered explicit baseline router invariants for `reflection`, structured refusal and `selection != admission`. Expanded ecology needs richer health/fallback metadata, but without a hard boundary it would be easy to re-litigate those baseline decisions inside phase-2 registry work.
- Decision: `F-0014` may add richer registry, health, quarantine and fallback metadata, but any such extension must preserve the already delivered baseline invariants from `F-0008` and `F-0003`. If a future feature genuinely needs to revisit those invariants, it must do so through an explicit change-proposal against the owning dossiers.
- Alternatives: Re-open baseline router policy inside `F-0014`; defer all richer fallback/health semantics until specialist organ delivery.
- Consequences: `F-0014` gets a clear owner boundary and downstream consumers can rely on richer diagnostics without treating phase-2 ecology as a backdoor rewrite of baseline routing policy.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue: none
- PRs: none
- Process artifacts:
  - `.dossier/verification/F-0014/...`
  - `.dossier/reviews/F-0014/...`
  - `.dossier/steps/F-0014/...`

## 12. Change log

- **v1.0 (2026-03-25):** Initial dossier created from `CF-010`; intake fixes one canonical owner for expanded model ecology, richer registry health and explicit fallback/quarantine metadata while keeping baseline router invariants with `F-0008`, operator publication with `F-0013`, Homeostat consumption with `F-0012`, workshop lifecycle with `CF-011` and specialist rollout with `CF-019`.
