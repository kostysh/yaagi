# Logging review: F-0028 implementation session

Status: validated

## Summary

The final dossier logging was strong enough to reconstruct closure, reviews, verification, and post-close hygiene. The main logging gap is provenance: current artifacts identify reviewer intent and reviewer ids, but do not reliably expose who executed the artifact-writing command. That gap mattered because the session included a parent-authored FAIL review artifact violation.

## Logging strengths

- `.dossier/logs/implementation/F-0028--fc-F-0028-mojwnhzd--implementation-861e0d58.md` records phase scope, transition events, process misses, final review bundle, final verification artifact, and post-close hygiene.
- `.dossier/stages/F-0028/implementation.json` records `closure_bundle_id`, audit class order, selected review artifacts, selected verification artifact, `rpa_source_identity`, and `rpa_source_quality`.
- `.dossier/steps/F-0028/implementation.json` records process completion, review freshness, required/executed audit classes, reviewer agent ids, and final blockers.
- Review artifacts include reviewer ids, event commits, verdicts, findings, and evidence.
- Final verification artifact includes the full closure gate set, including root gates, full `pnpm test`, and `pnpm smoke:cell`.

## Logging gaps

### LG-01: Review writer provenance is not first-class

- Problem: review artifacts record reviewer metadata, but not enough to prove the artifact was written by the reviewer process.
- Evidence: the session had an explicit user correction that early FAIL artifacts were logged by the parent.
- Impact: independent-review compliance can appear satisfied even when artifact authoring violated process rules.
- Fix: add `artifact_writer_thread_id`, `artifact_writer_role`, and `artifact_writer_command_source` to review artifacts or the review event log. Reject selected closure artifacts when writer and reviewer thread differ without an explicit degraded-review exception.

### LG-02: Retrospective scan did not automatically bind validated stage logs

- Problem: the CLI scan found stage logs as touched paths but reported `Stage logs analyzed: 0`.
- Impact: generated drafts overemphasized trace-only non-PASS signals even though final stage state had complete review history.
- Fix: when a stage log has matching `session_id` or `rpa_source_identity.session_id`, auto-include it or emit a concrete instruction to rerun scan with that log.

### LG-03: Audit interruption/staleness is not summarized in final stage log

- Problem: stale r09 code/security audits were stopped after spec r09 failed, but the final stage log mainly records selected final PASS events.
- Impact: future reviewers can infer final correctness, but not the reason some launched agents produced no artifact.
- Fix: add optional `audit_interruptions` events with reviewer agent id, target commit, reason, and replacement round.

### LG-04: Environment failure classification is too coarse

- Problem: package-manager and managed verification issues were discussed in the trace, while final artifacts mostly show pass/fail gate output.
- Impact: it is harder to distinguish actual code failures from sandbox/PATH/permission failures after the fact.
- Fix: verification artifacts should classify environment failures as `tool_not_installed`, `path_resolution`, `sandbox_permission`, `network`, or `test_failure`.

### LG-05: Source-review and post-close hygiene rationale is thin

- Problem: final post-close hygiene is clean, but the log does not preserve much operator reasoning for why earlier source-review/hygiene items were no-op or already aligned.
- Impact: closure is auditable, but the rationale is not as reusable for future backlog hygiene work.
- Fix: allow `post_close_hygiene_notes` with short operator rationale and affected feature ids.

## Recommended checks

1. Fail `dossier-step-close` when a selected review artifact lacks writer provenance.
2. Warn in `review-artifact` when the parent thread writes an artifact for a reviewer id.
3. Warn in retrospective scan when stage logs are only referenced, not analyzed.
4. Require explicit verification failure classification for failed managed checks.
5. Preserve audit interruption events when a review round is superseded before artifact write.

## Data quality

- High for final closure and final review state.
- Medium for early audit authoring provenance because the rule violation is known from trace/user correction, while the durable review schema cannot prove writer identity.
- Medium for environment diagnostics because final artifacts capture successful reruns more clearly than failed sandbox/toolchain attempts.
- CLI validation stamp: `agent_validated: true`, `residual_confidence: medium`, `validated_at: 2026-04-29T15:14:04.825Z`.
