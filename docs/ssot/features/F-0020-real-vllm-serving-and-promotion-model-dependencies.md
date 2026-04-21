---
id: F-0020
title: Реальный vLLM-serving и promotion model dependencies
status: done
coverage_gate: strict
owners: ["@codex"]
area: models
depends_on: ["F-0002", "F-0008", "F-0014", "F-0015"]
impacts: ["runtime", "infra", "models", "artifacts", "workshop"]
created: 2026-04-16
updated: 2026-04-17
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/ssot/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/ssot/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/ssot/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
    - "docs/adr/ADR-2026-04-17-local-structured-output-schema-sanitization.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-023
  - Backlog delivery state at intake: planned
  - Canonical backlog read used for intake:
    - `dossier-engineer status`
    - `dossier-engineer queue`
    - `dossier-engineer items --item-keys "CF-023,CF-013,CF-024"`
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
    - For this intake, canonical backlog truth comes from the current `dossier-engineer` read surface and is recorded as `delivery_state=planned`, dependencies `CF-020`, `CF-006`, `CF-010`, no blockers.
    - No backlog actualization was applied during intake because the intake did not establish a new canonical dependency set beyond the current `dossier-engineer` backlog state.
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

- Backlog truth before this planning cycle remains canonical via `dossier-engineer`: `CF-023` is `specified` and ready for `planned` actualization once slice sequencing and stop points are explicit.
- The first implementation slice must prove the workstation-specific feasibility of one real `vllm-fast` candidate before boot-critical promotion is allowed.
- Existing richer registry/health surfaces from `F-0014` will be consumed and refined by this seam rather than replaced.

### Open questions (optional)

- none

### Unresolved-decision triage

#### Normative now

- `OQ-F0020-01` re-resolved on `2026-04-17`: implementation now fixes one **canonical Gemma-only fast baseline** instead of continuing the earlier three-candidate forecast.
  - Canonical fast baseline: `google/gemma-4-E4B-it`.
  - Artifact source family: canonical Hugging Face descriptors/manifests resolved into writable `/models/base/*`; no alternate registry or ad hoc provider path is introduced by this dossier.
  - Canonical ROCm serving posture for this workstation: `vllm/vllm-openai-rocm:gemma4`, `TRITON_ATTN`, JSON `limitMmPerPrompt={"image":0,"audio":0}`, OpenAI-compatible `/v1/*` probe path and the existing `vllm-fast` service identity.
  - Decision rule: the current manifest and qualification bundle may name only the canonical Gemma baseline. Introducing another baseline candidate, fallback candidate or alternate provider bridge requires explicit dossier/backlog realignment instead of silent re-expansion of the candidate set.
- `OQ-F0020-02` resolved on `2026-04-16`: `F-0020` implementation scope ends with fast-first real `vllm-fast`, explicit optional deep/pool diagnostics continuity, and one future promotion rule. Real-serving delivery for `vllm-deep` / `vllm-pool` is split into a follow-up dossier or change-proposal after the fast path is delivered.

#### Implementation freedom

- The serving container may be CPU-only or ROCm-enabled as long as it preserves canonical `vllm-fast` service/protocol continuity and proves real inference over the canonical deployment-cell path.
- The readiness probe may use the minimal canonical OpenAI-compatible inference call shape that produces real model output; the exact prompt payload is implementation freedom as long as it is not transport-only.
- The canonical serving-dependency descriptor may be file-backed with DB projection or DB-backed with file pointers, but there must be only one source of truth per `service_id`.
- The candidate-qualification corpus may mix reactive, summarization, structured-output and short coding prompts, but every candidate must be measured against the same corpus, same runtime posture and same scoring rubric.

#### Temporary assumptions

