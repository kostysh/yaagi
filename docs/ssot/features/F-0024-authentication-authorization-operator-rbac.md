---
id: F-0024
title: Аутентификация, авторизация и operator RBAC
status: planned
coverage_gate: deferred
backlog_item_key: CF-024
owners: ["@codex"]
area: security
depends_on: ["F-0002", "F-0013"]
impacts: ["api", "security", "governance", "runtime"]
created: 2026-04-23
updated: 2026-04-23
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
    - "docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md"
    - "docs/ssot/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/ssot/features/F-0016-development-governor-and-change-management.md"
    - "docs/ssot/features/F-0018-security-and-isolation-profile.md"
---

# F-0024 Аутентификация, авторизация и operator RBAC

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-024
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-020
    - CF-009
- **User problem:** `F-0013` уже delivered one Hono operator route family for bounded introspection and selected control handoff, but it intentionally keeps public authN/authZ, RBAC and caller admission out of scope. `F-0018` hardens trusted paths, but it also explicitly does not decide who the caller is or which route the caller may use. Without `CF-024`, the operator API remains a trusted-local boundary: public exposure, high-risk route enablement, support procedures and later governance closure cannot truthfully claim safe caller admission.
- **Goal:** Define one canonical owner seam for operator identity, authentication, authorization, route-level permissions, RBAC, rate limiting and request provenance on the existing `F-0013` Hono boundary. The seam must fail closed by default, distinguish read-only introspection from control/governor/human-override paths, and provide trusted caller-admission evidence that downstream owners can consume without creating a second API gateway or a second approval ledger.
- **Non-goals:** This feature does not create a new HTTP gateway or UI, does not redefine `F-0013` route ownership, does not write governor decisions/proposals owned by `F-0016`, does not implement `F-0018` perimeter/safety-kernel policy, does not implement deploy/release/rollback orchestration (`CF-025`), support runbooks (`CF-026`) or late policy profiles/consultant admission (`CF-027`), and does not grant direct write authority to identity-bearing runtime/state surfaces.
- **Current substrate / baseline:** `F-0002` provides the canonical `Node 22 + TypeScript + AI SDK + Hono + PostgreSQL` deployment cell. `F-0013` provides the operator Hono namespace and explicit unavailable contracts for high-risk routes until caller admission exists. `F-0016` provides governor-owned freeze/proposal semantics behind owner gates. `F-0018` provides mature perimeter hardening over already-trusted paths and keeps public caller admission assigned to `CF-024`.

### Terms & thresholds

- `operator principal`: one authenticated caller identity admitted to operator APIs; it is not the agent identity and never becomes a second subject.
- `credential`: secret-bearing material used to authenticate an operator principal; raw credential material must never be persisted in dossier prose, logs, report payloads or audit events.
- `operator session`: bounded authenticated request context derived from a principal, credential proof, expiry and revocation state.
- `role`: coarse-grained RBAC assignment such as `observer`, `operator`, `governor_operator`, `admin` or `breakglass_admin`.
- `route permission`: explicit allow/deny capability for one HTTP route/action family, optionally constrained by method, route, risk class and owner seam.
- `caller admission`: the combined authN/authZ decision that a request is from a known principal and is permitted to enter a route owner contract.
- `trusted ingress evidence`: request-local evidence that caller admission passed; downstream seams may validate it read-only but may not treat it as a human approval or governor decision.
- `high-risk operator route`: any route that can request freeze, development proposal submission, rollback-adjacent action, human override or future privileged control.

## 2. Scope

### In scope

- Authentication middleware and request context for the existing `F-0013` Hono operator route family.
- Operator principal model, credential verification contract, session/token expiry, revocation and secret-redaction rules.
- Route-level authorization and RBAC matrix for:
  - read-only introspection routes: `GET /state`, `GET /timeline`, `GET /episodes`, `GET /models`;
  - bounded runtime control: `POST /control/tick`;
  - high-risk reserved routes: `POST /control/freeze-development`, `POST /control/development-proposals`;
  - future routes admitted only by explicit owner realignment.
- Fail-closed default posture for unauthenticated, expired, revoked, unknown-role, missing-permission and unsupported-route requests.
- Rate limiting and replay/idempotency interaction at the caller-admission boundary, without replacing `F-0013` `requestId` semantics for tick control.
- Operator provenance propagation into downstream owner calls as bounded metadata/evidence refs.
- Audit event contract for auth decisions and authorization denials, including principal/session/request refs without plaintext credentials.
- Compatibility contract for `F-0018`: it may consume `trusted ingress evidence` as admission proof for already-admitted paths, but not as approval authority.

