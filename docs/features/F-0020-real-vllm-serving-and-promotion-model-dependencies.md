---
id: F-0020
title: Реальный vLLM-serving и promotion model dependencies
status: shaped
coverage_gate: deferred
owners: ["@codex"]
area: models
depends_on: ["F-0002", "F-0008", "F-0014"]
impacts: ["runtime", "infra", "models", "artifacts", "workshop"]
created: 2026-04-16
updated: 2026-04-16
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-023
  - Backlog delivery state at intake: planned
  - Canonical backlog read used for intake:
    - `backlog-engineer status`
    - `backlog-engineer queue`
    - `backlog-engineer items --item-keys "CF-023,CF-013,CF-024"`
  - Supporting source traceability:
    - ../architecture/system.md
    - ../polyphony_concept.md
    - ../backlog/feature-candidates.md
    - ../backlog/local-vllm-model-shortlist-2026-03-24.md
    - ../backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-020
    - CF-006
    - CF-010
  - Intake reconciliation note:
    - Legacy backlog planning documents still preserve broader historical variants of this seam, including fast-first slicing context and older dependency narratives.
    - For this intake, canonical backlog truth comes from the current `backlog-engineer` read surface and is recorded as `delivery_state=planned`, dependencies `CF-020`, `CF-006`, `CF-010`, no blockers.
    - No backlog actualization was applied during intake because the intake did not establish a new canonical dependency set beyond the current `backlog-engineer` state.
- **User problem:** После `F-0002`, `F-0008` и `F-0014` репозиторий уже имеет canonical deployment cell, baseline organ routing и richer registry/health surfaces, но всё ещё не имеет отдельного owner seam для реального local-model serving. Пока `vllm-fast` допускается как stub-capable continuity slot, система не может честно утверждать, что phase-0 local-model runtime уже доказан через настоящий containerized inference path, а workshop/promotion surfaces остаются привязанными к registry metadata без live-serving substrate.
- **Goal:** Зафиксировать один canonical owner seam для реального `vLLM` serving: feature должна владеть fast-first заменой phase-0 `vllm-fast` stub на настоящий containerized inference path, правилами materialization для model artifacts/weights, service-specific health/readiness surface, Docker/ROCm serving posture, smoke-proven inference over canonical container path и явным правилом, когда `vllm-deep` / `vllm-pool` остаются optional diagnostics from `F-0014`, а когда становятся promoted runtime dependencies.
- **Non-goals:** Полный workshop lifecycle и candidate/promotion governance, specialist rollout/retirement policy, operator-facing auth/RBAC, deploy/release automation, richer operator reporting и reopening baseline router ownership из `F-0008` не входят в этот intake.
- **Current substrate / baseline:** `F-0002` уже закрепил canonical phase-0 deployment cell `core + postgres + vllm-fast` и допускает stub-capable continuity для `vllm-fast` до отдельного model-serving seam. `F-0008` already owns baseline profile/routing invariants for `reflex` / `deliberation` / `reflection`, `F-0014` уже поставил richer registry/health/fallback source state for `vllm-deep` / `vllm-pool`, а архитектура фиксирует `vllm-fast`, `vllm-deep`, `vllm-pool` как external local organs и separate artifact/weights surfaces under `/models/*`. Repo-level model bridge остаётся `AI SDK + @ai-sdk/openai-compatible`.

### Terms & thresholds

- **Stub-capable continuity slot:** service name and protocol wiring for `vllm-fast` preserved from `F-0002`, but without a proof that the slot serves a real model.
- **Real-serving path:** a local organ is considered real-serving only when the canonical container path can execute at least one actual inference request against a real model artifact, not a synthetic stub or fabricated response path.
- **Promoted runtime dependency:** a local organ whose absence or unusable state must fail closed at startup or before the owner flow is admitted.
- **Actual model artifact:** the descriptor plus runtime-resolvable weights/manifests that back the live serving process; registry metadata alone does not count as an artifact.
- **Fast-first:** the first mandatory slice of this seam is the real `vllm-fast` path; no later deep/pool expansion may substitute for that proof.

## 2. Scope

### In scope