- `vllm-fast` is the only boot-critical real-serving target in this dossier. `vllm-deep` and `vllm-pool` stay optional diagnostics here unless a later dossier explicitly promotes them.

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
- **NFR-F0020-02 Provenance visibility:** Every promoted serving dependency preserves one observable tuple of `service_id`, artifact descriptor location, runtime artifact root and `bootCritical` flag on canonical owner-only surfaces (`vllm-fast` manifest/monitor state, workshop dependency handoff and verification artifacts). Public `GET /health` and bounded `/models` projections may expose only redacted/public-safe views of that tuple and must not leak raw local paths.
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
- Exact local provenance (`artifact_descriptor_path`, `runtime_artifact_root`) remains on owner-only surfaces such as the manifest loader state, serving dependency monitor, workshop dependency handoff and verification artifacts; public projections expose only redacted/public-safe views of the same dependency identity.

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

- `AC-F0020-01`: spec-conformance review of owner boundaries plus final implementation contract review.
- `AC-F0020-02`, `AC-F0020-03`, `AC-F0020-07`, `AC-F0020-12`: canonical Gemma-baseline qualification bundle, including fixed prompt corpus, descriptor/materialization proof, real inference over the canonical container path, and negative-path smoke for unusable promoted fast dependencies.
- `AC-F0020-04`: readiness integration coverage, including stale-result, replay and race-window guards proving that only probe-backed inference yields `ready`.
- `AC-F0020-05`: startup failure-path test for missing artifact, probe failure, timeout, or unavailable promoted fast dependency.
- `AC-F0020-06`: owner-admission failure-path test for missing artifact, probe failure, timeout, or unavailable promoted fast dependency.
- `AC-F0020-08`, `AC-F0020-10`: spec-conformance audit of the deep/pool promotion trigger wording and future-promotion contract guard; no in-dossier deep/pool promotion is planned for this feature.
- `AC-F0020-09`: integration coverage for optional deep/pool diagnostics before promotion.
- `AC-F0020-11`: workshop/promotion dependency handoff audit proving that only real-serving-backed identifiers are treated as delivered dependencies.

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
- Artifact/weights placement and provenance rules are explicit and enforced by canonical owner-only surfaces; public operator projections stay redacted and do not expose raw local paths.
- The optional-vs-promoted rule for `vllm-deep` / `vllm-pool` is explicit.
- Verification proves real inference and negative-path behavior; no stub/emulator path counts toward closure.

### 5.8 Rollout / activation note (triggered only when needed)

- Intake direction is fast-first: real `vllm-fast` serving must be shaped and proven before any deeper serving expansion or later working-system claims.
- Activation order:
  1. qualify the canonical `google/gemma-4-E4B-it` fast baseline on the canonical container path using one fixed scorecard and must-pass gate set;
  2. activate the selected fast baseline as a real-serving dependency and publish only probe-backed readiness;
  3. realign boot/readiness assumptions to the delivered fast dependency;
  4. run the final usage audit and keep `vllm-deep` / `vllm-pool` explicitly optional until a future promotion seam exists;
  5. later workshop/specialist/release seams may consume only the delivered dependency truth.

## 6. Slicing plan (2–6 increments)

Forecast policy: slices below are implementation forecast, not separate product commitments. Commitment remains in ACs, Definition of Done, verification gates and rollout constraints.

### Dependency visibility

- Depends on: `F-0002`; owner: `@codex`; unblock condition: the canonical deployment cell remains `core + postgres + vllm-fast` over Docker Compose with the same service name, `/v1/*` contract and writable `/models/*` mount.
- Depends on: `F-0008`; owner: `@codex`; unblock condition: baseline router and continuity continue treating `service_id = vllm-fast` as the fast profile target without inventing a second routing substrate.
- Depends on: `F-0014`; owner: `@codex`; unblock condition: richer `model_registry` / `model_profile_health` / `model_fallback_links` surfaces remain the only source of optional deep/pool diagnostics and service identity continuity.
- Depends on: `F-0015`; owner: `@codex`; unblock condition: workshop/promotion flows consume service/artifact identifiers read-only and do not force this dossier to become the workshop lifecycle owner.

