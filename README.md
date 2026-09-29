# YAAGI — Polyphony

YAAGI (Yet Another AGI) is a project to build Polyphony: an autonomous agent with a single identity, a shared biography, and goals that evolve through experience. Its continuity is intended to survive replacement of models, skills, and software modules.

## Project status

The repository contains the concept, modular architecture, architectural decision records, implementation roadmap, development methodology, and a verified TypeScript workspace. The first package, `@polyphony/core-types`, now exposes the compile-time-only `Result<T, E>` contract. No agent runtime exists yet, and the broader `core-types` roadmap step is not complete.

The [implementation roadmap](docs/roadmap.md) orders modules, experiments, and integration checks. The current `core-types` increment has its own [specification](docs/modules/core-types/specification.md) and [implementation plan](docs/modules/core-types/implementation-plan.md). That package does not yet provide identifiers, time, references, DTOs, error codes, helpers, validators, or runtime behavior; later common types will be added only when a real consumer requires them.

The first [`@polyphony/state` increment](packages/state/README.md) implements the [approved CP1 contract](docs/modules/state/specification.md#предложение-контракта-на-cp1): scoped snapshots/transactions, migration checks, fixed `sqlite-vec` loading, and backup on built-in `node:sqlite`. Public-export tests cover two owners using Drizzle and raw vector SQL on one connection, rollback/reopen, storage faults, and an unchanged M1 consumer with a test-only alternative. The [developer guide](packages/state/docs/usage.md) links a compiled, executable example. These package guarantees do not establish agent runtime, I1, E3, power-loss resilience, or another platform. The earlier [standalone spikes](experiments/state/README.md) remain supporting evidence, outside root CI.

## Architectural foundations

- Independent packages with public contracts, assembled into one runtime with a single decision cycle and executor.
- A local first deployment using TypeScript, Node.js, pnpm, and embedded SQLite, with `sqlite-vec` for vector storage and search. Detailed choices and versions belong in the architecture document.
- Database-neutral contracts and a Linux x64 SQLite adapter in `state`; a durable job API in `queue` remains planned. Liteque is the desktop queue candidate pending a recovery and lifecycle probe. Domain schemas, job intents, and receipts stay with their owners; no database server, Redis, Docker Compose, or `infrastructure` package is required.
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

These commands delegate to workspace packages. For `core-types`, they verify its compile-time contract and package boundary; for `state`, they also run real SQLite integration tests, M1, and the guide example. Both use TypeScript 7 for typechecking/build, Biome formatting, and Biome plus syntax-only ESLint linting. `state` prepares its public `core-types` dependency before typechecking, so fresh CI needs no private-source import bypass.

GitHub Actions runs the same root commands for pull requests and subsequent pushes to `develop` or `master`, using the frozen lockfile. Recursive pnpm execution runs each command in every workspace package that defines the corresponding script.

Import smoke tests alone prove resolution and absence of native import side effects, not storage behavior; `state` has separate real SQLite tests. Queue adapters, domain vector retrieval, model services, AI SDK, and experiments E1–E3 are not configured or running. No Expo app or mobile adapter has been created. The shared root `.env` remains operator-owned; task worktrees use a symlink and must not modify it. See the [tooling guide](docs/development-methodology/tooling.md) for package configuration conventions.

## Documentation

| Document | Purpose |
| --- | --- |
| [Polyphony concept](docs/polyphony_concept.md) | Canonical principles, intended capabilities, and project boundaries |
| [Modular architecture](docs/architecture.md) | Modules, dependencies, contracts, state ownership, integration, and recovery |
| [Architecture decisions](docs/adr/) | Rationale and constraints behind significant decisions |
| [Implementation roadmap](docs/roadmap.md) | Module order, experiments, dependencies, and integration evidence |
| [Development methodology](docs/development-methodology/README.md) | Specifications, plans, verification, and delivery workflow |
| [Local tooling](docs/development-methodology/tooling.md) | Pinned tools, package configurations, and delegated commands |
| [Contributing](CONTRIBUTING.md) | Entry point for repository work |

This README is maintained in English. The concept and development documentation are maintained in Russian. The [English concept translation](docs/polyphony_concept.en.md) does not yet include the clarification about a single operator and communication channels; the Russian original remains authoritative.