- Canonical owner for replacing the phase-0 stub-capable `vllm-fast` continuity slot with real `vLLM` inference over the canonical deployment-cell path.
- Explicit fast-first slice: one real `vllm-fast` organ must be live and smoke-proven before any claim about a real local-model runtime is accepted.
- Materialization contract for model artifacts, manifests and weights across `/seed/models`, `/models/base`, `/models/adapters` and later specialist surfaces, without turning tracked seed content into cached-weight storage.
- Service-specific health/readiness probes and bounded failure semantics for real local model services on the canonical container path.
- Serving/posture decisions for Docker and hardware/runtime assumptions needed by real local inference, including the shape of the serving path for `vllm-fast` and the boundary to later `vllm-deep` / `vllm-pool` promotion.
- Promotion of serving reality into boot/runtime assumptions where architecture and constitution currently still rely on registry-level or stub-capable continuity.

### Out of scope

- Reopening baseline deployment-cell ownership from `F-0002` beyond the model-serving seam that it intentionally left stub-capable.
- Reopening baseline routing semantics, profile selection rules or operator `/models` publication ownership from `F-0008` / `F-0014`.
- Dataset construction, training runs, eval suites, candidate lifecycle and workshop-owned promotion-package semantics from `F-0015`.
- Specialist organ rollout, staged activation, retirement policy and specialist-specific governance from `CF-019`.
- Public auth/authz, release automation, rollback orchestration and mature support/reporting seams from `CF-024`, `CF-025`, `CF-026` and `CF-015`.
- Any fake provider, emulator, simulator, synthetic response path or placeholder-only health proof being counted as seam closure.

### Constraints

- `vllm-fast` service name and OpenAI-compatible protocol continuity from `ADR-2026-03-19 Phase-0 Deployment Cell` must be preserved.
- The model-integration substrate remains `AI SDK + @ai-sdk/openai-compatible`; this seam may not invent a framework-owned or ad hoc provider layer.
- LLM inference stays outside `polyphony-core`; model servers are cognitive organs, not identity-bearing runtime owners.
- `/seed/models` may contain only tiny bootstrap descriptors/manifests; cached weights and mutable runtime model assets belong under writable `/models/*` surfaces.
- No stub, emulator or fabricated response path may count toward closure of this seam or any later working-system claim derived from it.
- `vllm-deep` and `vllm-pool` may remain optional until this seam explicitly defines the promotion rule that turns them from richer diagnostics into required runtime dependencies.
- Fast-first closure must happen before downstream seams reinterpret the repository as having a real local-model runtime.

### Assumptions (optional)

- The current repository state still matches the canonical backlog reading captured at intake: `CF-023` remains backlog-selected and still carries `delivery_state=planned` until this `spec-compact` cycle actualizes it.
- The first implementation slice should target one canonical real `vllm-fast` path before any deep/pool expansion.
- Existing richer registry/health surfaces from `F-0014` will be consumed and refined by this seam rather than replaced.

### Open questions (optional)

- Which exact model family and artifact source become the canonical fast-first `vllm-fast` baseline for this repo?
- Does `F-0020` own both the fast-first and deep/pool serving slices in one dossier, or should deep/pool serving split into a later dossier/change-proposal after the first real-serving closure?

### Unresolved-decision triage

#### Normative now

- `OQ-F0020-01`: Select the canonical fast-first `vllm-fast` baseline model family and artifact source.
  - owner: `@codex`
  - date: `2026-04-16`
  - needed_by: `before_planned`
  - next decision path: settle in the final `spec-compact` review so `plan-slice` can bind real artifact/bootstrap work to one baseline.
- `OQ-F0020-02`: Decide whether deep/pool real-serving stays inside `F-0020` as later slices or is split into a follow-up dossier/change-proposal after the fast-first rule is delivered.
  - owner: `@codex`
  - date: `2026-04-16`
  - needed_by: `before_planned`
  - next decision path: settle during planning boundary selection so slice sequencing stays unambiguous while preserving the promotion rule defined in this spec.

#### Implementation freedom

- The serving container may be CPU-only or ROCm-enabled as long as it preserves canonical `vllm-fast` service/protocol continuity and proves real inference over the canonical deployment-cell path.
- The readiness probe may use the minimal canonical OpenAI-compatible inference call shape that produces real model output; the exact prompt payload is implementation freedom as long as it is not transport-only.
- The canonical serving-dependency descriptor may be file-backed with DB projection or DB-backed with file pointers, but there must be only one source of truth per `service_id`.

#### Temporary assumptions