### Матрица риск -> доказательство

| Risk / edge case | Spec source | Required proof | Slice | Verification artifact | N/A rationale |
|---|---|---|---|---|---|
| Sequential success | §5.4 `Sequential success`; AC-F0020-03/04 | One ordered run `descriptor resolution -> artifact materialization -> service start -> inference probe -> readiness publish -> router/admission read` on the same `service_id`/artifact identity. Observable result: `ready` appears only after the probe returns actual model output. Invariant: transport or metadata alone never publishes `ready`. | `SL-F0020-01`, `SL-F0020-02` | Candidate qualification bundle + readiness integration + container smoke | — |
| Invalid input | §5.4 `Invalid input`; AC-F0020-04/07 | Malformed descriptor path, unsupported artifact pointer, bad endpoint or missing runtime root must produce explicit `descriptor_invalid` / `artifact_missing` / `transport_failed` states. Observable result: startup/readiness stays non-ready and the system names the failing basis. Invariant: invalid config never becomes live. | `SL-F0020-01`, `SL-F0020-02` | Descriptor contract tests + negative integration | — |
| Dependency failure / timeout | §5.4 `Dependency failure / timeout`; AC-F0020-05/06/12 | Probe timeout, container boot failure or probe transport failure during startup/admission must fail closed for the promoted fast dependency. Observable result: startup or owner-bound admission rejects instead of silently degrading to stub behavior. Invariant: promoted dependency truth is fail-closed. | `SL-F0020-03` | Startup/admission fail-closed integration + smoke | — |
| Duplicate or replay after completion | §5.4 `Duplicate or replay after completion`; AC-F0020-04 | Re-running readiness/start on an already-qualified artifact must converge to one dependency identity and one readiness verdict. Observable result: replay reuses the same descriptor/artifact tuple and does not create a second active dependency record. Invariant: readiness is idempotent for the current artifact identity. | `SL-F0020-02` | Replay/idempotency integration | — |
| Concurrent duplicate or racing request | §5.4 `Concurrent duplicate or racing request`; AC-F0020-04 | Overlapping health refreshes and probe completions on the same `service_id` must keep result ordering tied to the freshest probe for the current artifact digest. Observable result: a stale transport-only success cannot overwrite a fresher probe failure or a newer artifact identity. Invariant: no `ready` before the winning probe succeeds. | `SL-F0020-02` | Race-window integration harness | — |
| Concurrent conflicting request | §5.4 `Concurrent conflicting request` | No public/operator write path in this dossier selects competing artifacts for the same `service_id`; later rollout/governance seams own that actuation policy. | `SL-F0020-04` | Spec-conformance audit | Outside current owner boundary |
| Partial side effect / crash / restart | §5.4 `Partial side effect / crash / restart`; AC-F0020-03/05/07 | Interrupt artifact materialization or service startup before readiness publication, then restart. Observable result: partial downloads or interrupted boots never create `ready`; restart resumes safely or fails closed. Invariant: crash/restart cannot backdoor readiness. | `SL-F0020-02`, `SL-F0020-03` | Restart integration + smoke | — |
| Stale read / late completion | §5.4 `Stale read / late completion`; AC-F0020-04/09 | Read model health or `/models` projection before probe completion and after dependency loss. Observable result: projected readiness stays degraded/unavailable until a probe for the current artifact identity succeeds, and late success for an old artifact is ignored. Invariant: projections track current service/artifact identity, not stale metadata. | `SL-F0020-02`, `SL-F0020-04` | Projection contract integration | — |

### SL-F0020-01: Candidate qualification bundle и artifact contract

