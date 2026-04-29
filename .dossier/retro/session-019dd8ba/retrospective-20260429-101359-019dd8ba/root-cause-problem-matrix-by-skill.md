# Root-cause problem matrix by skill: F-0028 implementation session

Status: validated operator-facing analysis

## Scope

This matrix analyzes problems found during the `F-0028` implementation session for `CF-026`.
The phase boundary is the completed F-0028 implementation closure before later F-0029 work.

Evidence used:

- Session trace `<session-trace:019dd8ba>`.
- Stage log `.dossier/logs/implementation/F-0028--fc-F-0028-mojwnhzd--implementation-861e0d58.md`.
- Stage state `.dossier/stages/F-0028/implementation.json`.
- Step artifact `.dossier/steps/F-0028/implementation.json`.
- Final verification `.dossier/verification/F-0028/implementation-78652ba50b17.json`.
- Key review artifacts under `.dossier/reviews/F-0028/`.
- Existing retrospective reports in this run directory.

Terminology:

- Symptom: what was visible during the session.
- Root cause: the underlying process, skill, logging, or implementation-control gap that made the symptom possible.
- Best solution: the recommended durable change, written as an actionable instruction for an agent without access to this session context.
- Done check: concrete evidence that the solution is implemented.

## Priority order

1. Enforce review artifact writer provenance.
2. Require a stateful side-effect negative matrix before first external implementation audit.
3. Make full verification evidence a review-entry requirement.
4. Add adjacent-invariant regression discipline for lifecycle fixes.
5. Improve retrospective and logging tooling so future sessions are easier to audit.

## `unified-dossier-engineer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| UDE-RCA-001 | A FAIL review artifact was written by the parent agent instead of the independent auditor. Later PASS artifacts were auditor-authored, but the workflow allowed the violation. | `review-artifact` and `dossier-step-close` validate declared reviewer metadata, review freshness, commit freshness, and verdict state, but they do not prove the command actor or writer thread. The independent-review rule depends on operator discipline rather than enforceable artifact provenance. | Extend the review artifact schema with writer provenance fields: `artifact_writer_thread_id`, `artifact_writer_role`, `artifact_writer_runtime`, `artifact_writer_recorded_at`, and `writer_provenance_level`. `review-artifact` should read the runtime thread id from the agent environment when available. `dossier-step-close` must reject selected external review artifacts when `artifact_writer_thread_id` differs from `reviewer_thread_id`, unless an explicit degraded-review exception is recorded and accepted. | A test creates one review artifact with matching writer/reviewer ids and one with mismatched ids. The matching artifact is eligible for closure; the mismatched artifact blocks `dossier-step-close` with a clear provenance error. |
| UDE-RCA-002 | Superseded or stopped review agents were not summarized in the final stage log. | The stage log emphasizes selected final review artifacts and final closure bundle. It does not have a first-class model for audit attempts that were launched but stopped because a prior required audit failed or the target commit became stale. | Add an `audit_interruptions` section to stage logs and stage state. Each entry should include `audit_class`, `reviewer_agent_id`, `target_commit`, `interrupted_at`, `reason`, and `replacement_round`. Record interruptions when an audit is cancelled, superseded, or intentionally prevented from writing a stale artifact. | A stage with a failed spec review and stopped code/security audits records interruption entries, and `dossier-step-close` preserves them in the closure metadata. |
| UDE-RCA-003 | Post-close hygiene was eventually clean, but the rationale for no-op source-review/hygiene decisions was thin. | Existing hygiene artifacts record status and blockers well, but not the operator's short reasoning for why earlier source-review or affected-feature items require no backlog change. | Add optional `post_close_hygiene_notes` to the implementation step artifact and stage log. Each note should include `affected_feature_id`, `source_review_id` when relevant, `decision`, and `reason`. | A closure that resolves source-review or affected-feature hygiene without a backlog patch contains machine-readable notes explaining why no further backlog change was required. |
| UDE-RCA-004 | The final narrative required cross-reading commits, review artifacts, and process misses to understand why many review-fix commits existed. | The closure bundle records final selected artifacts, but it does not contain a compact mapping from each blocking review finding to the resolving commit and regression test. | Add a `review_fix_map` section when a stage has more than two blocking review rounds. Each row should include `finding_artifact`, `finding_id_or_summary`, `resolving_commit`, `verification_artifact`, and `test_refs`. | The F-0028-style closure can be understood from one table without opening every historical review artifact. |

