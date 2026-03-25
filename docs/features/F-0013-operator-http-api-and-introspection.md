---
id: F-0013
title: HTTP API управления и интроспекции
status: planned
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
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0013 HTTP API управления и интроспекции

## 1. Context & Goal

- **User problem:** После поставки `F-0001`, `F-0003`, `F-0004`, `F-0005` и `F-0008` система уже имеет canonical runtime/state/perception/model surfaces, но operator-facing HTTP boundary по-прежнему intentionally ограничена `GET /health` и `POST /ingest`. Без явного shaped owner-а richer operator API быстро расползается либо в raw SQL/JSON debug endpoints, либо в control backdoor, который начинает обходить runtime/governor/state owners и напрямую писать в чужие surfaces.
- **Goal:** Зафиксировать один canonical dossier-owner для operator-facing Hono boundary beyond minimal health/ingest: `F-0013` должен владеть bounded route contracts, DTOs, pagination/idempotency semantics и owner-routed control handoff, не захватывая ownership над platform health, runtime admission, subject-state writes, model-registry internals или governor execution.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0001` boot/recovery activation, `F-0003` tick runtime and timeline continuity, `F-0004` bounded subject-state snapshot, `F-0005` ingress boundary and `F-0008` baseline model routing diagnostics. Current Hono runtime already serves `GET /health` and `POST /ingest`; richer operator routes are not yet delivered. Tick runtime currently accepts canonical triggers `boot | scheduler | system`, so operator control cannot invent a new trigger taxonomy inside this seam.
- **Non-goals:** Public authN/authZ, perimeter hardening, dashboards/streaming UI, direct business-state mutation routes, mature governor execution, richer model-registry health and baseline-health ownership are outside this dossier.

## 2. Scope

### In scope

- Canonical owner for operator-facing HTTP route family beyond phase-0 `GET /health` and beyond already delivered `POST /ingest`.
- One bounded route contract family on the existing `Hono` boundary:
  - `GET /state`
  - `GET /timeline`
  - `GET /episodes`
  - `GET /models`
  - `POST /control/tick`
  - `POST /control/freeze-development` as an explicit unavailable future-owned control surface
- Bounded response DTOs, pagination/cursor semantics and error contracts for operator routes.
- Owner-routed control handoff semantics for `POST /control/tick`, including idempotent `requestId` behavior and explicit mapping of runtime admission rejections.
- Explicit provenance policy for operator-requested ticks that preserves current `F-0003` trigger taxonomy instead of silently extending it.
- Explicit future-gap contract for richer model ecology (`CF-010`) and governor-backed controls (`CF-016`).

### Out of scope

- Public authN/authZ, rate limiting, stronger perimeter controls and human-override security policy; these remain future work aligned with `CF-014`.
- Dashboard/UI delivery, websockets, SSE, streaming consoles or external operator workbenches.
- New direct business-state mutation routes for `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `memetic_*`, `action_log`, `development_ledger`, lifecycle evidence or model-registry internals.
- Richer organ ecology, organ error rates, registry-health diagnostics and specialist-organ introspection beyond baseline `F-0008` diagnostics; those remain `CF-010`.
- Real `freeze-development` execution, governor policy writes, proposal admission or development-ledger ownership before `CF-016`.
- New public routes such as `GET /episodes/:id`, `GET /actions`, bulk exports or arbitrary query surfaces not named in the intake.

### Constraints