- **Результат:** Один canonical `serving-dependency` contract для `vllm-fast`, один canonical `google/gemma-4-E4B-it` baseline и объективный qualification bundle, который доказывает этот baseline на одном runtime path без скрытого fallback/comparator набора.
- **Покрывает:** AC-F0020-01, AC-F0020-02, AC-F0020-03, AC-F0020-07, AC-F0020-12.
- **Проверка:** descriptor contract tests, artifact materialization tests, canonical container smoke для Gemma baseline, qualification report с единым prompt corpus и scorecard.
- Depends on: `F-0002`; owner `@codex`; unblock condition: canonical Docker Compose cell and `/models/*` runtime roots stay unchanged.
- **Предположение:** один Gemma baseline, уже подтверждённый workstation qualification, достаточен для fast-first delivery без повторного расширения candidate market внутри этой фичи.
- **Fallback:** если Gemma перестаёт проходить must-pass gates на canonical runtime path, остановиться после `SL-F0020-01`, сохранить qualification evidence и вернуть dossier/backlog на realignment вместо тихого возврата к многокандидатному набору.
- **Approval / decision path:** architecture/ADR realignment required if implementation needs a second candidate, a different provider bridge, or a non-canonical artifact source.

#### Objective candidate-testing policy

- **Canonical baseline under test:** `google/gemma-4-E4B-it`.
- **Runtime parity rule:** одинаковые container entrypoint, `vLLM` version family, OpenAI-compatible probe path, writable `/models/base/*` root, prompt corpus and warmup policy must hold across every restart and rerun of the canonical Gemma baseline.
- **Must-pass gates:**
  1. candidate boots through the canonical `vllm-fast` container path and answers one real inference probe;
  2. candidate survives `3` cold starts and `20` warm probe requests without crash, OOM or transport flapping;
  3. structured-output adherence on the shared bounded JSON/schema subset is at least `95%`;
  4. the candidate exposes no secret/stub/fake path and leaves one reproducible artifact descriptor -> runtime root trace.
- **Comparative scorecard after gates:** quality on shared prompt corpus `40%`, latency / throughput for reactive prompts `25%`, memory headroom on the workstation `20%`, stability / restart behavior `15%`.
- **Decision rule:** Gemma must clear every must-pass gate and the fixed weighted scorecard. If it fails, the outcome is `no_winner` for the current seam until dossier/backlog realignment explicitly approves a different baseline candidate.

### SL-F0020-02: Real `vllm-fast` activation и probe-backed readiness

- **Результат:** Выбранный fast candidate materialize-ится как actual runtime artifact, поднимается через canonical `vllm-fast` service path и публикует readiness только после успешного inference probe.
- **Покрывает:** AC-F0020-03, AC-F0020-04, AC-F0020-07.
- **Проверка:** readiness integration tests, stale-result/replay/race tests, restart/partial-materialization tests, container smoke for the selected candidate.
- Depends on: `SL-F0020-01`, `F-0014`; owner `@codex`; unblock condition: selected candidate already has qualification evidence and the richer health surface can project probe-backed basis without creating a second registry.
- **Предположение:** the selected fast candidate can be started and probed on this workstation without introducing a second serving control plane.
- **Fallback:** if the candidate boots but readiness remains unstable, keep `vllm-fast` non-ready and stop before boot-critical promotion.

### SL-F0020-03: Fail-closed fast promotion, router/admission handoff и workshop dependency truth

- **Результат:** `vllm-fast` becomes the promoted fast dependency for startup and owner-bound admission, while workshop/promotion handoff consumes only real-serving-backed service/artifact identifiers.
- **Покрывает:** AC-F0020-05, AC-F0020-06, AC-F0020-11, AC-F0020-12.
- **Проверка:** startup fail-closed integration, owner-admission fail-closed integration, negative smoke for missing/unusable promoted dependency, workshop dependency handoff audit.
- Depends on: `F-0008`, `F-0015`; owner `@codex`; unblock condition: baseline routing still targets `service_id = vllm-fast`, and workshop reads can consume dependency truth without forcing `F-0020` to own promotion lifecycle.
- **Предположение:** router and admission paths can consume the same promoted dependency state without reopening router ownership.
- **Fallback:** if promotion breaks startup/admission semantics, stop with the selected fast candidate still real-serving but not yet boot-critical, and realign the dossier before activation.