- For this shaping cycle, `vllm-fast` is the only boot-critical real-serving target; `vllm-deep` and `vllm-pool` remain optional diagnostics until a later seam explicitly fires the promotion trigger defined in this spec.
- Existing `F-0014` richer diagnostics remain the upstream source for optional deep/pool absence and health state until this seam promotes those organs into required runtime dependencies.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0020-01:** `F-0020` is the only canonical owner seam for replacing the phase-0 stub-capable `vllm-fast` slot with real local-model serving; `F-0002` remains the deployment-cell owner, `F-0008` remains the baseline routing/continuity owner, `F-0014` remains the richer registry/health owner, and `F-0015` remains the workshop lifecycle owner.
- **AC-F0020-02:** The delivered fast-first slice preserves the `vllm-fast` service name and OpenAI-compatible `/v1/*` protocol continuity from `F-0002`.
- **AC-F0020-03:** Fast-first closure requires at least one real inference over the canonical container path against the actual artifact backing `vllm-fast`; no stub, fake provider, emulator, simulator or fabricated response path may satisfy this proof.
- **AC-F0020-04:** A serving dependency may be reported as `ready` only after a canonical inference probe succeeds against the actual artifact backing that service. Transport reachability, process liveness or registry metadata alone must not produce a `ready` verdict.
- **AC-F0020-05:** Once `vllm-fast` becomes the promoted fast-serving dependency for this seam, startup fails closed when the promoted dependency is unavailable, its artifact is unresolved, or its canonical inference probe fails.
- **AC-F0020-06:** Once `vllm-fast` becomes the promoted fast-serving dependency for this seam, owner-bound tick admission fails closed when the promoted dependency is unavailable, its artifact is unresolved, or its canonical inference probe fails.
- **AC-F0020-07:** The model artifact contract is explicit and bounded: `/seed/models` stores only bootstrap descriptors/manifests, while mutable runtime model assets live under writable `/models/*`; cached weights or downloaded runtime assets may not become hidden Git-tracked initialization content.
- **AC-F0020-08:** The seam defines one canonical promotion rule for `vllm-deep` and `vllm-pool`: a service stays optional until a canonical dossier or change-proposal explicitly binds it to a non-experimental admitted runtime profile or owner flow and names its artifact descriptor, runtime artifact root, and required smoke/inference proof.
- **AC-F0020-09:** Before that promotion trigger fires, `vllm-deep` and `vllm-pool` remain optional `F-0014` diagnostics and must surface as explicit unavailable/degraded state rather than implicit readiness or hidden boot failure.
- **AC-F0020-10:** After that promotion trigger fires, the promoted service satisfies the same artifact, readiness, startup fail-closed, and owner-admission fail-closed rules as `vllm-fast`.
- **AC-F0020-11:** Workshop or promotion-facing dependency handoff may reference only service/artifact identifiers backed by real-serving-capable dependencies.
- **AC-F0020-12:** Seam closure requires canonical verification that exercises at least one real inference over the containerized serving path plus fail-closed behavior for missing or unusable promoted dependencies.

## 4. Non-functional requirements (NFR)

- **NFR-F0020-01 Activation correctness:** `core` may expose the promoted fast organ as healthy only after one successful canonical inference probe has produced actual model output for the current artifact/service identity.
- **NFR-F0020-02 Provenance visibility:** Every promoted serving dependency exposes an observable tuple of `service_id`, artifact descriptor location, runtime artifact root and `bootCritical` flag through canonical owner surfaces.
- **NFR-F0020-03 Recoverability:** After restart, a missing artifact, failed readiness probe or unusable promoted service keeps the dependency in a non-ready state and blocks real-serving claims until a fresh probe succeeds.
- **NFR-F0020-04 Optionality transparency:** Optional deep/pool services must appear as explicit unavailable/degraded diagnostics rather than hidden boot failures or silent fallback claims.

## 5. Design (compact)

### 5.1 API surface

- No new public HTTP route family is introduced by intake alone.
- The canonical inference contract remains the internal OpenAI-compatible `/v1/*` serving surface already assumed by `F-0002`, `F-0008` and the architecture.
- First-run / machine-facing contract for this seam:
  1. Resolve one canonical serving-dependency descriptor for the target `service_id`.
  2. Resolve or materialize the referenced runtime artifact into writable `/models/*`.
  3. Start the local model service on the canonical container path.
  4. Run a canonical inference probe.
  5. Publish readiness/health only from probe-backed evidence.
  6. Allow downstream routing/admission to treat the dependency as live only after step 5.
- Compact serving-dependency structure:

```ts
type ServingDependencyState = {
  serviceId: "vllm-fast" | "vllm-deep" | "vllm-pool";
  endpoint: string;
  bootCritical: boolean;
  optionalUntilPromoted: boolean;
  artifactDescriptorPath: string;
  runtimeArtifactRoot: string;
  readiness: "ready" | "warming" | "degraded" | "unavailable";
  readinessBasis:
    | "probe_passed"
    | "descriptor_invalid"
    | "artifact_missing"
    | "transport_failed"
    | "probe_failed";
};
```

### 5.2 Runtime / deployment surface

- The runtime/deployment seam starts from the already delivered `core + postgres + vllm-fast` cell and turns the `vllm-fast` slot from stub-capable continuity into a real-serving path.
- `vllm-deep` and `vllm-pool` remain architecturally named local organs, but this seam now defines the trigger that promotes them from optional diagnostics to required runtime dependencies.
- Promotion trigger for `vllm-deep` / `vllm-pool`:
  1. a canonical dossier or change-proposal explicitly binds the service to a non-experimental admitted runtime profile or owner flow;
  2. that promoting seam names the service-specific artifact descriptor, runtime artifact root, and required smoke/inference proof;
  3. after that declaration lands, the service enters the same readiness and fail-closed regime as `vllm-fast`.
- Writable model assets live under `/models/*`; tracked bootstrap manifests remain under `/seed/models`.
- `polyphony-core` remains the only identity-bearing runtime. Model services stay outside core as cognitive organs and may not become shadow owners of continuity or workshop state.
- `GET /health` and bounded `/models` publication remain downstream projections. This seam owns the serving truth they project, not new public write routes.

### 5.3 Data model changes

- One canonical serving-dependency descriptor must exist per local organ `service_id`.
- The descriptor must carry, directly or by canonical pointer:
  - `service_id`
  - `endpoint`
  - `artifact_descriptor_path`
  - `runtime_artifact_root`
  - `boot_critical`
  - `optional_until_promoted`
  - `readiness_basis`
- Existing `model_registry` / `model_profile_health` / `model_fallback_links` surfaces remain the continuity and diagnostics family from `F-0008` / `F-0014`; `F-0020` must not create a second shadow registry for the same service identities.

### 5.4 Edge cases and failure modes

#### Adversarial semantics

| Case | Classification | Operations / boundary | Invariant / observable result | Required proof / rationale |
|---|---|---|---|---|
| Sequential success | specified | descriptor resolution -> service start -> inference probe -> readiness publication -> routing/admission use | `ready` appears only after probe-backed success for the current service/artifact identity | integration + container smoke |
| Invalid input | specified | malformed descriptor, bad endpoint or unresolved artifact before/at service start | invalid serving config never becomes `ready`; observable result is explicit unavailable/dependency-failure state | contract + integration |
| Dependency failure / timeout | specified | service boot, transport reachability or inference probe timeout | promoted dependency fails closed; real-serving claims and owner-bound admission stay blocked | integration + smoke |
| Duplicate or replay after completion | specified | repeated startup/readiness evaluation against the same already-ready service/artifact | state converges to one dependency identity and one readiness verdict; replay does not invent a second delivered dependency | integration |
| Concurrent duplicate or racing request | specified | overlapping readiness/health refreshes on the same `service_id` | a stale or transport-only result cannot override the fresher probe-backed truth; no `ready` before probe success | integration / race harness |
| Concurrent conflicting request | N/A | this stage introduces no public/operator write path that selects competing artifacts for the same `service_id` | later rollout/governance seams own conflicting activation policy | N/A rationale: outside current owner boundary |
| Partial side effect / crash / restart | specified | artifact materialization or service startup crashes before readiness is published | partial assets or interrupted startup do not create `ready`; restart either resumes safely or fails closed | restart integration + smoke |
| Stale read / late completion | specified | registry/health projection reads before probe completion or after dependency loss | projections may not report `ready` solely from stale metadata; late success must still match the current service/artifact identity | integration + projection contract |

#### Additional failure modes

- Boot/runtime mismatch between registry metadata and actual serving readiness.
- Missing or incompatible weights/artifacts for the selected serving path.
- `vllm-fast` healthy at transport level but not able to perform canonical inference.
- `vllm-deep` / `vllm-pool` present in diagnostics but intentionally not yet promoted into required runtime dependencies.

### 5.5 Verification surface / initial verification plan