### Out of scope

- A second HTTP server, reverse proxy, gateway, OAuth provider sidecar or framework-owned security control plane.
- Dashboard/UI, external operator workbench, account-management UI or self-service credential issuance.
- General perimeter hardening, safety-kernel policy, restricted shell/egress rules, secret publication guards and stronger human gates already owned by `F-0018`.
- Governor proposal/freeze decision writes, durable proposal lifecycle, freeze state and execution outcomes owned by `F-0016`.
- Deploy/release/rollback execution, rollback orchestration and release promotion owned by `CF-025`.
- Support/on-call procedures, incident taxonomy and operational runbooks owned by `CF-026`.
- Policy profiles, consultant admission and broader phase-6 governance completion owned by `CF-027`.
- Direct writes to `agent_state`, tick lifecycle rows, subject-state tables, `model_registry`, `development_ledger`, lifecycle evidence or owner source tables.

### Constraints

- `Hono` remains the only canonical HTTP ingress/operator boundary. `F-0024` adds admission middleware and authorization contracts to that boundary; it must not route around `F-0013`.
- Route ownership stays unchanged: `F-0013` owns route registration/DTO contracts; `F-0024` owns caller admission and permission verdicts; downstream owners keep durable side-effect semantics.
- Missing or invalid caller admission fails closed before downstream owner invocation.
- High-risk routes must remain unavailable unless both their downstream owner seam and `F-0024` caller admission/permission checks are present. `F-0024` alone must not make freeze/proposal routes execute.
- Authentication and authorization evidence must be auditable without persisting plaintext credentials or reusable tokens.
- Operator provenance must not create a new runtime trigger taxonomy, a second approval ledger, or direct business-state write access.
- Any implementation that changes public route wiring, startup behavior, environment contract or deployment exposure must run `pnpm format`, `pnpm typecheck`, `pnpm lint` and `pnpm smoke:cell` before implementation closure.

### Assumptions

- First implementation may use a local/static credential source or repository-local secret-file contract if it preserves the same principal/session/permission semantics and redaction rules.
- `F-0013` route contracts are already stable enough for `F-0024` to wrap them without reshaping the route family.
- `F-0016` has delivered governor-owned freeze/proposal semantics, but public high-risk submission remains blocked until caller admission exists.
- No backlog actualization is required during `spec-compact`: `CF-024` already owns the selected auth/RBAC seam and dependency set remains `CF-020`, `CF-009`.

### Open questions

- Resolved by `plan-slice`: the first implementation uses a mounted/static operator-principal file for credential verification plus PostgreSQL-backed auth audit events. It does not expose a public admin/bootstrap API.
- Resolved by `plan-slice`: the first token shape is an opaque bearer API key checked by non-reusable hash/fingerprint; no plaintext token is persisted in config examples, logs, audit events, reports or tests.

### Plan-slice decisions

