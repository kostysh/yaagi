---
id: F-0024
title: Аутентификация, авторизация и operator RBAC
status: shaped
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

- Exact credential backing store, token format and revocation persistence strategy are left for `plan-slice`, as long as they satisfy this dossier's semantics and NFRs.
- Whether the first slice exposes an admin bootstrap command or only environment/secret-file seeded operators is a planning decision, not an ownership ambiguity.

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

### SL-F0024-01 - Auth contracts and fail-closed middleware skeleton

Delivers: shared auth decision/role/permission contracts, route classification, middleware shell and bounded error taxonomy.

Verification: contract tests for unauthenticated, malformed, missing-config, unknown-route and deny-by-default behavior.

### SL-F0024-02 - Principal/session source and audit evidence

Delivers: selected credential/session strategy, revocation/expiry semantics and auth decision audit events without plaintext secrets.

Verification: credential/session tests, revocation/expiry tests, audit redaction tests.

### SL-F0024-03 - Route permission matrix over delivered operator API

Delivers: RBAC enforcement for read-only introspection and `POST /control/tick`, preserving `F-0013` request/response and `requestId` idempotency.

Verification: route permission matrix tests and integration tests for admitted/denied read and tick-control calls.

### SL-F0024-04 - High-risk route admission and downstream owner composition

Delivers: caller-admission gates for freeze/proposal routes, trusted ingress evidence shape and explicit unavailable/forbidden behavior when downstream owners are not available.

Verification: high-risk negative tests, `F-0016` owner-gate handoff tests, `F-0018` trusted-ingress compatibility tests.

### SL-F0024-05 - Runtime/deployment closure

Delivers: environment/secret documentation, startup failure semantics, smoke coverage when public route wiring/startup exposure changes and final coverage map.

Verification: root quality gates and `pnpm smoke:cell` if runtime/startup/deployment behavior changes materially.

## 7. Task list (implementation units)

- **T-F0024-01** (`SL-F0024-01`): Add shared auth/RBAC contracts and route-classification matrix. Covers AC-F0024-01, AC-F0024-02, AC-F0024-04, AC-F0024-05.
- **T-F0024-02** (`SL-F0024-01`): Add fail-closed Hono middleware skeleton and bounded auth error taxonomy. Covers AC-F0024-03, AC-F0024-04, AC-F0024-12, AC-F0024-16.
- **T-F0024-03** (`SL-F0024-02`): Implement selected principal/session/credential source with expiry, revocation and secret redaction. Covers AC-F0024-03, AC-F0024-06, AC-F0024-11, AC-F0024-12.
- **T-F0024-04** (`SL-F0024-02`): Add auth audit evidence with principal/session/request/route refs and no plaintext credentials. Covers AC-F0024-09, AC-F0024-11.
- **T-F0024-05** (`SL-F0024-03`): Wrap `F-0013` read-only and tick-control routes with RBAC enforcement while preserving owner DTOs and `requestId` behavior. Covers AC-F0024-05, AC-F0024-07, AC-F0024-13, AC-F0024-14.
- **T-F0024-06** (`SL-F0024-04`): Gate freeze/proposal routes through caller admission and downstream owner availability without direct governor writes. Covers AC-F0024-08, AC-F0024-09, AC-F0024-10, AC-F0024-15, AC-F0024-17.
- **T-F0024-07** (`SL-F0024-05`): Add runtime/env/secret docs, startup/degraded behavior and smoke coverage when required. Covers AC-F0024-16, AC-F0024-18.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0024-01 | planned: auth owner-boundary contract test | planned |
| AC-F0024-02 | planned: no-shadow-gateway route wiring test | planned |
| AC-F0024-03 | planned: authentication middleware negative tests | planned |
| AC-F0024-04 | planned: authorization matrix negative tests | planned |
| AC-F0024-05 | planned: route-class permission matrix contract test | planned |
| AC-F0024-06 | planned: default role capability contract test | planned |
| AC-F0024-07 | planned: admitted tick-control integration preserving `requestId` | planned |
| AC-F0024-08 | planned: freeze/proposal unavailable/owner-gate tests | planned |
| AC-F0024-09 | planned: trusted ingress evidence contract test | planned |
| AC-F0024-10 | planned: perimeter trusted-ingress compatibility test | planned |
| AC-F0024-11 | planned: auth audit redaction contract test | planned |
| AC-F0024-12 | planned: deterministic auth error taxonomy test | planned |
| AC-F0024-13 | planned: rate-limit and idempotency interaction test | planned |
| AC-F0024-14 | planned: platform health ownership regression test | planned |
| AC-F0024-15 | planned: no foreign source writes test | planned |
| AC-F0024-16 | planned: missing/corrupt auth config fail-closed test | planned |
| AC-F0024-17 | planned: high-risk route no-admission/no-owner negative tests | planned |
| AC-F0024-18 | planned: root gates and smoke evidence when runtime/deployment changes | planned |

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
- Current stage: `spec-compact`
- Issue:
- PRs:

## 11. Change log

- 2026-04-23: Initial dossier created from backlog item `CF-024` at backlog delivery state `defined`.
- 2026-04-23 [spec-compact]: Shaped `F-0024` as the canonical caller-admission/auth/RBAC seam over the existing `F-0013` Hono operator route family; no backlog actualization required.