## `implementation-discipline`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| IMPL-RCA-001 | Implementation entered external review before the support incident state machine was sufficiently modeled. Auditors repeatedly found replay, conflict, side-effect ordering, terminal-state, and evidence-readiness bugs. | Review readiness was treated as "local checks pass and obvious scope is implemented". For stateful support flows, that is too weak: the implementation needed a negative matrix before review, not after reviewer failures. | Require a `review_readiness_matrix` before first external implementation audit for code that mutates durable state or triggers side effects. The matrix must list at least: duplicate request, conflicting request, wrong target id, owner seam throws before persist, owner seam throws after persist, canonical reader unavailable, rejected request replay, terminal-state update, and cross-owner action attempt. Each row must name the expected outcome and a test reference or explicit non-applicability reason. | First external audit launch is blocked until the matrix exists and every applicable row has a test reference. |
| IMPL-RCA-002 | Fixes were applied one reviewer finding at a time, which left adjacent invariants untested. Example: terminal closure immutability was fixed before canonical evidence readiness for the preserved terminal state. | The repair loop optimized for the immediate finding instead of expanding from the finding to nearby invariants. Lifecycle state changes often affect multiple invariants at once, but the process did not force that expansion. | Add an "adjacent invariant expansion" step after every blocking review finding that touches lifecycle state, replay, authorization, evidence readiness, or side effects. The agent must write: affected invariant, adjacent invariants, combined failure scenario, and regression tests. | A fix for a lifecycle bug includes at least one regression that combines the original failure with one adjacent invariant, such as terminal status preservation plus newly attached stale/missing evidence. |
| IMPL-RCA-003 | CF-029 material briefly entered F-0028 working context before being identified as out of scope. | Scope control relied on later backlog dry-run and cleanup rather than an upfront "material scope" boundary before implementation edits. | Before implementation starts, write a short material-scope guard in the stage log: allowed feature id, allowed backlog key, allowed canonical docs, and explicitly excluded packets/items discovered during intake. Treat any later out-of-scope packet as a separate backlog task unless the operator explicitly expands scope. | Stage log contains an `excluded_material_scope` list, and attempts to include excluded packets require an explicit scope-change note. |

## `typescript-test-engineer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| TEST-RCA-001 | Regression tests were added reactively after audit failures instead of preventing the audit failures. | Test planning was not generated directly from dossier acceptance criteria plus risk families before review. The final test suite was strong, but it arrived through reviewer-driven discovery. | Add a `pre_review_test_inventory` artifact for implementation stages. For each AC and risk family, list the positive path, negative path, test file, and command that executes it. For F-0028-like support work, risk families must include admission, replay, evidence, redaction, terminal lifecycle, and runtime-gating. | A reviewer can open one inventory and see every applicable risk family mapped to concrete tests before review starts. |
| TEST-RCA-002 | Full verification evidence was incomplete in an earlier managed artifact, so spec review blocked closure. | Test execution and verification packaging were treated as separate concerns. Passing some automation checks was not enough to prove AC-mandated root gates and smoke evidence were present in the managed verification artifact. | Make the verification artifact declare a `required_command_matrix` before command execution. For protected operator routes or side-effect paths, required commands must include `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused tests, `pnpm test`, and `pnpm smoke:cell`. The artifact is `fail` if any required command is missing, even if executed commands pass. | A verification artifact with missing required commands fails validation with `missing_required_command` entries. A complete artifact lists every required command with status and output summary. |
| TEST-RCA-003 | Environment-sensitive failures made it harder to separate code test failures from shell/sandbox failures. | Verification records command pass/fail output, but not enough normalized failure classification for environment/tooling issues such as PATH resolution, permissions, or sandbox restrictions. | Add `failure_classification` to failed verification checks. Allowed values should include `test_failure`, `tool_not_installed`, `path_resolution`, `sandbox_permission`, `network`, and `unknown_environment`. Require a short `classification_reason`. | Failed verification caused by missing PATH or sandbox permission is not reported as a code regression; it carries the proper classification and remediation hint. |

## `spec-conformance-reviewer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| SPEC-RCA-001 | Spec review had to catch missing root gates and smoke evidence instead of receiving a review-ready evidence bundle. | The spec-review intake contract did not require a current verification artifact that explicitly covered every AC-mandated command. The reviewer correctly blocked the issue, but the block happened late. | Add a spec-review preflight checklist. Before spawning the spec reviewer, the parent must provide: dossier path, target commit, current verification artifact, required command matrix, and explicit AC-to-evidence mapping. The spec reviewer should fail fast if any field is absent. | A spec reviewer can reject the review before deep analysis with a single "missing review input" finding when the verification bundle is incomplete. |
| SPEC-RCA-002 | The terminal-closure fix initially missed the spec requirement that newly attached canonical evidence still be evaluated against terminal closure semantics. | The implementation interpreted the spec requirement as "preserve terminal status" rather than "preserve terminal status and still apply evidence readiness to new refs". The spec text was enforceable, but the implementer-side extraction of coupled obligations was weak. | For specs with lifecycle and evidence coupling, add a `coupled_obligations` checklist during plan-slice or implementation entry. Each row must state two obligations that must hold together and name at least one combined test. | The plan or stage log contains a row equivalent to "terminal closure remains immutable while new missing/stale canonical refs still block/degrade readiness", with test references. |

