# Operator access

## Incident class

`operator_access`

## Detection signals

- Protected operator routes return `401`, `403`, `429` or auth `503`.
- A caller cannot obtain trusted ingress evidence for a route they are expected to use.
- Audit evidence is unavailable for an admitted support write.

## Triage reads

- Use `F-0024` trusted ingress evidence refs and audit event refs.
- Use `F-0013` route classification for the affected endpoint.
- Compare role and route class, not raw credentials.

## Allowed actions

- Attach operator-auth evidence refs to the support incident.
- Record a human-only credential or duty-owner escalation when rotation or breakglass is required.
- Route operator admission fixes through the auth owner.

## Forbidden shortcuts

- Do not paste, store or forward bearer tokens, operator keys or local secret values.
- Do not bypass caller admission for support evidence writes.
- Do not edit auth source truth from support tooling.

## Escalation owner

`F-0024`

## Evidence requirements

- Route, principal/session/evidence refs when available.
- Redacted operator note with no reusable secret material.
- Human-only residual-risk note when access cannot be restored through the owner seam.

## Closure criteria

- Admission evidence is fresh and the caller can use the required route, or the incident is transferred with residual risk and next owner.