- **PD-F0024-01:** Plan mode was assessed and not required before this `plan-slice`. The owner boundary is already fixed by `spec-compact`; no competing scope split, cross-cutting ADR or deployment topology choice remains unresolved.
- **PD-F0024-02:** First implementation target is a complete fail-closed caller-admission seam around the existing Hono operator route family, not a partial optional auth helper. Missing/corrupt auth config makes protected operator routes unavailable/denied before handler execution.
- **PD-F0024-03:** Credential source for the first slice is a versioned mounted/static principal file referenced from runtime config. Records contain principal refs, role assignments, credential hash/fingerprint metadata, expiry and revocation fields; raw credentials are never committed or emitted.
- **PD-F0024-04:** Durable audit evidence is PostgreSQL-backed through `F-0024`-owned auth audit tables. If an allow/deny decision cannot be recorded, protected routes fail closed instead of invoking downstream owners.
- **PD-F0024-05:** `/reports`, delivered by `F-0023` on the operator surface, is classified as read-only operator introspection for `F-0024` even though it was not named in the original `F-0013` route list. This is a planning classification over an existing route, not a backlog truth change.
- **PD-F0024-06:** High-risk routes compose with delivered `F-0016`: caller admission and route permission are necessary but not sufficient; downstream governor availability and owner-gate acceptance remain separate checks.
- **PD-F0024-07:** No admin credential-management HTTP API is delivered in this pass. `admin` is a reserved role/capability for local auth configuration ownership and future explicit owner paths.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0024-01:** `F-0024` is the only canonical owner for public operator caller admission, authN/authZ and route-level RBAC on the delivered `F-0013` Hono operator route family.
- **AC-F0024-02:** `F-0024` does not create a second gateway, parallel HTTP surface or framework-owned auth server; all admitted operator requests enter through the existing `F-0013` Hono namespace.
- **AC-F0024-03:** Every operator request except explicitly public platform health surfaces must pass authentication before route handler execution; unauthenticated, malformed, expired or revoked credentials fail closed with a bounded auth error.
- **AC-F0024-04:** Every authenticated request must be authorized against an explicit route-permission matrix before downstream owner invocation; unknown routes, missing roles, missing permissions and ambiguous permissions fail closed.
- **AC-F0024-05:** The route-permission matrix distinguishes at least read-only introspection, tick control, governor submission, human-override/high-risk control and admin/bootstrap capabilities.
- **AC-F0024-06:** Default roles are explicitly bounded: `observer` may use read-only introspection only; `operator` may use read-only introspection plus bounded tick control; `governor_operator` may request governor-owned high-risk submissions only after downstream owner availability; `admin` may manage local auth configuration only through the approved owner path; `breakglass_admin` requires explicit elevated evidence and must be auditable.
- **AC-F0024-07:** `POST /control/tick` remains a transport into the `F-0003` runtime owner gate through `F-0013`; `F-0024` may authorize the caller but must not create ticks, extend trigger taxonomy or bypass `requestId` idempotency.
- **AC-F0024-08:** `POST /control/freeze-development` and `POST /control/development-proposals` may become callable only when `F-0024` admits the caller and the downstream `F-0016` owner gate is available; otherwise they return bounded unavailable/forbidden responses without writing governor state.
- **AC-F0024-09:** `F-0024` emits trusted ingress evidence for admitted requests, carrying principal/session/request/route/risk-class refs; downstream seams may validate that evidence read-only but must not treat it as governor approval, human override or perimeter verdict.
- **AC-F0024-10:** `F-0024` integrates with `F-0018` by providing caller-admission evidence for already-admitted paths; `F-0018` remains the owner of perimeter verdicts, safety-kernel policy, restricted-shell/egress controls and stronger human gates.
- **AC-F0024-11:** Auth decision audit records must capture principal ref, session ref, route, method, risk class, decision, denial reason and timestamp without persisting plaintext credentials, bearer tokens or secret material.
- **AC-F0024-12:** Credential verification, token/session parsing and auth errors must be deterministic and bounded; failures must not leak whether a secret, token or principal exists beyond the approved error taxonomy.
- **AC-F0024-13:** Rate limiting must be scoped by stable caller/request dimensions and must not disable `F-0013` `requestId` idempotency for accepted tick-control requests.
- **AC-F0024-14:** Public health/readiness ownership remains with platform/runtime seams; `F-0024` does not seize `GET /health` or startup dependency authority.
- **AC-F0024-15:** Auth/RBAC storage and middleware must not write identity-bearing runtime/state surfaces, model registry source tables, governor source tables, lifecycle evidence or reporting source tables directly.
- **AC-F0024-16:** Missing credential source, corrupt auth configuration, unsupported token version or unavailable auth store must put protected operator routes into fail-closed unavailable state rather than trusted-open mode.
- **AC-F0024-17:** The implementation must include negative boundary coverage proving no public high-risk route executes without successful caller admission and required downstream owner availability.
- **AC-F0024-18:** Any runtime/startup/deployment exposure change introduced by this seam must be verified through the canonical root quality gates and containerized smoke path before implementation closure.

## 4. Non-functional requirements (NFR)

- **Fail-closed posture:** `auth_fail_open_count` budget: `0` protected operator requests may reach downstream handlers when auth configuration is absent, invalid or unavailable.
- **Permission determinism:** `ambiguous_permission_decision_count` budget: `0` route permission checks may resolve by fallback allow or implicit role widening.
- **Secret hygiene:** `plaintext_credential_observation_count` budget: `0` plaintext credentials, bearer tokens or reusable secrets may be persisted in logs, dossiers, audit events, report payloads or test snapshots.
- **Auditability:** `auth_decision_audit_coverage` threshold: `100%` of admitted and denied protected operator requests produce bounded audit evidence with principal/session/request/route refs.
- **Boundary safety:** `foreign_surface_write_count` budget: `0` writes from auth/RBAC code into runtime identity, governor, model-registry, lifecycle or reporting source tables.
- **Operational clarity:** Protected route failures must distinguish unauthenticated, unauthorized, unavailable-downstream and rate-limited outcomes without revealing secret material.

