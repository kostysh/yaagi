# YAAGI — Polyphony

YAAGI (Yet Another AGI) is a project to build Polyphony: an autonomous agent with a single identity, a shared biography, and goals that evolve through experience. Its continuity is intended to survive replacement of models, skills, and software modules.

## Project status

The project is in the design stage. This repository currently contains the concept, modular architecture, architectural decision records, and development methodology. The agent runtime and modules have not been implemented yet.

The next stage is to write module specifications and implementation plans, then develop the modules independently and integrate them. Startup and testing instructions will be added alongside the working implementation.

## Architectural foundations

- Independent packages with public contracts, assembled into one runtime with a single decision cycle and executor.
- A local first deployment using TypeScript, Node.js, pnpm, and PostgreSQL. Detailed choices and versions belong in the architecture document.
- Shared model access through `model-organs`, supporting language models, specialized classifiers, embeddings, and audio models as needed. The baseline local model and hardware profile still need to be selected and evaluated.
- Exactly one operator, with a two-way CLI in the first version. Other communication channels may be added as the system develops.

## Documentation

| Document | Purpose |
| --- | --- |
| [Polyphony concept](docs/polyphony_concept.md) | Canonical principles, intended capabilities, and project boundaries |
| [Modular architecture](docs/architecture.md) | Modules, dependencies, contracts, state ownership, integration, and recovery |
| [Architecture decisions](docs/adr/) | Rationale and constraints behind significant decisions |
| [Development methodology](docs/development-methodology/README.md) | Specifications, plans, verification, and delivery workflow |
| [Contributing](CONTRIBUTING.md) | Entry point for repository work |

This README is maintained in English. The concept and development documentation are maintained in Russian. The [English concept translation](docs/polyphony_concept.en.md) does not yet include the clarification about a single operator and communication channels; the Russian original remains authoritative.
