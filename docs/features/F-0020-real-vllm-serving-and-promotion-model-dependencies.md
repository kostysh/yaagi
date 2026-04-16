---
id: F-0020
title: Реальный vLLM-serving и promotion model dependencies
status: proposed
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

- The current repository state still matches the backlog reading: `CF-023` is backlog-selected and carries `planned` as the intake-time delivery state, even though the actual seam has not yet been intaken.
- The first implementation slice should target one canonical real `vllm-fast` path before any deep/pool expansion.
- Existing richer registry/health surfaces from `F-0014` will be consumed and refined by this seam rather than replaced.

### Open questions (optional)

- Which exact model family and artifact source become the canonical fast-first `vllm-fast` baseline for this repo?
- Does `F-0020` own both the fast-first and deep/pool serving slices in one dossier, or should deep/pool serving split into a later dossier/change-proposal after the first real-serving closure?
- What is the explicit boundary between service readiness, model-health diagnostics and boot-critical dependency promotion for `vllm-deep` / `vllm-pool`?

## 3. Requirements & Acceptance Criteria (SSoT)

Initial intake only. Normative ACs will be defined during `spec-compact`.

## 4. Non-functional requirements (NFR)

Initial intake only. Concrete NFRs will be defined during `spec-compact`.

## 5. Design (compact)

### 5.1 API surface

- No new public HTTP route family is introduced by intake alone.
- The canonical inference contract remains the internal OpenAI-compatible `/v1/*` serving surface already assumed by `F-0002`, `F-0008` and the architecture.

### 5.2 Runtime / deployment surface

- The runtime/deployment seam starts from the already delivered `core + postgres + vllm-fast` cell and turns the `vllm-fast` slot from stub-capable continuity into a real-serving path.
- `vllm-deep` and `vllm-pool` remain architecturally named local organs, but their optional-vs-required status is still to be shaped explicitly.
- Writable model assets live under `/models/*`; tracked bootstrap manifests remain under `/seed/models`.

### 5.3 Data model changes

- Expected surfaces include model artifact manifests, serving/dependency descriptors and health/readiness evidence that connects registry-level state to actual serving reality.
- Exact schema and ownership boundaries remain for `spec-compact`.

### 5.4 Edge cases and failure modes

- Boot/runtime mismatch between registry metadata and actual serving readiness.
- Missing or incompatible weights/artifacts for the selected serving path.
- `vllm-fast` healthy at transport level but not able to perform canonical inference.
- `vllm-deep` / `vllm-pool` present in diagnostics but intentionally not yet promoted into required runtime dependencies.

### 5.5 Verification surface / initial verification plan

- Canonical proof must include real inference over the containerized serving path, not only registry wiring or synthetic provider tests.
- Container smoke remains mandatory for any runtime claim that this seam makes about real local-model serving.

### 5.6 Representation upgrades (triggered only when needed)

Deferred to `spec-compact`.

### 5.7 Definition of Done

Deferred to `spec-compact`, but closure may not count any stub/emulator path as sufficient evidence.

### 5.8 Rollout / activation note (triggered only when needed)

- Intake direction is fast-first: real `vllm-fast` serving must be shaped and proven before any deeper serving expansion or later working-system claims.

## 6. Slicing plan (2–6 increments)

Deferred to `plan-slice`.

## 7. Task list (implementation units)

Deferred to `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|

## 9. Decision log (ADR blocks)

## 10. Progress & links

- Backlog item key: CF-023
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-16: Initial dossier created from backlog item `CF-023` at backlog delivery state `planned`.
