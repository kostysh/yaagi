# yaagi
Yet Another AGI

## Concept

`yaagi` is an implementation path for the Polyphony concept: one long-lived, identity-bearing agent with its continuity anchored outside any single model.

- Concept document: [English translation](docs/polyphony_concept.en.md), [canonical Russian original](docs/polyphony_concept.md)
- The agent lives through ticks, keeps a single timeline, and stores durable state in a PostgreSQL-based state kernel.
- AI SDK is used as the thin reasoning and model-integration substrate, while Polyphony Runtime keeps ownership of identity, memory, temporal continuity, execution discipline, skills, and workflows.
- Local model services act as cognitive organs, not as separate personalities.
- The workspace, skills, and code body are Git-governed, while constitutional constraints define boot, recovery, and operating boundaries.
- The system is designed to grow in phases: from a local deployment cell, to a richer runtime, to workshop-driven model evolution and controlled body change.

## Basic Workflow

Canonical documentation entry points:
- `docs/architecture/system.md`
- `.dossier/backlog/`
- `docs/ssot/index.md`
- `docs/ssot/features/F-*.md`

Canonical automation path:
- Root `pnpm` scripts cover repository-local quality, test, and smoke flows only.
- Backlog and dossier automation is executed through the installed canonical `dossier-engineer` runtime from the `unified-dossier-engineer` skill.
- In repo docs, `dossier-engineer <command>` is shorthand for that installed skill runtime; absolute local paths are intentionally omitted.
- The repository does not vend embedded local copies, wrappers, or package aliases for those CLIs.

Common backlog and dossier commands:
- `dossier-engineer status`
- `dossier-engineer queue`
- `dossier-engineer gaps`
- `dossier-engineer index-refresh`
- `dossier-engineer sync-index`
- `dossier-engineer lint-dossiers`
- `dossier-engineer coverage-audit`
- `dossier-engineer next-step --dossier docs/ssot/features/F-0001-constitutional-boot-recovery.md`
- `dossier-engineer dossier-verify --step implementation --changed-only`
- `dossier-engineer dependency-graph`

## Developer Runtime Notes

Canonical engineering decisions for the repo:
- package manager and command surface: `pnpm`
- runtime baseline: `Node.js 22 + TypeScript`
- default execution path for local TypeScript code: `node --experimental-strip-types`
- local secret-bearing overrides: repo-root `.env.local` (gitignored), with checked-in shape in `.env.example`; canonical local-secret launch paths are `pnpm cell:up:local` and `pnpm smoke:cell:local`, while application code continues to read `process.env`
- external secret-file override is supported for `YAAGI_TELEGRAM_BOT_TOKEN_FILE`, so production/container launches may inject the bot token through Docker secrets or an equivalent mounted secret file instead of repo-tracked config
- operator routes other than `GET /health` require `YAAGI_OPERATOR_AUTH_PRINCIPALS_FILE`, a mounted/static JSON principal file with `schemaVersion: "2026-04-23.operator-auth.v1"` and SHA-256 token hashes only; missing/corrupt auth config or unavailable auth audit storage fails protected routes closed
- optional richer local model endpoints use `YAAGI_DEEP_MODEL_BASE_URL` and `YAAGI_POOL_MODEL_BASE_URL`; they default to local loopback `:8001/:8002`, stay non-boot-critical, and surface through `F-0014` source diagnostics as explicit unavailable/degraded state when the services are absent
- canonical fast local-model baseline is `google/gemma-4-E4B-it` over `vllm/vllm-openai-rocm:gemma4`; first cold boot from an empty runtime `/models` volume may take several minutes because the artifact must materialize before `vllm-fast` becomes healthy, and local Docker/smoke runs should prefer `YAAGI_HF_TOKEN_FILE` (with `YAAGI_HF_TOKEN` kept only as a compatibility fallback that local infra automation materializes into a temp secret file)
- default test runner: `node:test`
- canonical quality/style toolchain: `Biome + ESLint`
- fast code verification: `pnpm test`
- canonical changed-code flow: `pnpm quality:fix`
- canonical automation gate: `pnpm quality:check`
- minimum GitHub Actions testing workflow: `.github/workflows/test.yml` runs `pnpm quality:check` then `pnpm test` on `pull_request` and `push` to `master`
- containerized phase-0 smoke verification: `pnpm smoke:cell`
  runs a suite-scoped deployment-cell harness with deterministic runtime resets between individual scenarios inside each scenario family instead of per-test full `compose down/up`, and Telegram-specific smoke overlays reuse the same shared `vllm-fast` runtime instead of booting a second model stack
  the harness also keeps one smoke-only direct PostgreSQL client over a smoke overlay port instead of repeated `docker compose exec postgres psql` polling during steady-state waits

Repo-level ADRs:
- `docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
- `docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `docs/adr/ADR-2026-03-19-boot-dependency-contract.md`
- `docs/adr/ADR-2026-03-19-quality-gate-sequence.md`