## `code-reviewer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| CODE-RCA-001 | Code review repeatedly found state-machine defects in support incident open/update flows. | Generic code review was effective at finding issues, but the review prompt and skill did not provide a reusable checklist for durable request/side-effect state machines. Each round discovered the next missing case. | Add a "durable side-effect state machine" checklist to code-review prompts for implementations that persist request ids or call owner seams. The checklist must inspect claim-before-side-effect, replay-before-reader-call, conflict identity, failed-claim recovery, side-effect persistence, scalar merge safety, and terminal-state mutation. | Code review output explicitly marks each checklist item as pass/fail/not applicable before verdict. |
| CODE-RCA-002 | Route/service boundaries were not reviewed as one end-to-end failure contract until late rounds. | The implementation separated store logic, service logic, and Hono route mapping, while bugs crossed those boundaries. | Require code review to include one "boundary trace" for each write route: HTTP input -> admission -> service validation -> durable claim -> owner seam -> store mutation -> HTTP status mapping -> replay response. | Review artifact includes boundary traces for each protected write route and flags mismatches between service result states and HTTP responses. |

## `security-reviewer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| SEC-RCA-001 | Security review found owner-action forgery, replay/conflict protection, and redaction gaps. | The implementation did not start from a threat model for support-operator writes. It added privileged support behavior before explicitly modeling who can trigger owner-routed actions, what data is redacted, and how replay is bounded. | Require a compact threat model before first security review for any operator-facing write surface. It must define actors, privileges, protected assets, trust boundaries, abuse cases, and required controls for replay, owner action routing, redaction, and audit evidence. | Security review input includes the threat model; reviewer verdict explicitly maps findings to threat-model controls. |
| SEC-RCA-002 | Redaction coverage lagged behind new support free-text fields. | Redaction was not treated as a schema-wide invariant. New fields such as requested actions, closure criteria, residual risk, and support refs could appear without being automatically covered by redaction tests. | Add schema-driven redaction tests: every persisted or hashed free-text support field must be enumerated in a redaction inventory, and the test must fail when a new free-text field lacks a redaction case. | Adding a new support free-text field without updating the redaction inventory fails the focused support test suite. |

## `hono-engineer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| HONO-RCA-001 | Route-level service failures were mapped incorrectly in earlier rounds; first-attempt support service exceptions could return the wrong HTTP contract. | Tests and review focused on service/store behavior before fully exercising the HTTP boundary for thrown failures after durable claims. Hono route mapping was not covered as a first-class contract. | For every Hono route that wraps a durable write service, add route-level tests for: validation failure, admission failure, service `accepted:false`, service throw before durable claim, service throw after durable claim, and replay of a failed request. | The route test suite proves the intended HTTP status and response body for each service failure class. |

## `node-engineer` / `typescript-engineer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| NODE-RCA-001 | The explanation of `pnpm` availability was imprecise, causing operator confusion and extra remediation work. | The agent collapsed three different states into one message: package manager not installed, package manager not in the current shell PATH, and command blocked by environment/sandbox permissions. | Use a standard package-manager diagnostic before reinstall advice: run `command -v pnpm`, `pnpm --version`, inspect `PATH`, check `corepack pnpm --version` when relevant, and classify failures as install, PATH, or sandbox/permission. Only recommend `npm install -g pnpm` after install absence is proven. | Future reports say exactly one of: "pnpm is not installed", "pnpm exists but is not in this shell PATH", or "pnpm is available but this command is blocked by environment permissions". |

