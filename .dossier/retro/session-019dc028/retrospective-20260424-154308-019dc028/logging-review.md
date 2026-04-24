# Logging Review: CF-025 / F-0026 Session

Status: final, agent-validated with stated data limits

## Summary

The logs were sufficient to prove final closure, but not sufficient to explain the long session without reading the trace. The biggest gap is that failed external audit findings were not durably represented in stage logs.

## Observed Strengths

- Stage logs contain useful frontmatter: `feature_id`, `backlog_item_key`, `stage_state`, transition events, review artifacts, verification artifacts, `skills_used`, final commits and close timestamps.
- `dossier-step-close` produced a clear machine-checkable implementation artifact with review freshness and audit class coverage.
- Post-close hygiene produced structured status, attention and queue evidence.
- The session trace preserved subagent messages, so the retrospective could recover the missing FAIL context.

## Observed Gaps

### PASS-only review history

Implementation stage log records 11 PASS review events, but the real blockers were FAIL findings in trace/subagent messages. As a result, automated scan reported `reviewFindingsTotal=0` even though the session had multiple blocking review findings.

Impact: later readers see why closure passed, but not why it took multiple rerounds.

Fix: add `failed_review_events` to stage logs or require durable FAIL review artifacts. Minimum fields: reviewer, audit class, timestamp, severity, finding id, affected file, summary, resolution commit.

### Implementation prose is mostly empty

`<project-root>/.dossier/logs/implementation/F-0026--fc-F-0026-mod32etm--implementation-71691571.md` has rich metadata but prose sections such as scope, inputs, decisions and close-out are `none`.

Impact: humans must reconstruct implementation decisions from trace and commits.

Fix: require a short end-of-stage narrative before close: changed surfaces, key decisions, risk closures, test gates, unresolved residual risks.

### Session ids are hard to correlate

The runtime trace id is `019dc028-2688-7791-a888-53c3018aa4d8`, while some stage logs carry other explicit `session_id` values from stage commands or compacted context.

Impact: the retrospective CLI could not auto-include the stage logs and required manual artifact inclusion.

Fix: add a separate `runtime_trace_id` or `codex_thread_id` field in stage logs when available, distinct from operator-supplied stage session ids.

### No time breakdown

Logs record transition timestamps but not active work, waiting on agents, test runtime, reround time or closure time.

Impact: time sinks are inferred from trace rather than structured data.

Fix: add optional fields: `active_work_minutes`, `waiting_for_review_minutes`, `quality_gate_minutes`, `closure_minutes`, `reround_count`.

### Closure blockers are not grouped as incidents

The post-close source-review block and review artifact provenance issue are visible in trace and artifacts, but not summarized as process incidents in the stage log.

Impact: stage logs understate closure friction.

Fix: add `closure_blockers` with blocker kind, command, result, resolution command and resolved timestamp.

## Recommended Logging Contract Changes

1. Add failed review capture:
   `failed_review_events: [{ audit_class, reviewer, timestamp, severity, summary, file_refs, resolution_commit }]`.

2. Add closure blocker capture:
   `closure_blockers: [{ kind, command, blocked_at, evidence_ref, resolution, resolved_at }]`.

3. Add trace correlation:
   `runtime_trace_id`, `stage_session_id`, and `agent_ids` as separate fields.

4. Add final implementation narrative fields:
   `changed_surfaces`, `risk_invariants_closed`, `tests_added`, `quality_gates`, `residual_risks`.

5. Add review freshness/provenance preflight:
   record whether artifacts were written by reviewer agents and whether they match the final material commit.
