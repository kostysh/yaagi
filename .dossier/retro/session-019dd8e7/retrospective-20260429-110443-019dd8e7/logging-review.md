# Logging Review

Status: agent-validated

## Summary

The F-0029 stage logs were good enough to reconstruct the lifecycle, but the retrospective scanner needed manual help to include the correct evidence set. The strongest evidence came from structured step and verification artifacts, not from prose in the session trace.

## Strengths

- F-0029 has separate logs for feature-intake, spec-compact, plan-slice, and implementation.
- The implementation step artifact records the selected closure bundle, selected PASS reviews, non-PASS review events, event commit, and source-quality metadata.
- Final backlog state is machine-readable through `dossier-engineer status`, `queue`, and `attention`.
- Post-close hygiene has a dedicated verification artifact.

## Gaps

- The retrospective scanner initially did not automatically include all relevant same-session artifacts.
- Generated logging review output reported missing artifact links too broadly because it mixed trace references, latest-copy references, and immutable artifacts.
- Stage logs do not provide a compact "why this review was launched" field for each audit reround.
- The implementation log does not summarize the most important runtime/test gates in a compact human-readable block.

## Recommended Logging Improvements

1. Add `review_launch_reason` to review-event records:
   - `spec-risk`
   - `security-risk`
   - `code-risk`
   - `hygiene-only`
   - `operator-requested`

2. Add a compact implementation verification summary:
   - `dossier_checks`
   - `runtime_checks`
   - `container_smoke`
   - `diff_checks`
   - `known_warnings`

3. Add `post_close_hygiene_required` and `post_close_hygiene_result` to the final closure summary shown to the operator.

4. In retrospective scans, treat immutable review artifacts and `latest.json` pointers differently. Missing or excluded `latest.json` should not count as missing immutable review evidence.

5. When manual artifact overrides are used, write the exact justification into the final report rather than leaving it only in `scan-summary.json`.

## Validation Notes

The final validated state is clean:

- backlog total: 29
- implemented: 29
- ready queue: 0
- attention items: 0
- open source-review blockers: 0
- lifecycle drift: 0
- post-close hygiene missing/stale/blocked: 0

The generated draft warning about excluded F-0026/F-0027/F-0028 implementation logs is not a blocker for this retrospective. Those logs were referenced during backlog hygiene, while the validated primary scope is the F-0029 lifecycle plus final backlog normalization.