## `retrospective-phase-analysis`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| RPA-RCA-001 | The initial retrospective scan overreported trace-derived non-PASS review signals even though the final stage state had complete review history. | The scan did not auto-ingest same-session stage logs. It treated trace mentions as candidates while the validated stage log and `rpa_source_quality` had stronger evidence. | Update the scan workflow so that a stage log with matching `session_id`, `feature_id`, and `stage` is auto-included or explicitly requested before report generation. When included stage state says `review_history_quality: complete`, suppress duplicate trace-only non-PASS signals. | Running scan on the same session reports analyzed stage logs and does not produce duplicate trace-only non-PASS review rows when dossier artifacts are complete. |
| RPA-RCA-002 | CLI validation updated `scan-summary.json`, but generated Markdown files still needed manual status cleanup. | The `validate` command stamps structured JSON metadata but does not update generated Markdown report status sections or validation metadata blocks. | Make `retro-cli validate` either update generated Markdown validation sections in the run directory or write a `validation.md` sidecar that every generated report links to. | After validation, no generated Markdown in the run directory contains `draft`, `pending`, `not validated`, or `requires agent validation` unless the validation actually failed. |

## `git-engineer`

| ID | Problem | Root cause | Best solution | Done check |
|---|---|---|---|---|
| GIT-RCA-001 | The commit sequence alone did not explain the many audit-fix loops. | Commit messages identified fixes, but not the review artifact, blocker, and test evidence that motivated each fix. The durable explanation lived across several dossier files. | When an implementation stage has more than two review-fix commits, require a closure table in the stage log: `commit`, `review_artifact`, `blocker_summary`, `changed_surfaces`, and `regression_tests`. | Another agent can reconstruct why every review-fix commit exists from the stage log without searching the whole trace. |
| GIT-RCA-002 | Later uncommitted F-0029 artifacts appeared after F-0028 closure, creating a risk of mixing phase outputs if future commits are careless. | The session continued into new backlog work after F-0028 closure. Git status is the only immediate boundary marker unless phase-specific commit discipline is enforced. | Before committing retrospective or follow-up artifacts, use pathspec-scoped `git add` limited to the retro run directory or the intended feature. Do not stage broad `.dossier` changes when unrelated feature artifacts are present. | `git status --short` before commit shows unrelated dirty paths, and the commit command stages only the intended retro path. |

## Cross-skill synthesis

| Root cause family | Affected IDs | Summary | Best next action |
|---|---|---|---|
| Missing enforceable provenance | UDE-RCA-001, LOG-related findings from prior report | Process rules existed, but artifacts could not prove command actor identity. | Implement writer provenance and closure rejection for mismatched external review artifacts. |
| Premature review readiness | IMPL-RCA-001, TEST-RCA-001, SPEC-RCA-001, CODE-RCA-001, SEC-RCA-001 | Reviewers were used as discovery engines for cases that should have been in pre-review matrices. | Add mandatory review-entry packets: negative matrix, test inventory, threat model, and verification command matrix. |
| Coupled invariant blind spots | IMPL-RCA-002, SPEC-RCA-002, CODE-RCA-002 | Fixes targeted individual symptoms without expanding to adjacent lifecycle/evidence invariants. | Require adjacent-invariant expansion for lifecycle, replay, evidence, and side-effect fixes. |
| Incomplete evidence packaging | TEST-RCA-002, SPEC-RCA-001, RPA-RCA-001 | Strong evidence existed eventually, but tooling did not require or ingest it at the right time. | Make evidence completeness machine-checkable before review and before retrospective report generation. |
| Environment ambiguity | TEST-RCA-003, NODE-RCA-001 | Tooling failures were not classified precisely enough. | Add standard package-manager diagnostics and verification failure classifications. |

## Recommended implementation sequence

1. Implement `UDE-RCA-001` first. It protects the independent-review rule that the operator explicitly called out.
2. Implement `IMPL-RCA-001`, `TEST-RCA-001`, and `SEC-RCA-001` together as the minimum review-entry packet.
3. Implement `TEST-RCA-002` and `SPEC-RCA-001` together so spec review never starts with incomplete verification evidence.
4. Implement `IMPL-RCA-002` and `SPEC-RCA-002` as an adjacent-invariant checklist for lifecycle fixes.
5. Implement `RPA-RCA-001` and `RPA-RCA-002` to reduce noise in future retro reports.
6. Implement `GIT-RCA-001` and `GIT-RCA-002` as closure hygiene improvements for long audit-loop phases.
