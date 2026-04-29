# Reporting freshness

## Incident class

`reporting_freshness`

## Detection signals

- `GET /reports` returns unavailable, not evaluable or degraded report families.
- A support closure depends on a report-run ref that cannot be found.
- Diagnostic report evidence is stale for the incident under review.

## Triage reads

- Read the `F-0023` reporting bundle through `GET /reports`.
- Use report-run ids and publication metadata as refs.
- Check freshness state through support canonical evidence evaluation.

## Allowed actions

- Attach report-run refs to the support evidence bundle.
- Mark stale report evidence as degraded and missing or unavailable reports as blocked.
- Escalate report materialization issues to the reporting owner.

## Forbidden shortcuts

- Do not query reporting tables directly from support procedures.
- Do not copy report payloads into support evidence as authoritative truth.
- Do not relabel unavailable report evidence as healthy.

## Escalation owner

`F-0023`

## Evidence requirements

- Report-run ref and freshness state.
- Source route or diagnostic surface ref.
- Operator evidence ref when a protected route was used.

## Closure criteria

- Fresh report evidence is attached, or closure explicitly records degraded evidence and residual risk.