## 5. Design (compact)

### 5.1 API surface

`F-0024` does not own new route contracts by default. It wraps the existing `F-0013` operator route family with caller-admission middleware:

```ts
type OperatorRole =
  | "observer"
  | "operator"
  | "governor_operator"
  | "admin"
  | "breakglass_admin";

type OperatorRouteClass =
  | "public_health"
  | "read_introspection"
  | "tick_control"
  | "governor_submission"
  | "human_override"
  | "admin_auth";

type AuthDecision =
  | { outcome: "allow"; principalRef: string; sessionRef: string; evidenceRef: string }
  | { outcome: "deny"; reason: "unauthenticated" | "expired" | "revoked" | "forbidden" | "rate_limited" }
  | { outcome: "unavailable"; reason: "auth_config_missing" | "auth_store_unavailable" | "downstream_owner_unavailable" };
```

Route-class mapping:

| Route family | Route class | Minimum role | Downstream owner after allow |
|---|---|---|---|
| `GET /state`, `GET /timeline`, `GET /episodes`, `GET /models` | `read_introspection` | `observer` | `F-0013` read adapters and their source owners |
| `POST /control/tick` | `tick_control` | `operator` | `F-0013` -> `F-0003` runtime request gate |
| `POST /control/freeze-development` | `governor_submission` | `governor_operator` | `F-0013` -> `F-0016`, only when available |
| `POST /control/development-proposals` | `governor_submission` | `governor_operator` | `F-0013` -> `F-0016`, only when available |
| Future human override route | `human_override` | `breakglass_admin` or explicit future owner rule | future owner seam, not `F-0024` |
| Auth administration path | `admin_auth` | `admin` | `F-0024` auth owner path only |

### 5.2 Runtime / deployment surface

- The runtime path stays inside `apps/core` and the existing Hono app.
- The first implementation should factor caller admission as middleware plus an auth service module, not inline checks per handler.
- Auth middleware executes before protected route handlers and before downstream owner calls.
- Public platform health remains outside this seam unless plan-slice explicitly proves a protected health variant is needed.
- Config/secret inputs must follow the repository secret contract: local `.env.local` or external mounted secret files, with checked-in examples containing shape only.
- If deployment exposure or startup validation changes, `pnpm smoke:cell` is required for closure.

### 5.3 Data model changes

Planning may choose one of these implementation strategies, but the resulting behavior must satisfy the same contract:

- Static/local secret-file principals for the first slice, with no plaintext secret persistence and explicit revocation/version fields.
- PostgreSQL-backed auth tables owned by `F-0024`, such as:
  - `operator_principals`
  - `operator_credentials`
  - `operator_sessions`
  - `operator_role_assignments`
  - `operator_auth_audit_events`
- Hybrid bootstrap where initial principals come from mounted secrets and runtime sessions/audit events persist in `F-0024`-owned tables.

Regardless of strategy:

- password/API-key material must be hashed or represented only by non-reusable fingerprints;
- auth audit rows must contain refs and decision metadata, not plaintext credentials;
- auth tables, if added, are separate from identity-bearing agent state and governor source tables;
- revocation and expiry must be queryable without scanning logs.

### 5.4 Edge cases and failure modes

- Missing auth configuration: protected routes return bounded unavailable/deny outcome; they do not fall back to trusted-open mode.
- Unknown principal or malformed credential: returns the same bounded unauthenticated family and does not reveal whether the principal exists.
- Expired or revoked session: denied before downstream owner calls.
- Missing route permission: denied even if the role is known.
- High-risk route with valid caller but missing downstream owner availability: unavailable, not direct governor write.
- Rate-limited caller: denied before executing the route, while preserving idempotent replay semantics for already accepted `requestId` when the downstream owner defines that behavior.
- Breakglass usage: must require explicit elevated evidence and produce audit evidence; it does not bypass `F-0018` perimeter verdicts or `F-0016` governor decisions.
- Auth store temporarily unavailable: fail closed for protected routes and expose operationally clear degraded/unavailable status without leaking secrets.

### 5.5 Verification surface / initial verification plan

