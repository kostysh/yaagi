---
id: F-0013
title: HTTP API управления и интроспекции
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: api
depends_on: [F-0001, F-0003, F-0004, F-0005, F-0008]
impacts: [runtime, api, state, timeline, observability, models, governance]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0013 HTTP API управления и интроспекции

## 1. Context & Goal

- **User problem:** После поставки runtime/state/perception/router seams в системе уже есть canonical internal surfaces для состояния, timeline, episodes и baseline model routing, но operator-facing HTTP boundary по-прежнему intentionally ограничена `GET /health` и `POST /ingest`. Без явного owner-а richer operator API быстро превращается либо в набор ad hoc debug routes поверх raw SQL/JSON dumps, либо в premature control backdoor, который начинает напрямую писать в governor/state/model surfaces без зафиксированной write authority.
- **Goal:** Создать canonical dossier-owner для operator-facing HTTP API beyond minimal health/ingest: один seam должен владеть read-only introspection routes, bounded control route contracts и Hono-level operator boundary, не перетягивая ownership над runtime continuity, subject-state, model registry health или governor policy execution.
- **Non-goals:** Public auth/perimeter hardening, dashboards/streaming UI, workshop/body-evolution controls, direct business/state mutation routes и mature governor execution в этот intake не входят.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0001` boot/recovery boundary, `F-0003` tick runtime and timeline continuity, `F-0004` bounded subject-state snapshot, `F-0005` ingress boundary and `F-0008` baseline model routing diagnostics. Richer model-registry health still belongs to future `CF-010`, while `freeze-development` and related governance controls require future `CF-016` ownership before they can become real operator routes.

## 2. Scope

### In scope

- Canonical owner for operator-facing HTTP routes beyond phase-0 `GET /health` and beyond already delivered `POST /ingest`.
- Route-family ownership for read-only introspection over canonical seams:
  - `GET /state`
  - `GET /timeline`
  - `GET /episodes`
  - `GET /models`
- Bounded control-route contracts for operator actions such as `POST /control/tick`, with explicit routing through canonical runtime/governor owners rather than direct state writes.
- Explicit gating contract for governance-sensitive routes such as `POST /control/freeze-development`, so they do not appear as fake or backdoor controls before `CF-016`.
- Hono-level response/payload boundary for operator introspection and control requests on the canonical `AI SDK + Hono` runtime stack.

### Out of scope

- Public authN/authZ, perimeter hardening, rate limiting policy and stronger human-override controls; these remain future work aligned with `CF-014`.
- Dashboard/UI delivery, websockets, SSE streams or external operator console surfaces.
- Direct mutation routes for `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `memetic_*`, `action_log`, `development_ledger` or lifecycle tables.
- Richer organ ecology, advanced registry health and specialist-organ introspection beyond the already delivered baseline router diagnostics from `F-0008`.
- Actual governor execution of `freeze-development` and similar policy controls before `CF-016` is intaken and shaped.

### Constraints

