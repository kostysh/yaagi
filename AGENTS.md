# Repository instructions

These instructions apply to the entire repository. A closer `AGENTS.md` or
`AGENTS.override.md` may refine rules within its directory. Explicit operator
instructions take precedence over project recommendations and skill guidance;
system and developer constraints remain binding.

## Start here

1. Work in the task branch and worktree. Read `git status --short --branch` and
   preserve existing changes.
2. Read the authoritative sources and affected methodology before changing files.
3. Inspect current files, scripts, and dependencies. Choose the smallest change
   that delivers the requested outcome and a check that could disprove it.
4. Before delegation, read the operational sections of the
   [agent policy](docs/development-methodology/agent-policy.md). It owns model
   routing, reasoning, reuse, concurrency, authority, and assistant lifecycle.

YAAGI implements Polyphony: one long-lived agent with a continuous identity,
local model ecology, and controlled reversible development. The concept,
architecture, ADRs, roadmap, and minimal TypeScript workspace are present.
`core-types` provides `Result`; `state` provides a database-neutral executable core
with an injected SQLite adapter and tested storage primitives.
`queue` provides durable jobs through the public state port with an injected
Agenda adapter; its local evidence and audit status are recorded in
`docs/validation/queue/local-queue-agenda.implementation.md`.
Agent runtime, domain modules, and product-level tests are not implemented. The `v0-archived` tag is
historical material, not a source of requirements for the new implementation.

## Sources and documentation

The source hierarchy is canonical concept → architecture/ADRs → system design →
module specification → module implementation plan → essential algorithms → code/tests.
The [roadmap](docs/roadmap.md) orders work without adding requirements. Issues
and Project entries are navigation. Stop only the dependent work when authority
or a material requirement conflicts; resolve the decision at its owning level.

- [Canonical concept](docs/polyphony_concept.md)
- [Architecture](docs/architecture.md) and [ADRs](docs/adr/)
- [System design methodology](docs/development-methodology/system-design.md) and [template](docs/development-methodology/templates/system-design.md)
- [Methodology and navigation](docs/development-methodology/README.md)
- [Document IDs and language](docs/development-methodology/documentation.md)
- [Package tooling](docs/development-methodology/tooling.md)

Use the accepted stable Document ID scheme for new or materially changed
canonical documents; do not rename existing artifacts merely to adopt IDs.
`README.md` and repository-wide agent instructions are English. Development
documentation is Russian; other translations require an operator request. The
Russian concept is authoritative.

## Git and local resources

Follow the [Git workflow](docs/development-methodology/git-and-github.md).
All repository changes, including documentation and configuration, follow
task worktree and branch → pull request → integration into `develop`.
`develop` is the default and integration branch; `master` accepts PRs only from
`develop`. Never commit changes directly, push directly, or force-push to either
branch. Task worktrees live under `.worktree/` in the main checkout. One task
owns one branch and worktree.

Create, publish, move, or delete Git tags only on the operator's direct request.
A merge or stable baseline decision does not authorize creating or publishing a tag.

Each worktree uses an ignored `.env` symlink to the main checkout's `.env`.
Treat the target as operator-owned and read-only. Do not copy, print, or commit
its contents. Inspect only symlink metadata when verifying setup.

Authorized work includes the local commits required to create stable audit and
remediation snapshots. Such a commit does not grant publication authority.
Push, PR, merge, history rewriting, and destructive cleanup require applicable
operator authorization; reuse authorization already given for this task.
Preserve unrelated changes and resources. After an authorized merge, verify
refs before ordinary safe branch/worktree cleanup, unless the operator asked to
retain the worktree.

Use `gh` and `gh-utility` for GitHub. Do not run `gh auth login`, `logout`,
`refresh`, `switch`, `setup-git`, or retrieve tokens. Verify every GitHub mutation
with a separate read. Do not create an Issue solely to obtain an audit ID.

## Implementation and verification

All authored code, including scripts and executable configuration, is TypeScript.
Do not add JavaScript or `.mjs` source files. Run `.ts` files directly with Node
only with the explicit `--experimental-strip-types` flag; stripping types does
not replace TypeScript checks. Generated JavaScript and third-party dependencies
are not authored sources.
Biome formatting uses single quotes for TypeScript and JSX; all package configs
inherit the shared root setting. JSON retains the quotes required by its syntax.

Apply `implementation-discipline` for implementation and substantive document
changes. Follow the [document relationship rule](docs/development-methodology/documentation.md#правило-связи-документов):
prepare and accept the system design for all modules of the target system before
continuing module development. A methodology or template alone does not satisfy
this prerequisite. Specify observable module behavior at public boundaries. Use one
specification and one compact plan per module; write them when that module is
next. Follow [module rules](docs/development-methodology/modules.md) and
[implementation rules](docs/development-methodology/implementation.md).

Run checks proportional to the change plus mandatory
[quality gates](docs/development-methodology/quality.md). Root package scripts
delegate to `packages/*`; with no packages they intentionally return an error.
Do not describe an empty test set, scaffolding, or documentation as runtime
capability. Keep README claims consistent with implemented behavior.

Follow the [audit policy](docs/development-methodology/audits.md) before merge:
independent reviewers read committed scoped snapshots without inherited context;
self-review does not replace a required audit. Model/reasoning selection comes
only from the agent policy. Preserve negative reports and verify remediation on
a new commit. Reuse a suitable reviewer for delta review; investigate the root
cause after three consecutive failures of one document.

Before completion, review the scoped diff, run `git diff --check`, account for
assistants and task-owned resources, and report verified results, remaining
limits, branch/HEAD, and any deliberately retained work. Stop once the requested
outcome is achieved.
