# YAAGI `/plan` Rules

- Document ID: `project.methodology.plans`

In active `/plan`, apply this file together with the global `PLANS.md` supplied
by the environment and [AGENTS.md](AGENTS.md). It refines the existing audit of
operator-facing candidate plans. Audits of persistent project artifacts remain
governed by the [audit policy](docs/development-methodology/audits.md).

The [source hierarchy](docs/development-methodology/documentation.md),
[agent policy](docs/development-methodology/agent-policy.md), other authority
rules, and checkpoint approvals remain in force. This refinement adds no audit
question, reviewer, registry, or publication permission.

## Question 2 and verdict

Keep exactly four audit questions and the global strict verdict format.
Questions 1, 3, and 4 remain unchanged. For question 2, ask:

> Does the plan have sufficient authority to change, narrow, or cancel accepted
> requirements and decisions, are the affected architectural grounds (including
> inherited constraints) still applicable, and is bypassing or duplicating an
> existing primitive justified?

For a bypass or duplication, check the current requirement or protected boundary
and why the existing primitive is insufficient. Without a material change or
concrete contradiction, do not require renewed justification of the entire
architecture.

Report question 2 findings in the existing
`Изменения требований и основания решений` field. `PASS` is allowed only when
all four result fields are `none`, with the candidate plan's stable identity as
required by the global format.

A material unresolved question about an architectural ground's applicability or
the justification for bypassing or duplicating a primitive requires `FAIL`, even
when the plan conforms to an existing ADR. Record the source locator, problem,
affected decision, impact, and required decision from the owning source's owner.
The auditor does not revoke the ADR or authorize a deviation independently.

## Re-audit boundary

Only material deltas require another candidate-plan audit, using the same four
questions and verdict. A changed premise brings affected dependent decisions
into scope even when their text is unchanged. Limit re-audit to changed parts
and decisions affected by the delta; previously checked parts outside that
influence are not re-audited. Non-material wording or formatting changes do not
trigger re-audit. A replacement of the task's goal remains a new candidate plan
requiring the full initial audit under the global rules.