- `AC-F0020-01`: spec-conformance review of owner boundaries + implementation contract review.
- `AC-F0020-02`: service/protocol continuity integration check for `vllm-fast` on the canonical deployment-cell path.
- `AC-F0020-03`: real-serving integration test plus container smoke proving that `vllm-fast` is no longer satisfied by a stub/fake path.
- `AC-F0020-04`: readiness integration test proving that only probe-backed inference yields `ready`.
- `AC-F0020-05`: startup failure-path test for missing artifact, probe failure, or unavailable promoted fast dependency.
- `AC-F0020-06`: owner-admission failure-path test for missing artifact, probe failure, or unavailable promoted fast dependency.
- `AC-F0020-07`: contract/integration coverage for descriptor placement and writable `/models/*` materialization.
- `AC-F0020-08`: spec-conformance check of the deep/pool promotion trigger wording plus planning-boundary audit.
- `AC-F0020-09`: integration coverage for optional deep/pool diagnostics before promotion.
- `AC-F0020-10`: promoted-dependency integration coverage for deep/pool once a later seam marks them required.
- `AC-F0020-11`: workshop/promotion dependency handoff audit proving that only real-serving-backed identifiers are treated as delivered dependencies.
- `AC-F0020-12`: container smoke plus fail-closed negative-path verification.

### 5.6 Representation upgrades (triggered only when needed)

#### State list

- `warming`
- `ready`
- `degraded`
- `unavailable`

#### Decision list

- If `service_id = vllm-fast` and the fast-first artifact is unresolved or probe-failing, the seam is not delivered.
- If `service_id = vllm-deep | vllm-pool` and no promotion rule has marked it required, absence is represented as explicit optional degraded/unavailable state.
- If a dependency is marked promoted/boot-critical, startup and owner-bound admission must treat it as fail-closed.

### 5.7 Definition of Done

- `vllm-fast` is served through one real containerized inference path on the canonical deployment cell.
- Boot/readiness semantics treat the promoted fast dependency as fail-closed when unusable.
- Artifact/weights placement and provenance rules are explicit and enforced by canonical owner surfaces.
- The optional-vs-promoted rule for `vllm-deep` / `vllm-pool` is explicit.
- Verification proves real inference and negative-path behavior; no stub/emulator path counts toward closure.

### 5.8 Rollout / activation note (triggered only when needed)

- Intake direction is fast-first: real `vllm-fast` serving must be shaped and proven before any deeper serving expansion or later working-system claims.
- Activation order:
  1. deliver and prove the fast-first real `vllm-fast` path;
  2. realign boot/readiness assumptions to the delivered fast dependency;
  3. only then decide whether `vllm-deep` / `vllm-pool` stay optional diagnostics or become promoted dependencies;
  4. later workshop/specialist/release seams may consume only the delivered dependency truth.

## 6. Slicing plan (2–6 increments)

Deferred to `plan-slice`. Expected first slice is fast-first `vllm-fast`; later slices depend on the normative-now decisions above.

## 7. Task list (implementation units)

Deferred to `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0020-01 | Planned: spec-conformance review + owner-boundary audit | planned |
| AC-F0020-02 | Planned: service/protocol continuity integration | planned |
| AC-F0020-03 | Planned: real-serving integration + container smoke | planned |
| AC-F0020-04 | Planned: readiness/probe integration | planned |
| AC-F0020-05 | Planned: startup fail-closed integration | planned |
| AC-F0020-06 | Planned: owner-admission fail-closed integration | planned |
| AC-F0020-07 | Planned: artifact/descriptor contract + integration | planned |
| AC-F0020-08 | Planned: promotion-trigger spec-conformance audit | planned |
| AC-F0020-09 | Planned: optional deep/pool diagnostics integration | planned |
| AC-F0020-10 | Planned: promoted deep/pool dependency integration | planned |
| AC-F0020-11 | Planned: workshop/promotion dependency handoff audit | planned |
| AC-F0020-12 | Planned: negative-path smoke / fail-closed verification | planned |

## 9. Decision log (ADR blocks)

- none yet

## 10. Progress & links

- Backlog item key: CF-023
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-16: Initial dossier created from backlog item `CF-023` at backlog delivery state `planned`.
- 2026-04-16: `spec-compact` shaped the real-serving seam: added atomic ACs, machine-facing serving contract, adversarial semantics, fail-closed dependency rules, and initial verification/coverage plan.