- `Hono` remains the only canonical HTTP boundary. `F-0013` may modularize route wiring inside that runtime, but it must not introduce a second API framework, sidecar service or framework-owned server surface.
- `GET /health` remains platform-owned baseline health/readiness surface from `F-0002` / `F-0001`, enriched by delivered seams such as `F-0008`; `F-0013` must not seize ownership of startup/readiness semantics.
- Read routes must consume only canonical owner surfaces and return bounded DTOs. Raw row/table dumps, ad hoc SQL-shaped payloads and alternate shadow read models are forbidden.
- `POST /control/tick` must route only through the existing runtime owner gate (`F-0003`). The HTTP seam may not create ticks or mutate continuity rows by direct DB writes.
- Because the canonical tick trigger taxonomy is currently `boot | scheduler | system`, operator-triggered ticks in this seam must reuse the existing `system` trigger and carry operator provenance in the request payload/metadata. Introducing a new runtime trigger is out of scope for `F-0013`.
- `GET /models` must stay bounded to delivered `F-0008` diagnostics and explicit future-gap markers. It must not fabricate richer health that belongs to `CF-010`.
- `POST /control/freeze-development` must remain explicitly unavailable until `CF-016` owns the underlying governor/freeze surfaces; this seam may not invent direct governor writes or hidden backdoors.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0013-01:** `F-0013` establishes one canonical owner seam for operator-facing HTTP API beyond phase-0 `GET /health` and beyond already delivered ingress routes: operator introspection and bounded control requests are handled through one Hono boundary with explicit DTO contracts instead of ad hoc debug handlers or raw database endpoints.
- **AC-F0013-02:** `GET /state` returns a bounded read-only representation derived from the canonical `F-0004` subject-state snapshot contract, including `subjectStateSchemaVersion`, bounded agent-state fields and bounded goal/belief/entity/relationship slices; it must not expose identity-bearing tables as raw dumps or create any mutation path.
- **AC-F0013-03:** `GET /timeline` and `GET /episodes` expose bounded, stable-order read-only list contracts over `F-0003` continuity surfaces with explicit `limit` and cursor semantics, stable ordering keys, and machine-readable truncation/page metadata; they must not provide unbounded history dumps or bypass canonical event/episode contracts.
- **AC-F0013-04:** `GET /models` consumes only canonical baseline routing/profile diagnostics already owned by `F-0008`; richer model ecology and registry health remain future-owned by `CF-010`, and those absent capabilities must surface as explicit unavailable/degraded fields rather than fabricated data.
- **AC-F0013-05:** `POST /control/tick` routes through the canonical `F-0003` runtime request gate with a required caller-supplied `requestId`, explicit HTTP mapping for `accepted`, `boot_inactive`, `lease_busy` and `unsupported_tick_kind`, and deterministic idempotent replay for repeated `requestId` submissions; the HTTP layer preserves operator provenance without introducing a new tick trigger taxonomy or direct state writes.
- **AC-F0013-06:** Governance-sensitive routes such as `POST /control/freeze-development` remain explicitly future-owned by `CF-016`: before minimal governor surfaces exist, the route returns a bounded unavailable contract rather than silently mutating governor state or pretending the capability exists.
- **AC-F0013-07:** `F-0013` preserves ownership separation at the HTTP boundary: it does not become a convenience writer for subject-state, narrative/memetic storage, `action_log`, development ledger, lifecycle evidence, model-registry internals or baseline `GET /health`.
- **AC-F0013-08:** Route wiring stays on the canonical `AI SDK + Hono + core monolith` runtime path; if implementation materially changes public route wiring or runtime startup behavior, the deployment-cell smoke path becomes mandatory for closure.

## 4. Non-functional requirements (NFR)

- **Auditability:** Operator control requests must remain attributable to explicit route contracts, canonical `requestId` and downstream runtime/governor owner actions rather than hidden side effects in handlers.
- **Boundedness:** Introspection payloads must remain bounded by explicit limits/cursors and owner-shaped DTOs, not open-ended JSONB or full-history dumps.
- **Safety:** Control routes must fail closed when downstream owners are unavailable, not yet delivered or reject the request.
- **Determinism:** The same canonical source state and the same `requestId` must produce the same route-level read shape and idempotent control outcome.
- **Operational clarity:** Route contracts must distinguish delivered data from future-owned unavailable/degraded surfaces without misleading clients into assuming maturity that does not exist yet.

## 5. Design (compact)

### 5.1 HTTP contract surface

- `GET /state`
  - Source owner: `F-0004`
  - Query contract: optional bounded overrides `goalLimit`, `beliefLimit`, `entityLimit`, `relationshipLimit`; implementation may clamp or reject values above canonical safe maxima instead of widening the snapshot.
  - Response contract:

```ts
type OperatorStateResponse = {
  generatedAt: string;
  snapshot: {
    subjectStateSchemaVersion: string;
    agentState: {
      agentId: string;
      mode: "inactive" | "normal" | "degraded" | "recovery";
      currentTickId: string | null;
      currentModelProfileId: string | null;
      lastStableSnapshotId: string | null;
      psmJson: Record<string, unknown>;
      resourcePostureJson: Record<string, unknown>;
    };
    goals: unknown[];
    beliefs: unknown[];
    entities: unknown[];
    relationships: unknown[];
  };
  bounds: {
    goalLimit: number;
    beliefLimit: number;
    entityLimit: number;
    relationshipLimit: number;
  };
};
```

- `GET /timeline`
  - Source owner: `F-0003`
  - Query contract: `limit` plus opaque cursor derived from stable descending order `(occurredAt, sequenceId)`.
  - Response contract:

```ts
type OperatorTimelineResponse = {
  items: Array<{
    sequenceId: string;
    eventId: string;
    eventType: string;
    occurredAt: string;
    subjectRef: string;
    payload: Record<string, unknown>;
  }>;
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};
```

- `GET /episodes`
  - Source owner: `F-0003`
  - Query contract: `limit` plus opaque cursor derived from stable descending order `(createdAt, episodeId)`.
  - Response contract:

```ts
type OperatorEpisodesResponse = {
  items: Array<{
    episodeId: string;
    tickId: string;
    summary: string;
    resultJson: Record<string, unknown>;
    createdAt: string;
  }>;
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};
```

- `GET /models`
  - Source owner: `F-0008`
  - Response contract:

```ts
type OperatorModelsResponse = {
  baselineProfiles: Array<{
    modelProfileId: string;
    role: "reflex" | "deliberation" | "reflection";
    status: "active" | "degraded" | "disabled";
    adapterOf: string | null;
    baseModel: string;
    healthSummary: {
      healthy: boolean;
      detail?: string;
    };
  }>;
  richerRegistryHealth: {
    available: false;
    owner: "CF-010";
    reason: "future_owned";
  };
};
```

- `POST /control/tick`
  - Downstream owner: `F-0003`
  - Request contract:

```ts
type OperatorTickControlRequest = {
  requestId: string;
  kind:
    | "reactive"
    | "deliberative"
    | "contemplative"
    | "consolidation"
    | "developmental";
  note?: string;
  payload?: Record<string, unknown>;
};
```

  - Internal routing rule: HTTP layer always maps this to the existing runtime trigger `system` and injects operator provenance metadata such as `requestedBy: "operator_api"` and `route: "/control/tick"` into the forwarded payload. `F-0013` does not extend the canonical `TickTrigger` enum.
  - Response contract:

```ts
type OperatorTickAccepted = {
  accepted: true;
  requestId: string;
  requestedKind: OperatorTickControlRequest["kind"];
  routedTrigger: "system";
};

type OperatorTickRejected = {
  accepted: false;
  requestId: string;
  requestedKind: OperatorTickControlRequest["kind"];
  reason: "boot_inactive" | "lease_busy" | "unsupported_tick_kind";
};
```

  - HTTP mapping:
    - `202` for accepted and request-id dedupe replay
    - `400` for schema-invalid payloads, including missing `requestId`
    - `409` for `lease_busy`
    - `422` for `unsupported_tick_kind`
    - `503` for `boot_inactive`

- `POST /control/freeze-development`
  - Future owner: `CF-016`
  - Response contract before `CF-016` delivery:

```ts
type OperatorUnavailableControlResponse = {
  available: false;
  action: "freeze-development";
  owner: "CF-016";
  reason: "future_owned";
};
```

  - HTTP mapping: `501` until the governor seam exists.

### 5.2 Runtime and deployment surface

- `F-0013` lives inside the existing `core` monolith and reuses the canonical `Hono` app already serving `GET /health` and `POST /ingest`.
- The seam should factor operator routes as one bounded module or route family instead of growing unrelated handlers inline across the runtime.
- Read handlers must call canonical owner adapters only:
  - `F-0004` bounded subject-state snapshot for `/state`;
  - `F-0003` timeline/episode stores or explicit read adapters for `/timeline` and `/episodes`;
  - `F-0008` baseline diagnostics for `/models`.
- `POST /control/tick` calls `runtimeLifecycle.requestTick(...)` and never reaches around that boundary into tick tables or scheduler internals.
- `GET /health` stays platform-owned even though it shares the same Hono app instance.
- If implementation materially changes public route wiring or startup/runtime behavior, `pnpm smoke:cell` is mandatory at feature closure.

### 5.3 Data model changes

- This shaping step does not require a new business table by default.
- Expected persistence/read-model usage:
  - `/state` projects from the existing bounded subject-state snapshot contract;
  - `/episodes` projects from canonical `episodes`;
  - `/timeline` requires an explicit bounded timeline-list store contract over `timeline_events`, not ad hoc SQL inside handlers;
  - `/models` projects from baseline profile diagnostics already shaped by `F-0008`.
- `POST /control/tick` relies on the existing tick `request_id` idempotency semantics and the existing runtime request payload. Operator provenance should be stored in that forwarded request payload/metadata rather than by introducing a new tick trigger or a shadow API audit table in this feature.
- If implementation later needs dedicated API-specific cursors or helper indexes for timeline/episode pagination, those changes must stay subordinate to canonical owner stores and be made explicit in the implementation slice instead of silently becoming a new API-owned read-model subsystem.