- Contract tests for auth middleware decision mapping and error taxonomy.
- Permission matrix tests for every delivered `F-0013` operator route family.
- Negative tests proving unauthenticated, unauthorized, revoked, expired and unknown-role requests do not reach downstream owner stubs.
- Integration tests for admitted read-only introspection and `POST /control/tick` preserving `F-0013` DTO and `requestId` behavior.
- Contract tests for high-risk routes proving caller admission alone is insufficient when downstream owner availability is missing.
- Audit-event tests proving admitted and denied protected requests create bounded evidence without plaintext secrets.
- Secret-redaction snapshot tests for logs/errors/audit payloads.
- If startup/env/deployment behavior changes: `pnpm smoke:cell`.

### 5.6 Representation upgrades

- `AuthDecision`, `OperatorRole`, `OperatorRouteClass`, `RoutePermission` and `TrustedIngressEvidence` should become shared contract types when implementation starts.
- If storage is PostgreSQL-backed, migrations must be owned by `F-0024` and named as auth/RBAC source surfaces, not mixed into governor/runtime tables.
- If static secret-file bootstrap is selected for the first slice, the file schema must be versioned so a future DB-backed store can preserve the same semantics.

### 5.7 Definition of Done

- `F-0024` is the canonical owner of public operator caller admission, authN/authZ and route-level RBAC.
- Existing `F-0013` operator routes are protected by fail-closed auth middleware without a second gateway.
- Read-only, tick-control, governor-submission, human-override and admin route classes are explicit and covered by tests.
- High-risk routes do not execute unless caller admission and downstream owner availability both pass.
- Trusted ingress evidence is available for downstream owner validation without becoming approval authority.
- Secret material is redacted and non-persistent across logs, audit events, reports and tests.
- Dossier, architecture/index references and backlog truth remain aligned.

### 5.8 Rollout / activation note

- Activation must be staged fail-closed: introduce middleware and config validation first, then enable read-only admission, then tick-control admission, then high-risk route admission only after downstream owner checks are wired.
- A deploy that lacks auth configuration must not expose protected operator routes in trusted-open mode.
- If operator access is currently local-only, implementation may preserve local-only binding while adding auth; it must not claim external safety until route protection and smoke evidence are green.

## 6. Slicing plan (2-6 increments)

### Execution target

The implementation agent must deliver one complete `F-0024` caller-admission seam for the existing `apps/core` Hono operator routes. A successful implementation means protected operator routes are no longer trusted-local by default: every protected request is authenticated, authorized against a route class, audited without secrets, rate-limited by stable caller/request dimensions and denied/unavailable before downstream owner invocation when admission, audit, permission or owner availability is missing.

### Completion recognition

Implementation is complete when:

- all protected operator routes in `apps/core/src/platform/operator-api.ts` require caller admission before handler execution;
- `GET /health` and non-operator ingress remain outside `F-0024` ownership;
- read-only, report, tick-control and high-risk route classes have explicit role permissions and negative tests;
- `POST /control/tick` preserves `F-0013` DTO/requestId behavior while carrying bounded operator provenance;
- `POST /control/freeze-development` and `POST /control/development-proposals` require both admitted caller and `F-0016` downstream owner availability;
- auth audit events persist principal/session/request/route/risk/decision refs without plaintext credentials;
- missing auth config, corrupt principal file, unavailable audit store and unsupported token version fail closed;
- root `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm smoke:cell` are green before implementation closure because this feature changes runtime route protection and startup/config behavior.

### Implementation boundaries

- Do not introduce a second gateway, reverse proxy, framework-owned auth server or parallel HTTP surface.
- Do not protect or re-own `GET /health`; platform/runtime health remains `F-0002` / `F-0001` owned.
- Do not make `POST /ingest` part of this pass unless a later explicit owner realignment says it is an operator route.
- Do not add a public admin/bootstrap credential API in this pass.
- Do not persist raw credentials, bearer tokens or reusable secrets in examples, logs, audit rows, reports or snapshots.
- Do not write governor, runtime state, model registry, reporting, lifecycle or perimeter source tables directly from auth/RBAC code.
- Do not let RBAC role membership imply governor approval, perimeter verdict or human override.

### SL-F0024-01: Auth/RBAC contracts and route classifier

- **Result:** shared auth decision, role, route-class, route-permission and trusted-ingress evidence contracts; deterministic classifier for all delivered operator routes including `/reports`; deny-by-default behavior for unknown operator routes.
- **Primary files:** `packages/contracts/src/operator-auth.ts`, `packages/contracts/src/operator-api.ts`, `packages/contracts/src/index.ts`.
- **Tests:** `packages/contracts/test/operator-auth.contract.test.ts`.
- **Covers:** AC-F0024-01, AC-F0024-02, AC-F0024-04, AC-F0024-05, AC-F0024-09, AC-F0024-14.
- Depends on: `F-0013` route inventory; owner `@codex`; unblock condition: delivered operator route paths are stable enough to classify without changing HTTP ownership.
- **Unblock condition:** contract tests prove no shadow gateway or implicit allow route class exists.

