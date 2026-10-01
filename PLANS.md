# YAAGI `/plan` Rules

- Document ID: `project.methodology.plans`

In active `/plan`, apply this file together with the global `PLANS.md` supplied
by the environment and [AGENTS.md](AGENTS.md). It refines the existing audit of
operator-facing candidate plans. Audits of persistent project artifacts remain
governed by the [audit policy](docs/development-methodology/audits.md).

The [source hierarchy](docs/development-methodology/documentation.md),
[agent policy](docs/development-methodology/agent-policy.md), other authority
rules, and checkpoint approvals remain in force. The preceding simplicity audit
does not change the existing four questions or grant publication permission.

## Audit order

After completing the draft and final self-check, stabilize the candidate plan
and apply the global independent implementation-discipline simplicity audit
first. The auditor reads `implementation-discipline` from the current skill
catalog and reviews all material decisions against the task and accepted
requirements, using the global criteria and strict simplicity verdict. Apply
the project agent policy for model routing and reviewer independence.

Only a current simplicity `PASS` permits starting the four-question audit below
or any other required plan audits. Do not run them before or in parallel with
the simplicity audit. At simplicity `FAIL`, return the plan for revision; a
failed or blocked simplicity gate cannot be bypassed by author self-check or
another audit's `PASS`.

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

Only material deltas require re-audit. First repeat the global simplicity audit
on the affected scope; only after its `PASS` run the affected later audits,
keeping the same four questions and verdict for the candidate-plan audit.
A changed premise brings affected dependent decisions into scope even when
their text is unchanged. Limit re-audit to changed parts
and decisions affected by the delta; previously checked parts outside that
influence are not re-audited. Non-material wording or formatting changes do not
trigger re-audit. A replacement of the task's goal remains a new candidate plan
requiring the full initial audit under the global rules.
