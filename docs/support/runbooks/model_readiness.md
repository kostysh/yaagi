# Model readiness

## Incident class

`model_readiness`

## Detection signals

- `GET /models` reports model dependency unavailable or degraded.
- Model-health report-run refs are stale or unavailable.
- Promoted dependency readiness blocks tick admission.

## Triage reads

- Read `GET /models` through the operator API.
- Read model-health report-run refs through `GET /reports`.
- Use serving dependency refs from the bounded model diagnostics response.

## Allowed actions

- Attach model diagnostic route refs and report-run refs.
- Escalate owner-routed remediation to model/reporting owners.
- Record degraded closure only when stale evidence is explicit.

## Forbidden shortcuts

- Do not mutate model profiles, serving maps or model artifacts from support tooling.
- Do not call model services with hidden credentials as support evidence.
- Do not bypass owner readiness checks.

## Escalation owner

`F-0023`

## Evidence requirements

- Model diagnostic route ref or model-health report-run ref.
- Freshness state for each canonical evidence ref.
- Operator-auth evidence ref for protected reads.

## Closure criteria

- Fresh model readiness evidence is attached, or the incident is transferred with explicit residual risk.
