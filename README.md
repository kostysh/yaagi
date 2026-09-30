# YAAGI — Polyphony

YAAGI (Yet Another AGI) is a project to build Polyphony: an autonomous agent with a single identity, a shared biography, and goals that evolve through experience. Its continuity is intended to survive replacement of models, skills, and software modules.

## Project status

The repository contains the concept, modular architecture, architectural decision records, development methodology, and a verified TypeScript workspace. Three package increments are integrated into `develop`: [`@polyphony/core-types`](docs/modules/core-types/specification.md) provides the compile-time-only `Result<T, E>` contract, [`@polyphony/state`](packages/state/README.md) provides executable storage with an injected SQLite adapter, and [`@polyphony/queue`](packages/queue/README.md) provides durable jobs through `state` with an injected Agenda adapter. The broader `core-types` roadmap step remains incomplete, and no agent runtime exists yet.

The [development status in the roadmap](docs/roadmap.md#состояние-разработки) records delivered scope and acceptance/PR links for modules, experiments, and integration stages, followed by the implementation sequence and next step. Module specifications and package guides describe their public contracts and usage.

## Architectural foundations

- Independent packages with public contracts, assembled into one runtime with a single decision cycle and executor.
- A local first deployment using TypeScript, Node.js, pnpm, and embedded SQLite, with `sqlite-vec` for vector storage and search. Detailed choices and versions belong in the architecture document.
- Database-neutral contracts/core and an explicitly injected Linux x64 SQLite adapter in `state`. `queue` reuses its public `StoragePort` for a separate technical database and injects Agenda 6.2.6 as a replaceable processing adapter. A [local compatibility probe](experiments/queue/README.md) preceded implementation. Queue schemas, jobs, attempts, and results belong to `queue`; database drivers, connections, files, and backup remain in `state`. The composition root owns storage lifecycle. Domain job intents and receipts stay with their owners; the two databases retain separate commits and outbox coordination. No database server, Redis, Docker Compose, or `infrastructure` package is required.
- Shared contracts avoid Node-specific dependencies to leave room for future Expo adapters. Mobile execution, background scheduling, and a complete RAG pipeline are outside the current delivery scope.
- Shared model access through `model-organs`, supporting language models, specialized classifiers, embeddings, and audio models as needed. The baseline local model and hardware profile still need to be selected and evaluated.
- Exactly one operator, with a two-way CLI in the first version. Other communication channels may be added as the system develops.

## Local development setup

Use Node.js `24.21.0` (also recorded in `.nvmrc`). From the task worktree:

```bash
nvm use # when using nvm
npm install --global pnpm@10.34.5
pnpm --version
pnpm install --frozen-lockfile
```

Install pnpm with npm for the active Node installation. The project checks the exact Node/pnpm versions and does not download or switch package managers automatically. [pnpm workspace settings](https://pnpm.io/10.x/settings) control this behavior.

Modules live in `packages/`; `packages/core-types` is the first one. The shared TypeScript configuration targets emitted Node.js ESM and declarations with strict checking. Each TypeScript package provides its own compiler/Biome configuration, scripts, and tests. Biome alone handles formatting; linting runs Biome, ESLint, and the applicable package-boundary check.

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

These commands delegate to workspace packages. `core-types` checks its compile-time contract and package boundary; `state` and `queue` also run real SQLite integration tests, M1, and executable guide examples. All use TypeScript 7 for typechecking/build, Biome formatting, and Biome plus syntax-only ESLint linting. Packages prepare their public workspace dependencies before typechecking, so fresh CI needs no private-source import bypass. Queue migrations are included in its build output. Drizzle Kit's legacy esbuild dependency has a narrow pinned security override, without changing the root toolchain baseline.

GitHub Actions runs the same root commands for pull requests and subsequent pushes to `develop` or `master`, using the frozen lockfile. Recursive pnpm execution runs each command in every workspace package that defines the corresponding script.

Import smoke tests alone prove resolution and absence of tested import side effects, not storage or queue behavior; both packages have separate real integration tests. Domain vector retrieval, model services, AI SDK, and experiments E1–E3 are not configured or running. No Expo app or mobile adapter has been created. The shared root `.env` remains operator-owned; task worktrees use a symlink and must not modify it. See the [tooling guide](docs/development-methodology/tooling.md) for package configuration conventions.

## Documentation

| Document | Purpose |
| --- | --- |
| [Polyphony concept](docs/polyphony_concept.md) | Canonical principles, intended capabilities, and project boundaries |
| [Modular architecture](docs/architecture.md) | Modules, dependencies, contracts, state ownership, integration, and recovery |
| [Architecture decisions](docs/adr/) | Rationale and constraints behind significant decisions |
| [Implementation roadmap](docs/roadmap.md) | Development status, delivered scope, next step, and module/experiment/integration order |
| [Development methodology](docs/development-methodology/README.md) | Specifications, plans, verification, and delivery workflow |
| [Local tooling](docs/development-methodology/tooling.md) | Pinned tools, package configurations, and delegated commands |
| [Contributing](CONTRIBUTING.md) | Entry point for repository work |

This README is maintained in English. The concept and development documentation are maintained in Russian. The [English concept translation](docs/polyphony_concept.en.md) does not yet include the clarification about a single operator and communication channels; the Russian original remains authoritative.