### SL-F0020-04: Optional deep/pool continuity, future promotion guard и usage audit

- **Результат:** `vllm-deep` / `vllm-pool` remain explicit optional diagnostics, the future promotion rule is pinned as a contract guard, and the delivered fast path is checked by a real usage audit before close-out.
- **Покрывает:** AC-F0020-08, AC-F0020-09, AC-F0020-10.
- **Проверка:** optional-diagnostics integration, spec-conformance audit for the future promotion trigger, real usage audit over the selected fast path and its downstream projections.
- Depends on: `F-0014`; owner `@codex`; unblock condition: richer diagnostics keep projecting unavailable/degraded state without making deep/pool boot-critical.
- **Предположение:** deep/pool can remain future-owned without weakening the delivered fast-first truth.
- **Fallback:** if diagnostics cannot stay explicit and bounded, keep deep/pool surfaces degraded/unavailable and raise a follow-up dossier/change-proposal before any promotion attempt.

### Allowed stop points

| Stop point | Безопасная причина остановки | Ожидаемая проверка | Вне остановки |
|---|---|---|---|
| After `SL-F0020-01` | Candidate evidence and descriptor contract exist, but no runtime dependency was promoted yet. | Qualification bundle, descriptor/materialization tests and negative candidate gates pass. | Real-serving activation, fail-closed promotion and deep/pool continuity remain pending. |
| After `SL-F0020-02` | Real `vllm-fast` serving is live and probe-backed, but startup/admission still do not treat it as boot-critical. | Selected-candidate readiness integration and smoke pass. | Boot-critical promotion, workshop handoff and final audit remain pending. |
| After `SL-F0020-03` | Mandatory fast-first scope is delivered, but deep/pool continuity close-out and usage audit still remain. | Startup/admission fail-closed integration and workshop dependency audit pass. | Final optionality guard and usage audit remain pending. |
| After `SL-F0020-04` | Full planned scope is delivered. | Full AC coverage, usage audit and step-close bundle pass. | Future deep/pool real-serving dossier remains separate by design. |

### Аудит реального использования

- Запустить после `SL-F0020-04` на реально поднятом `vllm-fast`, а не только на in-memory harness.
- Audit categories: `docs-only`, `runtime`, `schema/help`, `cross-skill`, `audit-only`.
- Expected checks: selected baseline still answers through the canonical container path after restart, `/health` and `/models` projections reflect the same readiness basis, workshop-facing dependency references never point to a stub-only artifact, deep/pool surfaces remain explicitly optional.

## 7. Task list (implementation units)

