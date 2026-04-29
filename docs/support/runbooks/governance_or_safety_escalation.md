# Governance or safety escalation

## Incident class

`governance_or_safety_escalation`

## Detection signals

- Governor or policy decision blocks a requested operation.
- Safety or perimeter concerns require human decision.
- The owning governor seam is unavailable or refuses an action.

## Triage reads

- Use governor decision refs when available.
- Use operator-auth evidence refs for who requested the action.
- Use support evidence refs for human-only residual-risk disposition.

## Allowed actions

- Record owner-routed governor action requests when the governor seam admits them.
- Record human-only escalation and next owner when no supported seam can execute.
- Open a support process gap if the procedure lacks an owner seam.

## Forbidden shortcuts

- Do not write governor, policy or perimeter decision ledgers from support.
- Do not convert a human-only emergency decision into automated support behavior.
- Do not close critical safety incidents without terminal evidence or residual-risk transfer.

## Escalation owner

`F-0016`

## Evidence requirements

- Governor decision ref or human-only disposition ref.
- Operator provenance refs.
- Residual risk and next owner for critical transferred incidents.

## Closure criteria

- Owner evidence shows terminal disposition, or human-only residual risk is explicit and transferred.
