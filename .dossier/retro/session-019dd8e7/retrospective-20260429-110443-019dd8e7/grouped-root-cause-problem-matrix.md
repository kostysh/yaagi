# Матрица выявленных проблем с корнями и точками правки

Status: agent-authored follow-up matrix

## Scope

Этот документ является follow-up к ретроспективе сессии `019dd8e7-0a47-7093-af99-12cfa514ab67`.

Он предназначен для агента, который не видел текущую сессию. Используй этот документ как вход для последующей работы над улучшением skills и runtime-инструкций. Сам документ не меняет skills; он фиксирует, что именно нужно изменить в соответствующих skill-инструкциях или runtime-логике.

Основные источники:

- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/retrospective-report.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/skill-audit.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/logging-review.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/problem-matrix-by-skill.md`
- `.dossier/steps/F-0029/implementation.json`
- `.dossier/verification/F-0029/implementation-post-close-backlog-hygiene.json`

## ID Convention

- `RCM-UDE-*`: `unified-dossier-engineer`
- `RCM-ID-*`: `implementation-discipline`
- `RCM-SCR-*`: `spec-conformance-reviewer`
- `RCM-CR-*`: `code-reviewer`
- `RCM-SR-*`: `security-reviewer`
- `RCM-TT-*`: `typescript-test-engineer`
- `RCM-RPA-*`: `retrospective-phase-analysis`
- `RCM-GIT-*`: `git-engineer`

## unified-dossier-engineer

### RCM-UDE-001: Capability gap surfaced only during operator conversation

Problem:
The Telegram operator chat capability was not present in the backlog before the operator asked how to communicate with Polyphony. The process recovered correctly by creating `F-0029`, but discovery happened late.

Root cause:
The backlog workflow has strong mechanics for processing known sources, but the skill does not explicitly instruct agents to treat operator-facing "how will I use/talk to the system?" questions as possible backlog coverage gaps.

Current relevant rule:
`unified-dossier-engineer/SKILL.md` says the model must preserve backlog truth and that new durable source material should enter the backlog truth layer. It does not explicitly name operator interaction surface discovery as a backlog gap trigger.

Change to make:
Add an operator-interface gap trigger.

Where to change:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Section:
`Workflow stage: Maintain the model`

Add after the current invariant list:

```md
7. When an operator asks how they will interact with, operate, command, approve, or communicate with the system, check whether that interaction surface is already represented by a backlog item or dossier. If it is not represented, treat it as a potential backlog gap and route it through change-proposal or feature-intake before implementation.
```

Acceptance check:
An agent reading only the skill should know that operator-channel questions can create backlog work and must not be answered as "already covered" unless a dossier/backlog item actually covers the surface.

### RCM-UDE-002: Post-close hygiene was separate from functional closure and easy to miss

Problem:
`F-0029` implementation was functionally closed, but backlog normalization still had to be done afterward. The final state was clean only after a separate hygiene pass.

Root cause:
The skill already says post-close backlog hygiene must remain explicit, but closure output and agent behavior can still treat "implementation closed" as if the entire backlog is normal.

Current relevant rule:
`unified-dossier-engineer/SKILL.md`, `Workflow stage: Maintain the model`, item 4: "Keep implementation post-close backlog hygiene evidence explicit after closure and before branch-complete reporting or next-intake recommendation."

Change to make:
Strengthen this rule from "keep evidence explicit" to "do not report branch/session complete until hygiene commands are clean."

Where to change:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Section:
`Workflow stage: Maintain the model`

Replace item 4 with:

```md
4. Keep implementation post-close backlog hygiene evidence explicit after closure and before branch-complete reporting or next-intake recommendation. After any implementation closure, the agent must run or inspect the post-close hygiene result and must not report the branch/session as complete while `status`, `queue`, `attention`, source-review, lifecycle drift, or post-close hygiene blockers remain unresolved.
```

Runtime follow-up:
If changing the runtime is in scope, update the `implementation` or `dossier-step-close` completion output in `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs` so it prints a direct next action when post-close hygiene is required or stale.

Acceptance check:
After closing an implementation, the agent should either report "post-close hygiene is clean" or name the exact remaining blocker and next command.

### RCM-UDE-003: Review reround reasons were not machine-readable

Problem:
The session had several review rerounds, but the durable logs did not compactly say why each review class was launched again.

Root cause:
The stage artifact model records review artifacts and verdicts, but does not require a small structured launch reason such as `spec-risk`, `security-risk`, `code-risk`, `hygiene-only`, or `operator-requested`.

Current relevant rule:
`unified-dossier-engineer/SKILL.md` says stage log frontmatter mirrors bounded fields including review attempt events and process misses. It does not require review-launch reason classification.

Change to make:
Add a bounded optional field to review attempt events and make it recommended/required for rerounds.

Where to change:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Section:
`Overview`, paragraph beginning "For machine-complete stage artifacts..."

Add:

```md
For every review reround after the first attempt for the same audit class, record a bounded `review_launch_reason`: `spec-risk`, `security-risk`, `code-risk`, `runtime-test-risk`, `hygiene-only`, or `operator-requested`. The reason must explain why the latest change can affect that audit class, or explicitly state that it cannot and that the review is being skipped.
```

Runtime follow-up:
Update the review-event schema and any stage-log writer in `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs` to preserve `review_launch_reason` when supplied.

Acceptance check:
A future retrospective can group review rerounds by reason without reading the whole chat trace.

## implementation-discipline

### RCM-ID-001: Parallel-agent overlap caused avoidable rework

Problem:
The operator warned that another agent might be working in the same repo. Work had to pause because another agent removed prior local work.

Root cause:
`implementation-discipline` covers assumptions, surgical diffs, and verification, but it does not explicitly define a shared-workspace conflict checklist when another agent may be active.

Current relevant rule:
`implementation-discipline/SKILL.md`, `Workflow stage: Clarify the task and the target`, says to surface ambiguity and define success before changing code. It does not name multi-agent repository overlap as a blocking ambiguity.

Change to make:
Add a shared-workspace ambiguity rule.

Where to change:
`<skills-root>/implementation-discipline/SKILL.md`

Section:
`Workflow stage: Clarify the task and the target`

Add after item 2:

```md
3. If the operator mentions another active agent, a parallel implementation, or possible overwritten work in the same repository, treat that as a blocking workspace ambiguity. Stop editing, inspect `git status`, recent commits, touched files, and the relevant task/dossier state, then resume only after the operator confirms or the repository baseline is unambiguous.
```

Renumber the remaining item in that section.

Acceptance check:
An agent should not continue editing after an operator says another agent may be changing the same worktree.

## spec-conformance-reviewer

### RCM-SCR-001: Spec audits were launched without an explicit spec-risk decision

Problem:
The operator challenged extra audits: if a change cannot affect spec conformance, a spec audit is unnecessary overhead.

Root cause:
The skill says when it applies and when it does not, but it does not require an explicit risk decision before rerunning spec conformance after implementation fixes or hygiene-only changes.

Current relevant rule:
`spec-conformance-reviewer/SKILL.md`, `When NOT to use this skill`, excludes general merge-risk/security/style reviews. `Non-Negotiables` say to review implementation against normative requirements.

Change to make:
Add a rerun gate for post-fix and hygiene-only contexts.

Where to change:
`<skills-root>/spec-conformance-reviewer/SKILL.md`

Section:
`When NOT to use this skill`

Add bullet:

```md
- Pure backlog, dossier, logging, formatting, or closure hygiene that does not change normative requirements, implementation behavior, tests used as requirement evidence, contracts, ADRs, or acceptance criteria. In that case, run the workflow/backlog verification owned by the relevant skill instead of a spec-conformance review.
```

Section:
`Fast Workflow`

Add as step 0:

```md
0. For any rerun after implementation fixes or hygiene changes, classify the latest change as `spec-risk` or `no-spec-risk`. Run this skill only for `spec-risk`; record `no-spec-risk` as the reason when skipping it.
```

Acceptance check:
Future agents can justify every spec audit rerun in one sentence tied to changed normative surface.

## code-reviewer

### RCM-CR-001: Code review rerounds were expensive because prompts lacked a mandatory compact delta

Problem:
F-0029 needed several code-review rounds before final PASS. The review loop was valuable, but rerounds cost more than necessary.

Root cause:
`code-reviewer` requires reading the full diff and verifying findings, but it does not require the author to provide a compact "what changed since last review" handoff for rerounds.

Current relevant rule:
`code-reviewer/SKILL.md`, `Fast Workflow`, gathers context, reads the full diff, and routes by risk. It does not require reround prompts to include previous finding IDs, fixed files, and remaining risk.

Change to make:
Add a reround handoff requirement.

Where to change:
`<skills-root>/code-reviewer/SKILL.md`

Section:
`Fast Workflow`

Add after step 1:

```md
1a. For a reround after a previous review, require a compact reround handoff before reviewing: previous finding IDs/verdicts, changed files since the previous attempt, intended fixes, commands already run, and any intentionally unresolved risk. If the handoff is missing, reconstruct it from the diff and call out the missing handoff as a process issue.
```

Acceptance check:
Reviewer prompts and persisted artifacts for rerounds should make it clear whether the reviewer is validating fixes or performing a first-pass review.

## security-reviewer

### RCM-SR-001: Security review trigger needs to distinguish security-sensitive changes from hygiene

Problem:
Security review was absolutely justified for operator-only Telegram access, tokens, and allowlists. It was not justified for pure backlog sanitation.

Root cause:
`security-reviewer` has clear applicability rules, but agents may still invoke it reflexively after every implementation-adjacent edit.

Current relevant rule:
`security-reviewer/SKILL.md`, `When to use this skill`, includes auth, tokens, secrets, permissions, webhooks, and sensitive flows. `When NOT to use this skill` excludes general non-security code quality review.

Change to make:
Add an explicit hygiene exclusion and rerun trigger.

Where to change:
`<skills-root>/security-reviewer/SKILL.md`

Section:
`When NOT to Use`

Add bullet:

```md
- Pure dossier/backlog/retro/logging/closure hygiene that does not change authn/authz, tokens, secrets, permissions, webhook behavior, operator allowlists, CI secret handling, or a sensitive input-to-sink flow.
```

Section:
`Fast Workflow`

Add as step 0:

```md
0. For reruns after fixes or hygiene edits, classify the latest change as `security-risk` or `no-security-risk`. Run this skill only for `security-risk`; record `no-security-risk` as the reason when skipping it.
```

Acceptance check:
A future agent should run security review for bot auth/allowlist changes, but should not run it for a documentation-only backlog cleanup unless the cleanup changes a security requirement.

## typescript-test-engineer

### RCM-TT-001: Runtime/test evidence was less visible than dossier evidence

Problem:
The retrospective could easily list dossier verification checks, but the implementation test story was less compactly visible in the retrospective output.

Root cause:
`typescript-test-engineer` requires running relevant tests and reporting checks, but `unified-dossier-engineer` stage logs do not require a compact runtime/test gate summary in the same way they preserve dossier artifacts.

Current relevant rule:
`typescript-test-engineer/SKILL.md`, `Quick workflow`, steps 9-12 require running tests, inspecting warnings, coverage checkpoints, and final relevant tests. The rule is good; the logging bridge into dossier artifacts is weak.

Change to make:
Do not change the core testing rule. Add a cross-skill logging instruction.

Where to change:
`<skills-root>/typescript-test-engineer/SKILL.md`

Section:
`Quick workflow`

Add after step 12:

```md
12a. When the work is part of a dossier-managed implementation stage, record a compact runtime/test gate summary in the stage log or closure artifact: exact commands, pass/fail status, warnings/stderr status, coverage status when applicable, and any skipped checks with reason.
```

Where to change additionally:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Section:
`Overview`, paragraph about stage log frontmatter

Add `runtime_test_gate_summary` to the examples of bounded machine fields.

Acceptance check:
A retrospective should be able to identify both dossier checks and runtime/test checks without reconstructing them from chat.

## retrospective-phase-analysis

### RCM-RPA-001: Retrospective scan over-reported missing review artifacts

Problem:
Generated drafts reported many trace-derived non-PASS review signals without matching immutable artifacts, even though `.dossier/steps/F-0029/implementation.json` contained complete non-PASS review history with artifact paths.

Root cause:
The retrospective scanner gave too much weight to trace-derived review mentions and not enough priority to structured step-artifact review history.

Current relevant rule:
`retrospective-phase-analysis/SKILL.md` says linked stage artifacts and review/verification/step artifacts are stronger evidence than broad trace mentions. The implementation needs to apply that hierarchy more strictly for review signals.

Change to make:
Prefer structured step artifacts over trace-derived review guesses.

Where to change:
`<skills-root>/retrospective-phase-analysis/SKILL.md`

Section:
`Procedure`, under scope/evidence rules

Add:

```md
When an included step artifact contains structured `non_pass_review_events`, `selected_review_artifacts`, or `rpa_source_quality.review_history_quality`, treat that structured step history as the primary review-history source. Use trace-derived review mentions only to supplement gaps, and do not count trace-only mentions as missing immutable artifacts when the step artifact already records complete review history.
```

Runtime follow-up:
Update `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs` so `scan` suppresses or downgrades trace-derived missing-review warnings when included step artifacts report `review_history_quality: "complete"` and `missing_fail_artifact_count: 0`.

Acceptance check:
Running `retro-cli scan` on this session should not produce a matrix dominated by duplicate "missing non-PASS artifact" rows when complete step review history exists.

### RCM-RPA-002: Manual artifact overrides were needed for same-session evidence

Problem:
The first retrospective scan left relevant same-session stage/review/verification artifacts as referenced-only. A second scan had to include them manually.

Root cause:
The skill intentionally avoids broad inclusion for safety, but the runtime does not yet infer enough from explicitly included stage logs and their bounded artifact links.

Current relevant rule:
`retrospective-phase-analysis/SKILL.md` says included stage logs can promote linked review, verification, and step artifacts when they exist, are inside project root, and match scope.

Change to make:
Clarify and implement same-session stage-log promotion rules.

Where to change:
`<skills-root>/retrospective-phase-analysis/SKILL.md`

Section:
`Procedure`, scope rules around included stage logs

Replace the current broad sentence:

```md
when an included stage log or bounded stage state declares `review_artifact(s)`, `verification_artifact(s)`, or `step_artifact(s)`, treat those links as stronger evidence than broad trace mentions only if the target path exists inside the confirmed project root and matches the artifact scope.
```

With:

```md
when an included stage log or bounded stage state declares `review_artifact(s)`, `verification_artifact(s)`, or `step_artifact(s)`, auto-include those linked artifacts when the target path exists inside the confirmed project root, matches the same feature/stage scope, and is not a mutable `latest` pointer. Treat mutable `latest` pointers as navigation hints only, not as required immutable evidence.
```

Runtime follow-up:
Update `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs` artifact candidate inclusion logic to:

1. auto-include immutable stage-linked artifacts;
2. exclude `latest.json` pointers from missing-artifact counts;
3. preserve a separate warning only for genuinely missing immutable artifacts.

Acceptance check:
The scanner should still avoid broad repo reads, but should not require manual overrides for immutable artifacts directly linked by an included stage log.

## git-engineer

### RCM-GIT-001: Commit structure was good; preserve as positive control

Problem:
No negative issue found. The session split feature implementation, closure, backlog hygiene, and retrospective into separate commits.

Root cause:
`git-engineer` docs-only and conventional commit rules are clear enough for this case.

Current relevant rule:
`git-engineer/SKILL.md`, `Docs-only commit workflow`, requires explicit docs paths, staged-file verification, `docs:` commit type, and clean status.

Change to make:
No change required.

Acceptance check:
Future agents should keep this pattern: one commit per coherent concern, using `docs:` for retrospective artifacts.

## Cross-Skill Priority Order

1. `RCM-SCR-001`, `RCM-SR-001`, and `RCM-CR-001` should be addressed first because they directly reduce unnecessary review latency without weakening review quality.
2. `RCM-RPA-001` and `RCM-RPA-002` should be addressed next because they reduce false-positive retrospective noise.
3. `RCM-UDE-002` and `RCM-TT-001` improve closure observability and should be implemented together.
4. `RCM-ID-001` is important for multi-agent reliability and should be added before the next known parallel-agent session.
5. `RCM-UDE-001` improves backlog discovery for future operator-facing channels.

## Implementation Notes for a Future Agent

- Do not apply all changes blindly in one commit if editing actual skills. Split by skill or by tightly related runtime behavior.
- For changes under `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs`, add or update CLI tests if the skill has a test harness.
- For changes under `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs`, use `implementation-discipline` because that is runtime code.
- After changing any skill source, run the skill's own compile/check flow if it uses `skill-source-compiler`.
- Keep the wording portable: do not mention this repository path or this session unless writing tests/fixtures for the exact retrospective case.
