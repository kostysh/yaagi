# Support runbook template

## Incident class

`<incident_class>`

## Detection signals

- `<bounded signal from an owner route, report, release evidence or operator admission evidence>`

## Triage reads

- Use canonical owner routes or evidence refs only.
- Do not use raw owner tables, hidden shell logs or credential-bearing notes as normal support evidence.

## Allowed actions

- Record support-owned evidence refs and redacted operator notes.
- Route recovery through the owning seam when one exists.
- Document human-only disposition when no owner seam can safely execute the action.

## Forbidden shortcuts

- No direct writes to runtime, reporting, auth, release, governor, lifecycle, model-serving or perimeter source truth.
- No plaintext reusable credentials in notes, reports, logs or runbook examples.

## Escalation owner

- `<canonical owner feature id or human duty owner>`

## Evidence requirements

- Incident class, severity, source refs, action/escalation refs, operator provenance when applicable and closure criteria.

## Closure criteria

- Warning incidents require complete support evidence and explicit freshness/degradation state.
- Critical incidents require terminal owner-routed evidence or human-only residual-risk disposition with next owner.
