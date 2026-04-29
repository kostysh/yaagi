# Release or rollback

## Incident class

`release_or_rollback`

## Detection signals

- Release inspection shows failed smoke, deploy or rollback evidence.
- A rollback plan or release evidence bundle is missing.
- Operator release route returns owner refusal or owner unavailable response.

## Triage reads

- Use `GET /control/releases` through `F-0013` and `F-0024`.
- Read release request, deploy attempt, evidence bundle and rollback execution refs from `F-0026` responses.
- Use `GET /reports` for diagnostic report refs that release automation references.

## Allowed actions

- Attach release and rollback refs to the support incident.
- Request release or rollback actions only through `F-0026`.
- Document human-only release-risk disposition when owner evidence cannot resolve the incident.

## Forbidden shortcuts

- Do not run rollback shell commands from support tooling.
- Do not mutate release, deploy or rollback tables directly.
- Do not treat a local deploy log as release owner evidence unless it is linked by `F-0026`.

## Escalation owner

`F-0026`

## Evidence requirements

- Release request or rollback execution ref.
- Diagnostic report refs when release owner requires them.
- Operator-auth evidence ref for protected release route use.

## Closure criteria

- Terminal `F-0026` owner evidence is attached, or critical residual risk is transferred to the next owner.