- `Hono` remains the only canonical HTTP boundary; this seam must not reintroduce framework-owned server/workspace/runtime abstractions forbidden by the current ADR stack.
- `GET /health` remains platform-owned baseline health/readiness surface; `F-0013` may consume or extend diagnostics later, but it must not seize ownership of startup/readiness semantics from `F-0002`/`F-0001`.
- Read routes must consume canonical owner contracts from `F-0003`, `F-0004`, `F-0005`, `F-0008` and later seams; raw table dumps or direct SQL-shaped business payloads are forbidden.
- Control routes must stay owner-routed. API handlers may request work through canonical gates, but they must not directly mutate runtime continuity rows, subject-state tables, model registry state, governor policy state or lifecycle evidence.
- `GET /models` must not fabricate richer model/organ health that belongs to `CF-010`; before those surfaces exist, the endpoint must stay bounded to delivered router diagnostics or explicit degraded/unavailable fields.
- `POST /control/freeze-development` and related policy controls must stay omitted or explicitly unavailable until `CF-016` owns the underlying governor/freeze surfaces.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0013-01:** `F-0013` establishes one canonical owner seam for operator-facing HTTP API beyond phase-0 `GET /health` and beyond already delivered ingress routes: operator introspection and control requests are handled through one Hono boundary instead of ad hoc debug handlers or raw database endpoints.
- **AC-F0013-02:** `GET /state`, `GET /timeline` and `GET /episodes` expose bounded read-only payloads derived from canonical owner seams (`F-0004` for bounded subject-state snapshot, `F-0003` for timeline/episode continuity) and do not introduce direct mutation paths or raw identity-bearing table dumps.
- **AC-F0013-03:** `GET /models` consumes only canonical model-routing and profile diagnostics already owned by `F-0008`, while richer organ ecology and registry-health surfaces remain future-owned by `CF-010`; unavailable richer fields must be explicit rather than fabricated.
- **AC-F0013-04:** `POST /control/tick` and other early safe operator controls route through canonical runtime owner gates and preserve bounded auditability; the HTTP layer must not create ticks or mutate continuity state through side writes.
- **AC-F0013-05:** Governance-sensitive routes such as `POST /control/freeze-development` remain explicitly gated by future `CF-016` ownership: before minimal governor surfaces exist, the API seam must keep those controls absent or return a bounded unavailable/error contract rather than inventing direct governor writes.
- **AC-F0013-06:** `F-0013` preserves ownership separation at the HTTP boundary: it does not become a convenience writer for subject-state, narrative/memetic storage, `action_log`, development ledger, lifecycle evidence or model registry internals, and it does not steal ownership of baseline `GET /health`.

## 4. Non-functional requirements (NFR)

- **Auditability:** Operator control requests must remain attributable to explicit route contracts and downstream owner actions rather than hidden side effects in handlers.
- **Boundedness:** Introspection payloads must stay bounded and owner-shaped, not open-ended dumps of raw JSONB or unpaginated history.
- **Safety:** Control routes must fail closed when their downstream owner seam is unavailable or not yet delivered.
- **Compatibility:** The seam must stay aligned with `AI SDK + Hono` as the canonical runtime stack and avoid framework-specific server abstractions.
- **Operational clarity:** Operator-facing diagnostics must distinguish delivered data from future-owned unavailable/degraded surfaces.

## 5. Design (compact)

### 5.1 API surface

- Planned operator-facing route family:
  - `GET /state`
  - `GET /timeline`
  - `GET /episodes`
  - `GET /models`
  - `POST /control/tick`
- Governance-sensitive routes such as `POST /control/freeze-development` are part of the seam boundary, but they remain explicitly gated on future `CF-016` ownership rather than assumed deliverable by default.
- `GET /health` stays outside this seam as the already delivered platform boundary.

### 5.2 Runtime and deployment surface

- The seam lives inside the existing `core` monolith and reuses the canonical `Hono` boundary.
- Route handlers read through canonical runtime/state/router contracts and submit control intents through existing owner gates.
- No separate API service, sidecar or alternate HTTP runtime is introduced by intake.

### 5.3 Data model changes

- Intake does not assume a new canonical business table.
- Read routes are expected to project from already delivered canonical surfaces (`agent_state` bounded snapshot, `ticks`, `timeline_events`, `episodes`, baseline model-profile diagnostics).
- If later shaping requires dedicated API audit or cursor/read-model helpers, those must be made explicit rather than assumed implicitly by the intake.

### 5.4 Edge cases and failure modes

- Runtime may be active while some future-owned introspection surfaces are unavailable; the API must surface bounded unavailability/degradation rather than fake completeness.
- Large timeline/episode histories require bounded pagination/cursor design; unbounded full-history dumps are not acceptable.
- Control routes must fail closed when downstream runtime/governor gates reject or are not ready.
- Operator API must not silently widen itself into a general-purpose mutation surface just because the server already has DB access.

