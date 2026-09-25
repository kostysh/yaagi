# YAAGI — Polyphony

YAAGI (Yet Another AGI) is a project to build Polyphony: an autonomous agent with a single identity, a shared biography, and goals that evolve through experience. Its continuity is intended to survive replacement of models, skills, and software modules.

## Project status

The repository contains the concept, modular architecture, architectural decision records, implementation roadmap, development methodology, and a minimal TypeScript workspace. The agent runtime and modules have not been implemented yet.

The [implementation roadmap](docs/roadmap.md) orders modules, experiments, and integration checks. The next module is `core-types`: its specification and implementation plan will be written immediately before development. Other module specifications follow when their turn comes.

## Architectural foundations

- Independent packages with public contracts, assembled into one runtime with a single decision cycle and executor.
- A local first deployment using TypeScript, Node.js, pnpm, PostgreSQL, and BullMQ with Redis. Detailed choices and versions belong in the architecture document.
- Database-neutral contracts in `state`, a typed durable job API in `queue`, and a separate `infrastructure` workspace package for Docker Compose. Connectors stay in their modules; domain job intents and receipts stay with their owners. These packages are planned, not implemented.
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

Modules will live in `packages/`; it currently contains only `.gitkeep`. The shared TypeScript configuration targets emitted Node.js ESM and declarations with strict checking. Each code module will provide its own compiler/Biome configuration, scripts, and tests as it is implemented. The future `infrastructure` package will validate Compose and real service behavior; TypeScript checks apply only if it contains TypeScript code. Biome owns the current formatting/lint baseline.

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

These commands delegate to workspace packages. With no modules present, they intentionally fail with “No projects matched the filters”; that is not a failed module test, and an empty workspace is not reported as a passing test suite. The bootstrap is verified with a temporary package that is removed afterward.

PostgreSQL, Redis/BullMQ, containers, model services, AI SDK, CI, and experiments E1–E3 are not configured or run by this bootstrap. The next step is the `core-types` specification in the same task worktree. The shared root `.env` remains operator-owned; task worktrees use a symlink and must not modify it. See the [tooling guide](docs/development-methodology/tooling.md) for package configuration conventions.

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
