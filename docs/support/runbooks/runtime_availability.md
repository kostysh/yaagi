# Runtime availability

## Incident class

`runtime_availability`

## Detection signals

- `GET /health` is unavailable or degraded.
- `GET /state` cannot return a bounded subject-state snapshot for an admitted operator.
- `GET /reports` shows runtime or lifecycle diagnostic evidence as unavailable.

## Triage reads

- Read `GET /health` for public health.
- Read `GET /state` and `GET /timeline` through `F-0013` with `F-0024` admission.
- Read `GET /reports` for report-run refs instead of raw runtime tables.

## Allowed actions

- Open a support incident with operator route refs and report-run refs.
- Record owner-routed runtime inspection evidence.
- Escalate recovery to the runtime owner if boot, tick admission or shutdown evidence is missing.

## Forbidden shortcuts

- Do not write runtime identity, tick, timeline or lifecycle tables from support tooling.
- Do not treat unlinked shell output as closure evidence.
- Do not bypass `F-0024` for protected operator reads.

## Escalation owner

`F-0013`

## Evidence requirements

- Operator route ref for the failed or recovered route.
- Report-run ref when diagnostic reporting is available.
- Operator-auth evidence ref when protected routes are involved.
- Redacted operator note for observed user impact.

## Closure criteria

- Runtime owner evidence shows recovery, or the incident is transferred with residual risk and next owner.
- Stale or unavailable report evidence is marked degraded or blocked.