### SL-F0024-02: Principal source, auth config and audit store

- **Result:** versioned static/mounted principal source, credential hash/fingerprint verification, expiry/revocation semantics, bounded auth config parsing and PostgreSQL-backed `operator_auth_audit_events`.
- **Primary files:** `apps/core/src/platform/core-config.ts`, `apps/core/src/security/operator-auth.ts`, `packages/db/src/operator-auth.ts`, `packages/db/src/index.ts`, `infra/migrations/020_operator_auth_rbac.sql`.
- **Tests:** `apps/core/test/platform/operator-auth-config.contract.test.ts`, `apps/core/test/security/operator-auth-service.contract.test.ts`, `packages/db/test/operator-auth-store.integration.test.ts`.
- **Covers:** AC-F0024-03, AC-F0024-06, AC-F0024-11, AC-F0024-12, AC-F0024-16.
- Depends on: `F-0002` PostgreSQL/runtime config substrate and `SL-F0024-01` contracts; owner `@codex`; unblock condition: auth tables/config can be added without changing deployment cell ownership.
- **Unblock condition:** missing/corrupt config, revoked/expired credentials and audit-store failures all return bounded auth outcomes without downstream invocation.

### SL-F0024-03: Fail-closed Hono admission on read/report/tick routes

- **Result:** admission middleware/wrapper around read-only operator routes, `/reports` and `POST /control/tick`; route permissions for `observer` and `operator`; rate limiting that preserves accepted tick `requestId` idempotency.
- **Primary files:** `apps/core/src/platform/operator-api.ts`, `apps/core/src/platform/core-runtime.ts`, `apps/core/src/security/operator-auth.ts`, `apps/core/testing/platform-test-fixture.ts`.
- **Tests:** `apps/core/test/platform/operator-auth-rbac.integration.test.ts`, `apps/core/test/platform/operator-control.integration.test.ts`, `apps/core/test/platform/operator-reporting.integration.test.ts`, `apps/core/test/platform/operator-api-boundary.contract.test.ts`.
- **Covers:** AC-F0024-03, AC-F0024-04, AC-F0024-05, AC-F0024-07, AC-F0024-11, AC-F0024-13, AC-F0024-14, AC-F0024-16.
- Depends on: `F-0013` delivered Hono route family, `F-0023` delivered `/reports`, `SL-F0024-01` and `SL-F0024-02`; owner `@codex`; unblock condition: protected routes have auth service and audit store available before handler invocation.
- **Unblock condition:** unauthenticated/forbidden/read-only/tick-control cases prove protected handlers are not called unless admission and permission pass.

### SL-F0024-04: High-risk route admission and owner-gate composition

- **Result:** admitted high-risk routes for freeze/proposal requests when `F-0016` owner gates are available; bounded forbidden/unavailable outcomes otherwise; trusted ingress evidence passed as evidence metadata without becoming approval authority.
- **Primary files:** `apps/core/src/platform/operator-api.ts`, `apps/core/src/runtime/development-governor.ts`, `packages/contracts/src/governor.ts`, `packages/contracts/src/operator-auth.ts`.
- **Tests:** `apps/core/test/platform/operator-governor-gating.contract.test.ts`, `apps/core/test/runtime/development-governor-perimeter.contract.test.ts`, `apps/core/test/perimeter/perimeter-service.contract.test.ts`.
- **Covers:** AC-F0024-08, AC-F0024-09, AC-F0024-10, AC-F0024-15, AC-F0024-17.
- Depends on: `F-0016` delivered governor owner gates, `F-0018` trusted-ingress/perimeter separation and `SL-F0024-03`; owner `@codex`; unblock condition: high-risk route admission can call downstream owner gates without direct governor/perimeter writes.
- **Unblock condition:** valid caller admission alone is insufficient when downstream owner availability is missing; unauthorized high-risk requests create zero governor writes.

### SL-F0024-05: Runtime docs, redaction audit and closure evidence