### 5.5 Verification surface

- Route-contract tests for payload shape, owner routing and unavailable/degraded route semantics.
- Integration tests for read-only introspection routes and bounded control route handoff.
- If implementation changes runtime startup or public route wiring materially inside the deployment cell, containerized smoke becomes mandatory for closure.

## 6. Definition of Done

- `F-0013` is the canonical owner for operator-facing HTTP introspection and bounded control routes beyond phase-0 `GET /health`.
- Read-only routes for state/timeline/episodes/models are explicitly bounded and consume canonical owner surfaces only.
- `POST /control/tick` and similar early controls remain owner-routed and auditable.
- Governance-sensitive controls remain explicitly gated on `CF-016`; the API seam does not invent direct freeze/policy writes.
- The feature does not seize ownership of baseline health, subject-state, narrative/memetic, model registry internals or lifecycle evidence.
- Backlog, architecture coverage and SSOT index remain aligned with the new dossier owner.

## 7. Slicing plan

### Slice SL-F0013-01: Read-only state, timeline and episode introspection
Delivers: bounded `GET /state`, `GET /timeline` and `GET /episodes` route contracts over canonical `F-0003` / `F-0004` read models.
Covers: AC-F0013-01, AC-F0013-02, AC-F0013-06
Verification: `contract`, `integration`
Exit criteria:
- Subject-state, timeline and episode responses stay bounded and owner-shaped.
- No route becomes a raw identity-bearing table dump or direct mutation path.

### Slice SL-F0013-02: Baseline model introspection boundary
Delivers: bounded `GET /models` route over delivered `F-0008` diagnostics with explicit future-owned gaps for richer `CF-010` ecology.
Covers: AC-F0013-03, AC-F0013-06
Verification: `contract`, `integration`
Exit criteria:
- Baseline router/profile diagnostics are exposed without overclaiming future organ-health ownership.
- Missing richer model-health surfaces are explicit and bounded.

### Slice SL-F0013-03: Operator control route handoff and governor gating
Delivers: bounded `POST /control/tick` handoff plus explicit unavailable/gated semantics for `freeze-development`-class routes before `CF-016`.
Covers: AC-F0013-04, AC-F0013-05, AC-F0013-06
Verification: `contract`, `integration`
Exit criteria:
- Control routes call canonical owner gates instead of mutating runtime or governor state directly.
- Governance-sensitive controls remain absent or explicitly unavailable until minimal governor ownership exists.

### Slice SL-F0013-04: Runtime closure and smoke alignment
Delivers: final route wiring, operational closure and containerized smoke when the public runtime boundary changes materially.
Covers: AC-F0013-01, AC-F0013-02, AC-F0013-03, AC-F0013-04, AC-F0013-06
Verification: `integration`, `smoke-if-runtime-path-changes`
Exit criteria:
- Operator route family is wired on the canonical Hono runtime without stealing `GET /health` ownership.
- Deployment-cell smoke is added if runtime/public route behavior changes materially.

## 8. Task list