- **T-F0020-01:** Добавить canonical `serving-dependency` descriptor and runtime-root contract для `SL-F0020-01`. Covers: AC-F0020-01, AC-F0020-07.
- **T-F0020-02:** Подготовить shared candidate corpus, must-pass gates and weighted scorecard для `SL-F0020-01`. Covers: AC-F0020-02, AC-F0020-03, AC-F0020-12.
- **T-F0020-03:** Зафиксировать selected fast baseline outcome или explicit no-winner stop-point evidence для `SL-F0020-01`. Covers: AC-F0020-01, AC-F0020-12.
- **T-F0020-04:** Реализовать artifact materialization, `vllm-fast` startup and probe-backed readiness publication для `SL-F0020-02`. Covers: AC-F0020-03, AC-F0020-04, AC-F0020-07.
- **T-F0020-05:** Добавить replay, race-window and restart guards around readiness/projection state для `SL-F0020-02`. Covers: AC-F0020-04.
- **T-F0020-06:** Перевести startup and owner-bound admission на fail-closed promoted fast dependency для `SL-F0020-03`. Covers: AC-F0020-05, AC-F0020-06, AC-F0020-12.
- **T-F0020-07:** Ограничить workshop/promotion dependency handoff реальными service/artifact identifiers для `SL-F0020-03`. Covers: AC-F0020-11.
- **T-F0020-08:** Закрепить optional deep/pool diagnostics, future promotion guard and final usage audit для `SL-F0020-04`. Covers: AC-F0020-08, AC-F0020-09, AC-F0020-10.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0020-01 | `SL-F0020-01` owner-boundary/spec-conformance review + `SL-F0020-03`/`SL-F0020-04` close-out audit | implemented |
| AC-F0020-02 | `SL-F0020-01` Gemma-baseline qualification bundle proving service/protocol continuity on the canonical `vllm-fast` path | implemented |
| AC-F0020-03 | `SL-F0020-01` real inference on the canonical Gemma baseline + `SL-F0020-02` selected-candidate smoke | implemented |
| AC-F0020-04 | `SL-F0020-02` readiness/probe integration, replay/race guards and projection contract tests | implemented |
| AC-F0020-05 | `SL-F0020-03` startup fail-closed integration | implemented |
| AC-F0020-06 | `SL-F0020-03` owner-admission fail-closed integration | implemented |
| AC-F0020-07 | `SL-F0020-01` descriptor/materialization contract tests + `SL-F0020-02` runtime-root integration | implemented |
| AC-F0020-08 | `SL-F0020-04` promotion-trigger spec-conformance audit | implemented |
| AC-F0020-09 | `SL-F0020-04` optional deep/pool diagnostics integration | implemented |
| AC-F0020-10 | `SL-F0020-04` future-promotion contract guard audit; no in-feature deep/pool promotion planned | implemented |
| AC-F0020-11 | `SL-F0020-03` workshop/promotion dependency handoff audit | implemented |
| AC-F0020-12 | `SL-F0020-01` canonical baseline qualification + `SL-F0020-03` fail-closed smoke | implemented |

## 9. Decision log (ADR blocks)

- **ADR-F0020-01:** Local `Gemma`/`vLLM` structured outputs use a sanitized provider-facing JSON Schema derived from the canonical `Zod` decision contract, while final runtime acceptance stays bound to local `Zod` validation. Source: [ADR-2026-04-17 Local Structured Output Schema Sanitization](../adr/ADR-2026-04-17-local-structured-output-schema-sanitization.md).

## 10. Progress & links

- Backlog item key: CF-023
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-16: Initial dossier created from backlog item `CF-023` at backlog delivery state `planned`.
- 2026-04-16: `spec-compact` shaped the real-serving seam: added atomic ACs, machine-facing serving contract, adversarial semantics, fail-closed dependency rules, and initial verification/coverage plan.
- 2026-04-16 [planning]: closed the `before_planned` ambiguity by fixing the fast-candidate qualification rule around one canonical fast baseline, split deep/pool real-serving into follow-up scope, and added four implementation slices with objective model-testing guidance and explicit stop points.
- 2026-04-17 [contract drift]: implementation and operator direction realigned `SL-F0020-01` from a forecast three-candidate qualification to one canonical `google/gemma-4-E4B-it` baseline, fixed the ROCm serving image/flags required for `gemma4`, and recorded Gemma-only qualification evidence as the current source of truth.
- 2026-04-17 [runtime compatibility]: fixed the local structured-output delivery rule for the Gemma/vLLM path by introducing sanitized provider-facing JSON Schema plus canonical local `Zod` revalidation, and promoted that rule into repo-level ADR ownership.
- 2026-04-17 [smoke realignment]: `F-0007` deployment-cell smoke was realigned so Telegram coverage runs as an overlay over the same suite-scoped compose project and reuses the same promoted `vllm-fast`/`Gemma` runtime instead of booting a second model stack.
- 2026-04-17 [implementation]: completed the executable Gemma-first seam changes, qualification evidence, probe-backed readiness, fail-closed startup/admission promotion, bounded workshop dependency truth, explicit optional deep/pool continuity and a passing container smoke path; independent review and `dossier-step-close` were recorded as the final closeout gate.