- **Result:** config/secret documentation, `.env` example shape without secrets, final coverage map, route-protection usage audit and smoke evidence for route/startup behavior.
- **Primary files:** `README.md`, `.env.example` if present or repo-local config docs, `docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md`.
- **Tests:** existing root gates plus redaction/usage audit tests introduced above.
- **Covers:** AC-F0024-11, AC-F0024-12, AC-F0024-15, AC-F0024-18.
- Depends on: all prior `F-0024` slices; owner `@codex`; unblock condition: route protection, high-risk composition and audit behavior are implemented enough for final docs and smoke evidence to be truthful.
- **Unblock condition:** `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm smoke:cell` pass or a truthful blocker is recorded before implementation closure.

### Plan-slice commitments

- **PL-F0024-01:** `SL-F0024-01` must land before route wiring so implementation cannot encode permissions ad hoc in Hono handlers.
- **PL-F0024-02:** `SL-F0024-02` must land before protected routes are enabled because fail-closed admission depends on both credential verification and durable decision audit.
- **PL-F0024-03:** `SL-F0024-03` protects read/report/tick paths before high-risk routes, preserving immediate safe operator exposure without relying on governor writes.
- **PL-F0024-04:** `SL-F0024-04` is separate because it composes with `F-0016` and `F-0018` boundaries and must prove RBAC is not approval authority.
- **PL-F0024-05:** `SL-F0024-05` is last because documentation, smoke and final coverage are only truthful after route protection and owner-gate behavior are implemented.

### Planned implementation order

1. Add auth/RBAC contracts and route classifier.
2. Add auth config, principal source and audit store.
3. Protect read-only/report/tick routes with fail-closed admission and rate limiting.
4. Enable high-risk route admission through `F-0016` owner gates without direct governor writes.
5. Finalize documentation, redaction audit, coverage map and smoke evidence.

## 7. Task list (implementation units)

- **T-F0024-01** (`SL-F0024-01`): Add `operator-auth` contracts, route classes, permission matrix and trusted-ingress evidence schema. Covers: AC-F0024-01, AC-F0024-02, AC-F0024-04, AC-F0024-05, AC-F0024-09.
- **T-F0024-02** (`SL-F0024-01`): Classify delivered operator routes including `/reports` and unknown-route deny-by-default behavior. Covers: AC-F0024-04, AC-F0024-05, AC-F0024-14.
- **T-F0024-03** (`SL-F0024-02`): Add static principal-file config, credential fingerprint verification, expiry/revocation handling and bounded auth error taxonomy. Covers: AC-F0024-03, AC-F0024-06, AC-F0024-12, AC-F0024-16.
- **T-F0024-04** (`SL-F0024-02`): Add auth audit migration/store and ensure allow/deny/unavailable decisions persist without plaintext credentials. Covers: AC-F0024-09, AC-F0024-11, AC-F0024-12.
- **T-F0024-05** (`SL-F0024-03`): Wrap read-only, `/reports` and tick-control routes with admission/permission checks while preserving existing DTOs and tick `requestId` idempotency. Covers: AC-F0024-03, AC-F0024-07, AC-F0024-13, AC-F0024-14.
- **T-F0024-06** (`SL-F0024-03`): Add stable-dimension rate limiting and negative coverage for missing role, missing permission, unknown principal and audit-store unavailable paths. Covers: AC-F0024-04, AC-F0024-12, AC-F0024-13, AC-F0024-16.
- **T-F0024-07** (`SL-F0024-04`): Replace high-risk explicit-unavailable stubs with admitted owner-gate calls only when caller permission and `F-0016` availability pass. Covers: AC-F0024-08, AC-F0024-09, AC-F0024-17.
- **T-F0024-08** (`SL-F0024-04`): Add trusted-ingress evidence propagation/compatibility tests for `F-0018` without treating it as perimeter verdict or governor approval. Covers: AC-F0024-09, AC-F0024-10, AC-F0024-15.
- **T-F0024-09** (`SL-F0024-05`): Update config/secret docs and implementation coverage map, then run root gates and `pnpm smoke:cell`. Covers: AC-F0024-11, AC-F0024-18.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0024-01 | `packages/contracts/test/operator-auth.contract.test.ts`; `apps/core/test/platform/operator-api-boundary.contract.test.ts` | planned |
| AC-F0024-02 | `apps/core/test/platform/operator-api-boundary.contract.test.ts`; route registry/classifier audit | planned |
| AC-F0024-03 | `apps/core/test/platform/operator-auth-rbac.integration.test.ts`; `apps/core/test/security/operator-auth-service.contract.test.ts` | planned |
| AC-F0024-04 | `packages/contracts/test/operator-auth.contract.test.ts`; `apps/core/test/platform/operator-auth-rbac.integration.test.ts` | planned |
| AC-F0024-05 | `packages/contracts/test/operator-auth.contract.test.ts`; route permission matrix table test | planned |
| AC-F0024-06 | `apps/core/test/security/operator-auth-service.contract.test.ts`; default-role capability test | planned |
| AC-F0024-07 | `apps/core/test/platform/operator-control.integration.test.ts`; admitted tick-control integration preserving `requestId` | planned |
| AC-F0024-08 | `apps/core/test/platform/operator-governor-gating.contract.test.ts` | planned |
| AC-F0024-09 | `packages/contracts/test/operator-auth.contract.test.ts`; trusted-ingress evidence propagation test | planned |
| AC-F0024-10 | `apps/core/test/perimeter/perimeter-service.contract.test.ts`; `apps/core/test/platform/operator-governor-gating.contract.test.ts` | planned |
| AC-F0024-11 | `packages/db/test/operator-auth-store.integration.test.ts`; auth audit redaction test | planned |
| AC-F0024-12 | `apps/core/test/security/operator-auth-service.contract.test.ts`; deterministic auth error taxonomy test | planned |
| AC-F0024-13 | `apps/core/test/platform/operator-control.integration.test.ts`; rate-limit/idempotency interaction test | planned |
| AC-F0024-14 | `apps/core/test/platform/operator-api-boundary.contract.test.ts`; platform health ownership regression | planned |
| AC-F0024-15 | no-foreign-write usage audit over auth/RBAC implementation imports and stores | planned |
| AC-F0024-16 | `apps/core/test/platform/operator-auth-config.contract.test.ts`; missing/corrupt auth config fail-closed test | planned |
| AC-F0024-17 | `apps/core/test/platform/operator-governor-gating.contract.test.ts`; high-risk no-admission/no-owner negative tests | planned |
| AC-F0024-18 | `pnpm format`; `pnpm typecheck`; `pnpm lint`; `pnpm test`; `pnpm smoke:cell` | planned |