- **T-F0013-01:** Define bounded route DTOs and handler ownership map for `SL-F0013-01`. Covers: AC-F0013-01, AC-F0013-02.
- **T-F0013-02:** Implement read-only state/timeline/episode route adapters over canonical stores for `SL-F0013-01`. Covers: AC-F0013-02, AC-F0013-06.
- **T-F0013-03:** Define baseline `GET /models` route contract and future-gap semantics for `SL-F0013-02`. Covers: AC-F0013-03.
- **T-F0013-04:** Implement bounded `POST /control/tick` handoff and unavailable/gated control semantics for `SL-F0013-03`. Covers: AC-F0013-04, AC-F0013-05, AC-F0013-06.
- **T-F0013-05:** Add route contract/integration coverage for read-only introspection and owner-gated controls. Covers: AC-F0013-01, AC-F0013-02, AC-F0013-03, AC-F0013-04, AC-F0013-05, AC-F0013-06.
- **T-F0013-06:** Align deployment-cell smoke if route wiring changes runtime/public boundary behavior. Covers: AC-F0013-01, AC-F0013-04, AC-F0013-06.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0013-01 | `apps/core/test/api/operator-api-boundary.contract.test.ts` → operator route family ownership `// Covers: AC-F0013-01` | planned |
| AC-F0013-02 | `apps/core/test/api/operator-state.integration.test.ts` → `GET /state` / `GET /timeline` / `GET /episodes` bounded read-model coverage `// Covers: AC-F0013-02` | planned |
| AC-F0013-03 | `apps/core/test/api/operator-models.integration.test.ts` → bounded baseline model diagnostics and future-gap semantics `// Covers: AC-F0013-03` | planned |
| AC-F0013-04 | `apps/core/test/api/operator-control.integration.test.ts` → `POST /control/tick` owner-gated handoff `// Covers: AC-F0013-04` | planned |
| AC-F0013-05 | `apps/core/test/api/operator-governor-gating.contract.test.ts` → `freeze-development` unavailable/gated semantics before `CF-016` `// Covers: AC-F0013-05` | planned |
| AC-F0013-06 | `apps/core/test/api/operator-api-boundary.contract.test.ts` → no foreign write authority and no `GET /health` ownership grab `// Covers: AC-F0013-06`; `infra/docker/deployment-cell.smoke.ts` → operator boundary smoke when runtime route wiring changes `// Covers: AC-F0013-06` | planned |

## 10. Decision log (ADR blocks)

### ADR-F0013-01: Operator API is a read/control boundary, not an alternate business-state writer
- Status: Accepted
- Date: 2026-03-25
- Context: The server already has direct access to runtime and database surfaces, so richer operator routes could easily degenerate into convenience writes or raw SQL-shaped debug endpoints.
- Decision: Keep `F-0013` as the owner of HTTP route contracts, read-model assembly and bounded control handoff only. Do not grant this seam direct business/state/governor write authority.
- Alternatives: Treat operator routes as thin direct DB endpoints; fold the API seam into whichever downstream owner already has the data.
- Consequences: Operator surface stays coherent while canonical ownership remains with runtime/state/router/governor seams.

### ADR-F0013-02: Governance-sensitive control routes stay explicitly gated until governor ownership exists
- Status: Accepted
- Date: 2026-03-25
- Context: Architecture names `POST /control/freeze-development` as part of the eventual external API, but `CF-016` is still only a backlog seam and no delivered governor write surface exists yet.
- Decision: Record governance-sensitive control routes as part of the API boundary, but keep them absent or explicitly unavailable until `CF-016` owns the underlying governor/freeze path.
- Alternatives: Deliver the route now with ad hoc writes; postpone the route without documenting the boundary.
- Consequences: The API seam can be intaken now without manufacturing fake governor ownership.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Candidate source: `CF-009`
- Delivered prerequisites: `F-0001`, `F-0003`, `F-0004`, `F-0005`, `F-0008`
- Code:
  - None yet; shaping targets are expected in `apps/core/src/platform` or `apps/core/src/server` route surfaces plus operator-facing integration tests.
- Verification:
  - `node scripts/index-refresh.mjs`
  - `node scripts/lint-dossiers.mjs`
  - `node scripts/coverage-audit.mjs --dossier docs/features/F-0013-operator-http-api-and-introspection.md --orphans-scope=dossier`
  - `pnpm debt:audit:changed`
  - `node scripts/dossier-verify.mjs --dossier docs/features/F-0013-operator-http-api-and-introspection.md --step feature-intake`

## 12. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-009`; intake fixes one canonical owner for operator-facing HTTP introspection and bounded control routes, while explicitly keeping richer model ecology with `CF-010`, governance-sensitive controls with `CF-016`, and baseline health ownership outside this seam.
