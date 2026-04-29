# Problem Matrix by Skill

Status: agent-validated

| ID | Проблема | Где проявилось | Skill / runtime | Решение |
|---|---|---|---|---|
| PM-001 | Capability gap was discovered through conversation instead of being present in backlog upfront. | Telegram operator chat was not covered until F-0029 was created. | unified-dossier-engineer | Keep treating such gaps as new dossier features/change proposals before implementation. |
| PM-002 | Parallel-agent overlap invalidated earlier local work. | Operator asked to pause because another agent had removed work. | implementation-discipline | Add a conflict checklist before resuming: `git status`, last commit, touched paths, current dossier state. |
| PM-003 | Review loops were correct but expensive. | F-0029 implementation needed several non-PASS rounds before final PASS. | code-reviewer, security-reviewer, spec-conformance-reviewer | Launch each review class only when the latest change can affect that review domain; include exact changed files and fix summary in reround prompts. |
| PM-004 | Spec audit risk was not explicitly classified before every audit. | Operator challenged unnecessary audits. | spec-conformance-reviewer | Record `spec-risk` or `no-spec-risk` before launching a spec audit after fixes or hygiene-only changes. |
| PM-005 | Security review should be domain-triggered, not reflexive. | Telegram bot allowlist required security review; backlog sanitation did not. | security-reviewer | Keep security review mandatory for auth/bot/token/webhook/allowlist changes; skip for pure dossier cleanup. |
| PM-006 | Post-close hygiene was separate from functional implementation closure. | Backlog needed normalization after implementation closure. | unified-dossier-engineer | Surface post-close hygiene as a required closure follow-up until status/queue/attention are clean. |
| PM-007 | Retrospective scan over-reported trace-derived review signals. | Generated draft listed many missing non-PASS artifacts despite structured step history. | retrospective-phase-analysis | Prefer `.dossier/steps/*` structured review history over trace-derived guesses when available. |
| PM-008 | Manual artifact overrides were required for retrospective evidence. | Stage/review/verification artifacts had to be passed explicitly to `retro-cli scan`. | retrospective-phase-analysis | Improve same-session artifact discovery and distinguish immutable artifacts from latest-pointer references. |
| PM-009 | Runtime/test verification was less visible in retrospective output than dossier verification. | Verification artifact compactly listed dossier checks, but not the full implementation test story. | typescript-test-engineer, unified-dossier-engineer | Add a concise runtime/test gate summary to implementation logs and closure output. |
| PM-010 | Commit structure worked well and should be preserved. | Feature, closure, and backlog hygiene were separate commits. | git-engineer | Continue splitting commits by intent. |

## Priority

1. PM-003 and PM-004 are highest priority because they directly address the operator's latency concern.
2. PM-007 and PM-008 are next because they reduce false-positive retrospective noise.
3. PM-002 is important whenever multiple agents may work in the same repository.

## Validation Metadata

- agent_validated: true
- validated_scope: F-0029 lifecycle, implementation closure, and final backlog hygiene
- residual_confidence: medium
- validation_notes: Evidence is strong for F-0029 and final backlog state. Confidence remains medium because the session was long, included compaction, and retrospective scan required manual artifact overrides.