## 9. Decision log (ADR blocks)

### ADR-F0024-01: Auth/RBAC wraps the existing Hono boundary instead of creating a gateway

- Status: Accepted
- Date: 2026-04-23
- Context: `F-0013` already owns the operator route family and repo-level ADRs require `Hono` as the canonical HTTP boundary.
- Decision: `F-0024` adds admission middleware, principal/session contracts and route permissions inside the existing Hono boundary.
- Alternatives: Add a second gateway/auth sidecar; move route ownership from `F-0013` to this feature.
- Consequences: Operator route ownership stays stable, while caller safety becomes explicit and testable.

### ADR-F0024-02: Caller admission is not approval authority

- Status: Accepted
- Date: 2026-04-23
- Context: High-risk routes require both a known caller and downstream owner decisions from governor/perimeter seams.
- Decision: `F-0024` emits trusted ingress evidence only. It does not become a governor decision, human override, perimeter verdict or execution approval source.
- Alternatives: Let RBAC role membership imply high-risk approval; duplicate `F-0018`/`F-0016` decision logic in auth middleware.
- Consequences: Route admission composes with `F-0016` and `F-0018` without creating a second approval ledger.

### ADR-F0024-03: Protected operator routes fail closed when auth state is unavailable

- Status: Accepted
- Date: 2026-04-23
- Context: A local deployment may initially lack external auth infrastructure, but protected routes must not become trusted-open by accident.
- Decision: Missing/corrupt auth config, unavailable auth store, unsupported token versions and revoked/expired sessions all deny or return bounded unavailable responses before downstream invocation.
- Alternatives: Temporarily allow local trusted access; hide auth failures as generic route absence.
- Consequences: Operators see explicit degraded/unavailable auth state, and tests can prove no accidental public exposure exists.

## 10. Progress & links

- Backlog item key: CF-024
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Current stage: `plan-slice`
- Issue:
- PRs:

## 11. Change log

- 2026-04-23 [intake]: Initial dossier created from backlog item `CF-024` at backlog delivery state `defined`.
- 2026-04-23 [spec-compact] [scope realignment]: Shaped `F-0024` as the canonical caller-admission/auth/RBAC seam over the existing `F-0013` Hono operator route family; no backlog actualization required.
- 2026-04-23 [plan-slice] [dependency realignment]: Planned implementation as a fail-closed Hono caller-admission seam with static principal source, PostgreSQL auth audit events, route-class RBAC, `/reports` read-route classification, high-risk `F-0016` owner-gate composition and mandatory smoke verification.