### 5.4 Route-to-owner mapping and ownership boundaries

- `/state` is a read-only projection over `F-0004`; it must not become a writable patch surface.
- `/timeline` and `/episodes` are read-only projections over `F-0003`; they must not redefine event or episode semantics outside the canonical runtime continuity boundary.
- `/models` is a bounded projection over `F-0008`; it may expose baseline profile diagnostics but not richer `CF-010` ecology.
- `/control/tick` is an operator transport into `F-0003`, not an alternate runtime engine.
- `/control/freeze-development` is an explicit unavailable placeholder for the future `CF-016` control seam, not an early governor implementation.
- `/health` remains owned by platform/runtime seams and is intentionally outside this dossier even though it sits in the same Hono namespace.

### 5.5 Edge cases and failure modes

- Invalid or oversized cursor/query-limit values must fail with bounded request errors rather than silently widening the read surface.
- `POST /control/tick` without `requestId` must fail request validation rather than letting the server invent ad hoc idempotency semantics.
- Repeated `POST /control/tick` submissions with the same `requestId` must remain idempotent and return the canonical accepted response shape instead of creating duplicate ticks.
- `GET /models` may have baseline diagnostics available while richer registry health remains unavailable; the route must represent that split explicitly in-band.
- `POST /control/tick` may legitimately reject `deliberative`, `contemplative`, `consolidation` or `developmental` kinds with `unsupported_tick_kind` until neighbouring seams deliver support; the API must not hide or remap that refusal.
- `POST /control/freeze-development` must return the explicit unavailable contract before `CF-016`; 404-style silent absence is no longer the preferred shaped behavior.
- Route handlers must not degrade into direct DB writes just because the server process already has database access.

### 5.6 Verification surface

- Contract tests for route DTOs, cursor/status mapping, and no-foreign-write boundary behavior.
- Integration tests for:
  - `GET /state` bounded snapshot projection;
  - `GET /timeline` stable pagination and cursor semantics;
  - `GET /episodes` stable pagination and canonical episode contract projection;
  - `GET /models` baseline diagnostics plus explicit future-gap marker;
  - `POST /control/tick` accepted and rejected handoff semantics, including idempotent `requestId` replay;
  - `POST /control/freeze-development` explicit unavailable contract before `CF-016`.
- If implementation changes the public Hono route wiring materially, deployment-cell smoke is mandatory before feature closure.

## 6. Definition of Done

- `F-0013` is the canonical owner for operator-facing HTTP introspection and bounded control routes beyond phase-0 `GET /health`.
- `GET /state`, `GET /timeline`, `GET /episodes` and `GET /models` have explicit bounded DTO contracts, owner mappings and pagination/degradation semantics.
- `POST /control/tick` is shaped as an owner-routed handoff through `F-0003` with required `requestId`, idempotent replay behavior and explicit rejection mapping.
- Operator tick control does not extend the canonical runtime trigger taxonomy; operator provenance is preserved through forwarded payload/metadata instead.
- `POST /control/freeze-development` is explicitly unavailable and future-owned by `CF-016`, not silently absent or prematurely implemented.
- The feature does not seize ownership of baseline health, subject-state writes, narrative/memetic writes, model-registry internals, development ledger or lifecycle evidence.
- Architecture coverage and SSOT index remain aligned with the shaped owner boundary.

## 7. Slicing plan

### Slice SL-F0013-01: Read-only state, timeline and episode contracts
Delivers: bounded route DTOs, query validation and explicit owner adapters for `GET /state`, `GET /timeline` and `GET /episodes`, including the missing timeline/episode pagination adapter boundary over existing `F-0003` stores.
Covers: AC-F0013-01, AC-F0013-02, AC-F0013-03, AC-F0013-07
Verification: `apps/core/test/platform/operator-api-boundary.contract.test.ts`, `apps/core/test/platform/operator-state.integration.test.ts`, `apps/core/test/platform/operator-history.integration.test.ts`
Exit criteria:
- State/timeline/episode responses stay bounded and owner-shaped.
- Timeline and episode list routes use stable ordering and explicit cursor semantics instead of unbounded full-history dumps.
- Timeline listing is implemented through one explicit store/adapter boundary rather than ad hoc SQL in handlers.
Tasks:
- `T-F0013-01`
- `T-F0013-02`

### Slice SL-F0013-02: Baseline model introspection boundary
Delivers: bounded `GET /models` route over delivered `F-0008` diagnostics with explicit future-gap semantics for `CF-010`, plus the required realignment of delivered `F-0008` assumptions that currently treat `/models` as absent.
Covers: AC-F0013-04, AC-F0013-07
Verification: `apps/core/test/platform/operator-models.integration.test.ts`, linked `change-proposal` / realignment for `F-0008`
Exit criteria:
- Baseline router/profile diagnostics are exposed without overclaiming richer registry ownership.
- Missing richer model-health surfaces are explicit, machine-readable and bounded.
- The delivered `F-0008` assumption “health is enriched without opening `/models`” is realigned canonically before or together with route delivery, not left as a hidden contradiction.
Tasks:
- `T-F0013-03`
- `T-F0013-04`

### Slice SL-F0013-03: Operator tick handoff and future-owned governor gating
Delivers: bounded `POST /control/tick` handoff, request-id idempotency, operator-provenance forwarding and explicit `POST /control/freeze-development` unavailable contract.
Covers: AC-F0013-05, AC-F0013-06, AC-F0013-07
Verification: `apps/core/test/platform/operator-control.integration.test.ts`, `apps/core/test/platform/operator-governor-gating.contract.test.ts`
Exit criteria:
- `POST /control/tick` calls the canonical runtime gate and preserves the existing trigger taxonomy.
- Governance-sensitive control remains explicit but unavailable until `CF-016`.
Tasks:
- `T-F0013-05`
- `T-F0013-06`

### Slice SL-F0013-04: Runtime closure and smoke alignment
Delivers: final route wiring, operator module closure and deployment-cell smoke coverage if the public runtime boundary changes materially.
Covers: AC-F0013-01, AC-F0013-08
Verification: `apps/core/test/platform/operator-api-boundary.contract.test.ts`, `infra/docker/deployment-cell.smoke.ts` when runtime/public boundary changes materially
Exit criteria:
- Operator route family is wired on the canonical Hono runtime without stealing `/health`.
- Smoke coverage is present if implementation materially changes startup/public route behavior.
- Existing delivered tests or dossiers that assumed operator routes were absent are explicitly realigned instead of silently patched.
Tasks:
- `T-F0013-07`
- `T-F0013-08`

## 8. Task list

- **T-F0013-01 (SL-F0013-01):** Define route DTOs, query schemas and owner mapping for `GET /state`, `GET /timeline` and `GET /episodes`. Covers: AC-F0013-01, AC-F0013-02, AC-F0013-03.
- **T-F0013-02 (SL-F0013-01):** Add bounded read adapters for timeline and episode pagination plus state snapshot projection without raw table dumps. Covers: AC-F0013-02, AC-F0013-03, AC-F0013-07.
- **T-F0013-03 (SL-F0013-02):** Define the bounded `GET /models` contract over `F-0008` diagnostics and explicit `CF-010` future-gap semantics. Covers: AC-F0013-04.
- **T-F0013-04 (SL-F0013-02):** Realign delivered `F-0008` `/models`-absence assumption through an explicit linked change-proposal/update before enabling the new operator route. Covers: AC-F0013-04, AC-F0013-07.
- **T-F0013-05 (SL-F0013-03):** Implement `POST /control/tick` request/response mapping, required `requestId` validation, forwarded operator provenance and request-id idempotency handling over the canonical runtime gate. Covers: AC-F0013-05.
- **T-F0013-06 (SL-F0013-03):** Implement explicit unavailable semantics for `POST /control/freeze-development` before `CF-016`. Covers: AC-F0013-06.
- **T-F0013-07 (SL-F0013-04):** Add contract/integration coverage for bounded introspection, control rejection mapping and no-foreign-write boundaries. Covers: AC-F0013-01, AC-F0013-02, AC-F0013-03, AC-F0013-04, AC-F0013-05, AC-F0013-06, AC-F0013-07.
- **T-F0013-08 (SL-F0013-04):** Align public route wiring, delivered-route realignment and deployment-cell smoke if implementation materially changes startup/runtime public behavior. Covers: AC-F0013-08.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0013-01 | `apps/core/test/platform/operator-api-boundary.contract.test.ts` → operator route family ownership and route registration `// Covers: AC-F0013-01` | planned |
| AC-F0013-02 | `apps/core/test/platform/operator-state.integration.test.ts` → bounded `GET /state` snapshot projection `// Covers: AC-F0013-02` | planned |
| AC-F0013-03 | `apps/core/test/platform/operator-history.integration.test.ts` → `GET /timeline` / `GET /episodes` stable pagination and cursor semantics `// Covers: AC-F0013-03` | planned |
| AC-F0013-04 | `apps/core/test/platform/operator-models.integration.test.ts` → bounded baseline model diagnostics and explicit `CF-010` future-gap contract `// Covers: AC-F0013-04` | planned |
| AC-F0013-05 | `apps/core/test/platform/operator-control.integration.test.ts` → `POST /control/tick` required-requestId validation, accepted/rejected mapping and request-id idempotency `// Covers: AC-F0013-05` | planned |
| AC-F0013-06 | `apps/core/test/platform/operator-governor-gating.contract.test.ts` → `POST /control/freeze-development` explicit unavailable contract before `CF-016` `// Covers: AC-F0013-06` | planned |
| AC-F0013-07 | `apps/core/test/platform/operator-api-boundary.contract.test.ts` → no foreign write authority and no `/health` ownership grab `// Covers: AC-F0013-07` | planned |
| AC-F0013-08 | `infra/docker/deployment-cell.smoke.ts` → operator boundary smoke when public route wiring materially changes `// Covers: AC-F0013-08` | planned |

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
- Decision: Record governance-sensitive control routes as part of the API boundary, but keep them unavailable until `CF-016` owns the underlying governor/freeze path.
- Alternatives: Deliver the route now with ad hoc writes; postpone the route without documenting the boundary.
- Consequences: The API seam can be shaped now without manufacturing fake governor ownership.

### ADR-F0013-03: Operator tick control reuses the canonical runtime trigger taxonomy
- Status: Accepted
- Date: 2026-03-25
- Context: The current runtime trigger taxonomy delivered by `F-0003` is `boot | scheduler | system`; adding `operator` as a new trigger inside the API seam would silently reopen runtime taxonomy ownership.
- Decision: `POST /control/tick` forwards requests through the existing runtime `system` trigger and records operator provenance in request payload/metadata rather than extending `TickTrigger` in this dossier.
- Alternatives: Add a new `operator` trigger now; hide operator provenance completely.
- Consequences: `F-0013` remains an operator transport boundary, while `F-0003` retains ownership of runtime trigger taxonomy.

### ADR-F0013-04: Pre-governor control route is explicit unavailable, not silent 404
- Status: Accepted
- Date: 2026-03-25
- Context: After intake, the seam already names `POST /control/freeze-development` as part of the future operator namespace. Leaving it silently absent until `CF-016` would force operators and tests to reverse-engineer whether the route is missing by accident or by ownership policy.
- Decision: Before `CF-016` exists, the route remains present as an explicit unavailable contract returning `501` plus future-owner metadata.
- Alternatives: Keep the route omitted with `404`; deliver a temporary ad hoc freeze action.
- Consequences: Clients receive a machine-readable ownership boundary without granting early governor capability.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Candidate source: `CF-009`
- Delivered prerequisites: `F-0001`, `F-0003`, `F-0004`, `F-0005`, `F-0008`
- Code:
  - None yet; implementation targets are expected in `apps/core/src/platform` Hono route surfaces plus operator-facing contract/integration tests.
- Verification:
  - `node scripts/index-refresh.mjs`
  - `node scripts/contract-drift-audit.mjs --dossier docs/features/F-0013-operator-http-api-and-introspection.md --base HEAD~1`
  - `node scripts/lint-dossiers.mjs`
  - `node scripts/coverage-audit.mjs --dossier docs/features/F-0013-operator-http-api-and-introspection.md --orphans-scope=dossier`
  - `pnpm debt:audit:changed`
  - `node scripts/dossier-verify.mjs --dossier docs/features/F-0013-operator-http-api-and-introspection.md --step plan-slice`

## 12. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-009`; intake fixed one canonical owner for operator-facing HTTP introspection and bounded control routes, while explicitly keeping richer model ecology with `CF-010`, governance-sensitive controls with `CF-016`, and baseline health ownership outside this seam.
- **v1.1 (2026-03-25):** `spec-compact` shaped the operator API into implementation-grade route contracts: bounded DTOs, pagination/cursor rules, explicit control rejection mapping, operator provenance over the existing `system` trigger, and an explicit unavailable contract for pre-`CF-016` `freeze-development`.
- **v1.2 (2026-03-25):** `plan-slice` translated the shaped operator boundary into delivery-ordered slices with explicit verification targets and made the required `F-0008` `/models` realignment a first-class planned task instead of a hidden follow-up.
