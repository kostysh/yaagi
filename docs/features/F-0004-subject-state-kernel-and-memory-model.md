---
id: F-0004
title: Ядро субъектного состояния и модель памяти
status: done
owners: ["@codex"]
area: memory
depends_on: [F-0001, F-0002, F-0003]
impacts: [runtime, db, memory, state]
created: 2026-03-23
updated: 2026-03-24
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/adr/ADR-2026-03-23-subject-state-evidence-refs.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
---

# F-0004 Ядро субъектного состояния и модель памяти

## 1. Context & Goal

- **User problem:** После `F-0001`, `F-0002` и `F-0003` система умеет безопасно стартовать и вести канонический tick lifecycle, но identity-bearing state всё ещё не имеет собственного владельца. Сейчас delivered runtime держит только узкий singleton `agent_state` для boot/tick handoff, а PSM, goals, beliefs, entities и relationships остаются архитектурой без выделенного feature owner. Без этого следующая реализация начинает либо размазывать память по ad hoc JSON/document fields и logs, либо подменять ядро личности `Mastra` memory, что архитектура прямо запрещает.
- **Goal (what success means):** Появляется канонический owner для PostgreSQL state-kernel слоя памяти: singleton `agent_state` расширяется до субъективного ядра, а `goals`, `beliefs`, `entities` и `relationships` получают явный durable contract, согласованный с boot/recovery и tick lifecycle. Следующие seams получают один внутренний путь для загрузки subject-state snapshot и применения tick-scoped state deltas без обращения к неканоническим caches.
- **Non-goals:** Narrative spine, field journal, memetic units/edges, perception buffer, Context Builder, operator-facing state API, workshop snapshot governance и full homeostat/governor semantics не входят в этот intake.

## 2. Scope

### In scope

- Ownership над identity-bearing PostgreSQL state kernel для `agent_state`, `goals`, `beliefs`, `entities` и `relationships`.
- Расширение уже delivered narrow `agent_state` row из `F-0003` до канонического singleton anchor для subject-state и continuity-bearing pointers.
- Внутренний runtime contract для загрузки subject-state snapshot и применения tick-scoped state changes из canonical tick lifecycle.
- Явная модель связи goals/beliefs с episodes/ticks как минимум на уровне evidence refs и recovery-safe reload semantics.
- Совместимость с `F-0001` boot/recovery и `F-0003` tick lifecycle, чтобы restart/recovery загружали последнее committed subject-state из PostgreSQL, а не из process-local памяти.

### Out of scope

- `memetic_units`, `memetic_edges`, narrative spine, field journal и другие narrative/memetic surfaces; ими владеет следующий cognition seam.
- Perception buffer, stimulus normalization, sensor adapters и intake backlog from external channels.
- Context Builder, model routing, Mastra Decision Agent и structured decision validation.
- Operator-facing HTTP API для чтения или управления state kernel.
- Dataset/export/training/eval pipelines, stable snapshot promotion и developmental governance.

### Constraints

- PostgreSQL state kernel остаётся единственным source of truth для identity-bearing memory; `Mastra` memory и message history не могут становиться каноническим self-memory.
- В системе должен остаться ровно один singleton `agent_state`; фича не имеет права создать второй identity-core anchor рядом с уже delivered boot/tick row.
- Subject-state updates должны согласовываться с `F-0003` tick transaction boundaries: failed/cancelled or rolled-back tick не может оставить partial identity drift в durable memory tables.
- Реализация не должна quietly втянуть в себя ownership над narrative/memetic/perception/cognition seams под предлогом "подготовки памяти".
- Schema/migration decisions этой фичи должны оставаться совместимыми с delivered `seed -> materialized runtime volumes` platform contract и с recovery/restart loading path.
- Identity-bearing write authority matrix из `docs/architecture/system.md` закрепляет `SubjectStateStore` как единственную canonical write boundary для `psm_json`, `goals`, `beliefs`, `entities` и `relationships`; обход store через direct SQL from neighbouring seams считается architecture defect.
- Subject-state schema evolution belongs to this seam: bounded snapshots must expose `subject_state_schema_version`, while boot/runtime consumers may validate compatibility but may not invent ad hoc migrations or alternate self-model schemas.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0004-01:** Канонический durable subject-memory surface живёт в PostgreSQL schema `polyphony_runtime` и состоит из ровно одного singleton `agent_state` plus normalized tables `goals`, `beliefs`, `entities` и `relationships`; runtime contracts `loadSubjectStateSnapshot(...)` и `applyTickStateDelta(...)` читают и пишут subject-state только через эти таблицы.
- **AC-F0004-02:** После `F-0001` / `F-0003` boot-to-runtime handoff система может `ensure` и `reload`-ить ровно одну строку `agent_state` c полями `agent_id`, `mode`, `current_tick_id`, `current_model_profile_id`, `last_stable_snapshot_id`, `psm_json` и `resource_posture_json`; новые JSON fields создаются с default `{}` и не ломают уже delivered boot/tick pointers.
- **AC-F0004-03:** Tick-scoped subject-state delta для `agent_state`, `goals`, `beliefs`, `entities` и `relationships` применяется только при terminal transition `completed` и только в той же SQL transaction, которая коммитит `tick.completed` и связанный episode; если transaction rollback-ится либо тик завершается `failed` / `cancelled`, subject-memory rows остаются без writes от этого тика.
- **AC-F0004-04:** `loadSubjectStateSnapshot(...)` возвращает bounded snapshot без narrative/memetic prerequisites: singleton `agent_state`, non-terminal goals в deterministic order `priority DESC, updated_at DESC`, beliefs в deterministic order `confidence DESC, updated_at DESC`, entities в bounded slice по canonical identity / recency и relationships только для возвращённых entities.
- **AC-F0004-05:** Goal transitions и belief revisions сохраняют явные `status` / `priority` / `confidence` semantics на текущей canonical row и хранят `evidence_refs_json` с ссылками на `episode_id` и/или `tick_id`; shaped implementation не удаляет silently goal/belief identity при обычном update-path.
- **AC-F0004-06:** После process restart или constitutional recovery runtime до следующего tick start reload-ит последнее committed subject-state из PostgreSQL и может заново собрать тот же bounded subjective snapshot без process-local reconstruction и без обращения к non-canonical memory layers.

## 4. Non-functional requirements (NFR)

- **Consistency:** Identity-bearing state не должен расходиться между tick lifecycle, boot/recovery и future context assembly.
- **Auditability:** Из durable state и evidence refs должно быть возможно восстановить, какие episodes/ticks повлияли на goal/belief revision.
- **Recoverability:** Restart/recovery не должен зависеть от in-memory reconstruction core self-state.
- **Performance:** Subjective snapshot assembly должна быть bounded и индексируемой; runtime не может делать full-table scans на каждом tick.
- **Scope discipline:** Memory core не должен подменять собой narrative, memetic или perception seams.

## 5. Design (compact)

### 5.1 Runtime and deployment surface

- Публичная HTTP surface этой фичи не открывается; контракт остаётся внутренним runtime/state boundary внутри уже delivered `polyphony-core`.
- Новых сервисов deployment cell или новых обязательных env vars фича не вводит: используются уже зафиксированные `core + postgres + vllm-fast` и existing PostgreSQL connection contract из `F-0002`.
- Ownership implementation seams:
  - `packages/db` владеет SQL-backed `SubjectStateStore`;
  - `apps/core/src/runtime` вызывает snapshot load после boot activation и перед context-building stage;
  - `F-0003` tick terminal path вызывает subject-state delta apply только на `completed` terminal path и внутри того же transaction boundary.
- Cross-cutting owner map for identity-bearing writes lives in `docs/architecture/system.md`: `F-0004` is the canonical writer for subject-state surfaces, while boot/recovery, runtime, router and future executive/reporting seams may only read snapshots or submit deltas through this store contract.
- Compact internal contract:

```ts
type EvidenceRef = {
  tickId?: string;
  episodeId?: string;
  kind: 'tick' | 'episode' | 'system' | 'operator';
  note?: string;
};

type SubjectStateSnapshot = {
  subjectStateSchemaVersion: string;
  agentState: {
    agentId: string;
    mode: 'inactive' | 'normal' | 'degraded' | 'recovery';
    currentTickId: string | null;
    currentModelProfileId: string | null;
    lastStableSnapshotId: string | null;
    psmJson: Record<string, unknown>;
    resourcePostureJson: Record<string, unknown>;
  };
  goals: Array<{
    goalId: string;
    title: string;
    status: 'proposed' | 'active' | 'blocked' | 'completed' | 'abandoned';
    priority: number;
    goalType: string;
    parentGoalId: string | null;
    rationaleJson: Record<string, unknown>;
    evidenceRefs: EvidenceRef[];
    updatedAt: string;
  }>;
  beliefs: Array<{
    beliefId: string;
    topic: string;
    proposition: string;
    confidence: number;
    status: 'candidate' | 'active' | 'superseded' | 'rejected';
    evidenceRefs: EvidenceRef[];
    updatedAt: string;
  }>;
  entities: Array<{
    entityId: string;
    entityKind: string;
    canonicalName: string;
    stateJson: Record<string, unknown>;
    trustJson: Record<string, unknown>;
    lastSeenAt: string | null;
    updatedAt: string;
  }>;
  relationships: Array<{
    srcEntityId: string;
    dstEntityId: string;
    relationKind: string;
    confidence: number;
    updatedAt: string;
  }>;
};

type SubjectStateDelta = {
  agentStatePatch?: {
    psmJson?: Record<string, unknown>;
    resourcePostureJson?: Record<string, unknown>;
    currentModelProfileId?: string | null;
    lastStableSnapshotId?: string | null;
  };
  goalUpserts?: Array<Record<string, unknown>>;
  beliefUpserts?: Array<Record<string, unknown>>;
  entityUpserts?: Array<Record<string, unknown>>;
  relationshipUpserts?: Array<Record<string, unknown>>;
};

interface SubjectStateStore {
  ensureSubjectStateAnchor(): Promise<void>;
  loadSubjectStateSnapshot(input?: {
    tickId?: string;
    goalLimit?: number;
    beliefLimit?: number;
    entityLimit?: number;
    relationshipLimit?: number;
  }): Promise<SubjectStateSnapshot>;
  applyTickStateDelta(input: {
    tickId: string;
    terminalStatus: 'completed';
    episodeId: string;
    delta: SubjectStateDelta;
  }): Promise<void>;
}
```

- `F-0001` остаётся владельцем boot gate и recovery preconditions.
- `F-0003` остаётся владельцем tick lifecycle, lease discipline, terminal tick status и episode/timeline ordering.
- `F-0004` не открывает operator API и не заменяет будущий `Context Builder`; он только даёт канонический subject-memory state-kernel surface, на который эти seams смогут опираться.
- `SubjectStateSnapshot` is versioned: `subjectStateSchemaVersion` is part of the canonical bounded snapshot contract consumed by boot/recovery, runtime and future cognition seams.
- Canonical `psm_json` principles:
  - allowed: bounded singleton self-model data, affect/posture summaries and other per-agent state that must reload atomically with the anchor row and does not require its own relational lifecycle;
  - forbidden: goals, beliefs, entities, relationships, narrative/memetic history, reports, action logs, model registry payloads and governance/development proposals;
  - relation to normalized tables: anything with its own row identity, evidence lineage, filtering/order semantics or partial mutation path must remain normalized rather than being mirrored into `psm_json`.
- `F-0004` owns subject-state schema migration/backfill and the compatibility contract behind `subjectStateSchemaVersion`; neighbouring seams consume the versioned snapshot but do not invent alternative schema policies.

### 5.2 Data model changes

- Текущий narrow `polyphony_runtime.agent_state` из `F-0003` становится canonical singleton anchor для subject-state, а не дублируется новой singleton-таблицей.
- `SubjectStateStore` remains the sole canonical write boundary for `agent_state.psm_json`, `goals`, `beliefs`, `entities` and `relationships`; neighbouring seams may orchestrate the transaction timing, but they do not gain permission to bypass the store or write those tables directly.
- The bounded snapshot contract exposes `subjectStateSchemaVersion` as an architecture-level invariant, even if physical storage reuses the singleton anchor's existing schema metadata field under the hood.
- `agent_state` schema expansion:
  - добавить `psm_json jsonb not null default '{}'::jsonb`;
  - добавить `resource_posture_json jsonb not null default '{}'::jsonb`;
  - сохранить existing `mode`, `current_tick_id`, `current_model_profile_id`, `last_stable_snapshot_id`, `schema_version`, `boot_state_json`, `development_freeze` и singleton invariant `id = 1`.
- `goals` table:
  - `goal_id text primary key`;
  - `title text not null`;
  - `status text not null check (status in ('proposed', 'active', 'blocked', 'completed', 'abandoned'))`;
  - `priority integer not null default 0`;
  - `goal_type text not null`;
  - `parent_goal_id text references polyphony_runtime.goals(goal_id) on delete set null`;
  - `rationale_json jsonb not null default '{}'::jsonb`;
  - `evidence_refs_json jsonb not null default '[]'::jsonb`;
  - `updated_at timestamptz not null default now()`.
- `beliefs` table:
  - `belief_id text primary key`;
  - `topic text not null`;
  - `proposition text not null`;
  - `confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1)`;
  - `status text not null check (status in ('candidate', 'active', 'superseded', 'rejected'))`;
  - `evidence_refs_json jsonb not null default '[]'::jsonb`;
  - `updated_at timestamptz not null default now()`.
- `entities` table:
  - `entity_id text primary key`;
  - `entity_kind text not null`;
  - `canonical_name text not null`;
  - `state_json jsonb not null default '{}'::jsonb`;
  - `trust_json jsonb not null default '{}'::jsonb`;
  - `last_seen_at timestamptz`;
  - `updated_at timestamptz not null default now()`.
- `relationships` table:
  - `src_entity_id text not null references polyphony_runtime.entities(entity_id) on delete cascade`;
  - `dst_entity_id text not null references polyphony_runtime.entities(entity_id) on delete cascade`;
  - `relation_kind text not null`;
  - `confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1)`;
  - `updated_at timestamptz not null default now()`;
  - primary key `(src_entity_id, dst_entity_id, relation_kind)`.
- Required indexes for bounded snapshot assembly:
  - `goals_active_priority_idx` on `(status, priority desc, updated_at desc)`;
  - `beliefs_snapshot_confidence_idx` on `(confidence desc, updated_at desc, belief_id asc)`;
  - `entities_name_idx` on `(canonical_name)`;
  - `entities_last_seen_idx` on `(last_seen_at desc nulls last, updated_at desc)`;
  - `relationships_src_idx` on `(src_entity_id, updated_at desc)`;
  - `relationships_dst_idx` on `(dst_entity_id, updated_at desc)`.
- Revision and evidence semantics fixed at spec level:
  - goals and beliefs are current-state rows, not append-only history tables in this phase;
  - ordinary mutation paths are `upsert` / status transition, not silent delete-and-recreate;
  - `evidence_refs_json` stores an array of `EvidenceRef` objects and is deduplicated by `(tickId, episodeId, kind)` according to repo-level ADR `ADR-2026-03-23 Subject-State Evidence Refs`;
  - entity merge / rename may update `canonical_name` and dependent relationships in place, but must keep canonical `entity_id` stability unless an explicit merge flow is implemented later.
- Если текущий delivered schema покрывает только runtime bootstrap fields, эта schema expansion остаётся в scope `F-0004`, а не становится скрытым prerequisite у следующей фичи.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- Restart после successful tick commit, но до следующего subjective snapshot load.
- Tick failure после частичной подготовки state delta.
- Contradictory belief revision versus existing confidence/evidence refs.
- Goal tree updates, где parent/child transition конфликтует с текущим active state.
- Entity merge/rename, который меняет canonical identity, но должен сохранить usable relationships and evidence lineage.
- Recovery path, где last stable snapshot pointer существует, но subject-state schema version or fields уже эволюционировали.

### 5.5 Failure modes and recovery boundaries

- Crash-after-delta-before-commit: если процесс падает после подготовки subject-state delta, но до `commit`, terminal tick status и subject-state updates откатываются вместе.
- Bootstrap-row upgrade: уже существующий singleton `agent_state` из `F-0003` должен пережить миграцию с backfilled JSON defaults, без ручного reseed и без второго singleton row.
- Duplicate upsert replay: повторное применение одного и того же goal/belief/entity mutation для того же terminal tick не должно создавать duplicate rows или терять existing evidence refs.
- Failed/cancelled tick drift: failure metadata допускается только в tick/event surfaces; failed/cancelled terminal paths вообще не принимают subject-state delta и не должны писать в `goals`, `beliefs`, `entities`, `relationships`.
- Relationship integrity: relationship rows не могут пережить удаление/merge entity как orphaned links; FK and merge path must keep snapshot graph valid.
- Restart/recovery race: boot/recovery reload обязан читать только committed state и не может полагаться на process-local cache warmup между перезапусками.

### 5.6 Verification surface

- Fast path:
  - integration tests для schema/bootstrap of `agent_state` expansion and normalized tables;
  - integration tests для `loadSubjectStateSnapshot(...)` ordering, bounds and relationship filtering;
  - integration tests для terminal tick transaction coupling and rollback semantics;
  - integration tests для goal/belief evidence refs and status/priority/confidence updates;
  - restart-focused integration tests, которые поднимают новый DB client / runtime store и подтверждают reload without process-local cache.
- Containerized smoke path:
  - так как фича влияет на runtime restart behavior, `pnpm smoke:cell` при реализации должен подтвердить: subject-state row/tables materialize inside canonical deployment cell, successful tick commit survives `core` restart, следующий boot/runtime load видит committed snapshot;
  - smoke остаётся в рамках phase-0 topology `core + postgres + vllm-fast` и не вводит отдельный memory service.
- Manual/operator surface:
  - достаточно inspection через PostgreSQL rows, health/logs and timeline during implementation;
  - operator-facing state API по-прежнему остаётся вне scope.

## 6. Definition of Done

- Все AC-F0004-* покрыты automated tests с явными ссылками на AC IDs.
- Singleton `agent_state` больше не остаётся narrow boot/tick pointer only и согласованно удерживает identity-bearing state alongside runtime pointers без второго core anchor.
- Subject-state snapshot и tick-scoped state delta contracts работают через PostgreSQL state kernel, а не через `Mastra` memory или ad hoc caches.
- Реализация явно связывает subject-state delta с terminal tick transaction boundary из `F-0003`.
- Restart/recovery path подтверждает reload последнего committed subject-state без manual reconstruction и без process-local bootstrap hacks.
- Для runtime-affecting поведения подтверждены и fast integration path, и containerized smoke path.
- `docs/ssot/index.md` синхронизирован, dossier lint проходит без ошибок и предупреждений, а coverage map остаётся AC-linked.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0004-01: Subject-state schema expansion and singleton anchor
Delivers: PostgreSQL substrate for subject-memory by expanding the existing `agent_state` singleton and adding normalized `goals`, `beliefs`, `entities`, and `relationships` tables with the required indexes.
Covers: AC-F0004-01, AC-F0004-02
Verification: `integration`
Exit criteria:
- Existing phase-0 databases migrate forward without creating a second singleton anchor.
- `agent_state` exposes `psm_json` and `resource_posture_json` with backfilled `{}` defaults and preserved boot/tick pointers.
- The normalized tables and indexes needed for bounded snapshot assembly exist in `polyphony_runtime`.
Tasks:
- **T-F0004-01:** Add the migration that expands `polyphony_runtime.agent_state` and creates `goals`, `beliefs`, `entities`, and `relationships` with the planned constraints and indexes. Covers: AC-F0004-01, AC-F0004-02.
- **T-F0004-02:** Extend DB bootstrap/store setup so `ensureSubjectStateAnchor()` preserves the singleton invariant and initializes the new subject-state columns safely. Covers: AC-F0004-02.

### Slice SL-F0004-02: Bounded subjective snapshot assembly
Delivers: a deterministic `loadSubjectStateSnapshot(...)` path that reads the singleton anchor plus bounded goal/belief/entity/relationship slices without relying on narrative or memetic layers.
Covers: AC-F0004-01, AC-F0004-04
Verification: `integration`
Exit criteria:
- Snapshot queries return deterministic ordering and respect configured limits.
- Relationship rows are filtered to the returned entity slice instead of leaking the full graph.
- The runtime can obtain a complete bounded subjective snapshot from PostgreSQL alone.
Tasks:
- **T-F0004-03:** Implement `loadSubjectStateSnapshot(...)` with deterministic ordering, per-surface limits, and relationship filtering against the selected entities. Covers: AC-F0004-04.
- **T-F0004-04:** Add integration coverage for snapshot bounds, ordering, and zero-dependency loading from the canonical PostgreSQL state kernel. Covers: AC-F0004-01, AC-F0004-04.

### Slice SL-F0004-03: Goal, belief, entity, and relationship mutation semantics
Delivers: current-state upsert semantics and evidence-link handling for goals, beliefs, entities, and relationships, aligned to the cross-cutting `EvidenceRef` ADR.
Covers: AC-F0004-01, AC-F0004-05
Verification: `integration`, `contract`
Exit criteria:
- Goal and belief updates preserve canonical row identity and mutate status/priority/confidence explicitly instead of delete-and-recreate flows.
- `evidence_refs_json` is normalized and deduplicated according to the repo-level ADR.
- Entity and relationship upserts preserve FK integrity and bounded graph validity.
Tasks:
- **T-F0004-05:** Implement goal and belief upsert rules, including `EvidenceRef` normalization/deduplication and explicit status/priority/confidence updates. Covers: AC-F0004-05.
- **T-F0004-06:** Implement entity and relationship upsert rules with FK-safe merge/rename constraints and deterministic overwrite semantics. Covers: AC-F0004-01, AC-F0004-05.

### Slice SL-F0004-04: Completed-tick delta commit and F-0003 terminal-path realignment
Delivers: `applyTickStateDelta(...)` on the `tick.completed` terminal path only, in the same transaction as `tick.completed` and episode commit, with explicit no-mutation behavior for `failed` and `cancelled`.
Covers: AC-F0004-03
Verification: `integration`
Exit criteria:
- Subject-state writes happen only inside the successful completed-tick transaction boundary.
- Rollback of the completed-tick transaction leaves subject-memory unchanged.
- The already delivered `F-0003` terminal path is explicitly realigned to call the subject-state store only on `completed`.
Tasks:
- **T-F0004-07:** Implement `applyTickStateDelta(...)` so it commits only with `tick.completed` plus committed `episode_id`, and rolls back with the owning transaction. Covers: AC-F0004-03.
- **T-F0004-08:** Realign the delivered `F-0003` completed terminal path to invoke subject-state delta application, while keeping `tick.failed` and `tick.cancelled` as non-mutating memory paths. Covers: AC-F0004-03.

### Slice SL-F0004-05: Restart/recovery reload and deployment-cell verification
Delivers: reload of committed subject-state after boot/recovery and restart, plus canonical deployment-cell verification for restart/reload continuity.
Covers: AC-F0004-02, AC-F0004-06
Verification: `integration`, `smoke`
Exit criteria:
- A fresh runtime process can reload the last committed subject-state without process-local reconstruction.
- Constitutional recovery and normal restart both re-enter the runtime with a usable bounded subjective snapshot.
- The deployment-cell smoke path proves committed subject-state survives `core` restart in the canonical cell.
Tasks:
- **T-F0004-09:** Wire post-boot/runtime reload to read the committed subject-state anchor and bounded snapshot before the next tick stage depends on it. Covers: AC-F0004-02, AC-F0004-06.
- **T-F0004-10:** Add integration and deployment-cell smoke coverage for restart/recovery reload of committed subject-state. Covers: AC-F0004-06.

## 8. Suggested issue titles

- `F-0004 / SL-F0004-01 Subject-state schema expansion and singleton anchor` → [SL-F0004-01](#slice-sl-f0004-01-subject-state-schema-expansion-and-singleton-anchor)
- `F-0004 / SL-F0004-02 Bounded subjective snapshot assembly` → [SL-F0004-02](#slice-sl-f0004-02-bounded-subjective-snapshot-assembly)
- `F-0004 / SL-F0004-03 Goal, belief, entity, and relationship mutation semantics` → [SL-F0004-03](#slice-sl-f0004-03-goal-belief-entity-and-relationship-mutation-semantics)
- `F-0004 / SL-F0004-04 Completed-tick delta commit and F-0003 terminal-path realignment` → [SL-F0004-04](#slice-sl-f0004-04-completed-tick-delta-commit-and-f-0003-terminal-path-realignment)
- `F-0004 / SL-F0004-05 Restart/recovery reload and deployment-cell verification` → [SL-F0004-05](#slice-sl-f0004-05-restartrecovery-reload-and-deployment-cell-verification)
## 9. Test plan & Coverage map

| AC ID | Planned test reference | Status |
|---|---|---|
| AC-F0004-01 | `packages/db/test/subject-state-store.integration.test.ts` → `test("AC-F0004-01 uses PostgreSQL as the canonical subject-memory state kernel")` | done |
| AC-F0004-02 | `packages/db/test/subject-state-store.integration.test.ts` → `test("AC-F0004-02 reloads the singleton agent_state with identity-bearing fields after boot handoff")` | done |
| AC-F0004-03 | `packages/db/test/subject-state-transaction.integration.test.ts` → `test("AC-F0004-03 commits or rolls back subject-state mutations atomically with terminal tick outcome")` | done |
| AC-F0004-04 | `packages/db/test/subject-state-store.integration.test.ts` → `test("AC-F0004-04 assembles a bounded subjective snapshot without narrative or memetic prerequisites")` | done |
| AC-F0004-05 | `packages/db/test/belief-goal-revision.integration.test.ts` → `test("AC-F0004-05 preserves goal and belief traceability through status and evidence refs")` | done |
| AC-F0004-06 | `packages/db/test/subject-state-restart.integration.test.ts` → `test("AC-F0004-06 reloads the last committed subject-state after restart without process-local reconstruction")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0004-06 reloads the last committed subject-state after restart without process-local reconstruction")` | done |

План верификации:

- Fast path: `packages/db/test/*.test.ts` covers state store bootstrap, bounded snapshot assembly, transactional commit/rollback and restart/reload behavior.
- Smoke path: `infra/docker/deployment-cell.smoke.ts` confirms committed subject-state survives `core` restart inside the canonical deployment cell.
- Supplemental runtime verification: `apps/core/src/runtime/runtime-lifecycle.ts` keeps the completed-tick coupling with `F-0003` explicit and reloads the subject-state snapshot during runtime initialization.
- Cross-cutting ownership dependencies:
  - `Identity-bearing write authority` in `docs/architecture/system.md` treats `F-0004` as the provider contract for subject-state writes and bounded snapshots.
  - Future cognitive seams (`CF-005`, `CF-017`, `CF-018`) consume subject-state only through this canonical store boundary and do not inherit direct write ownership over the underlying tables.
  - `subject_state_schema_version` is part of the bounded snapshot contract consumed by `F-0001`, `F-0003` and future cognition/consolidation seams; compatibility checks live outside the store, but schema ownership stays here.

## 10. Decision log (ADR blocks)

### ADR-F0004-01: Extend the existing `agent_state` singleton instead of creating a second identity-core anchor
- Status: Accepted
- Context: `F-0003` already delivered a narrow singleton `agent_state` row for boot/tick handoff. If `CF-003` introduces a second singleton for PSM/self-state, boot/recovery and tick runtime would immediately get two competing anchors for one subject.
- Decision: `F-0004` extends the existing `agent_state` row into the canonical identity-bearing singleton anchor, while normalized tables (`goals`, `beliefs`, `entities`, `relationships`) live alongside it. A separate second singleton for core self-state is not allowed.
- Alternatives: Introduce a new `psm_state` singleton beside `agent_state`; treat PSM as a document outside PostgreSQL state kernel.
- Consequences: Boot/recovery, tick runtime and core memory keep one anchor row; schema evolution must be careful, but continuity rules stay coherent.

### ADR-F0004-02: Subject-state deltas are committed only on `tick.completed`
- Status: Accepted
- Context: `F-0004` needs an atomic coupling point between subject-memory writes and the terminal tick lifecycle from `F-0003`. Allowing arbitrary deltas on `failed` or `cancelled` paths would make AC-F0004-03 ambiguous and complicate restart/reload semantics.
- Decision: In this phase, subject-state delta application is allowed only on the `tick.completed` terminal path and requires a committed `episode_id`. `tick.failed` and `tick.cancelled` may emit events and failure metadata, but they never mutate subject-memory rows.
- Alternatives: Allow explicitly marked deltas on `failed`/`cancelled` paths; introduce a separate accepted-delta protocol for non-completed ticks.
- Consequences: Implementation and tests get one deterministic commit boundary; richer failure-side memory semantics, if ever needed, must be introduced explicitly in a later dossier or ADR.

## 11. Progress & links

- Status: `proposed` → `shaped` → `planned` → `done`
- Issue: -
- PRs:
  - -
- Code:
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `docs/architecture/system.md`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/003_subject_state_kernel.sql`
  - `packages/db/src/index.ts`
  - `packages/db/src/runtime.ts`
  - `packages/db/src/subject-state.ts`
  - `packages/db/test/belief-goal-revision.integration.test.ts`
  - `packages/db/testing/subject-state-db-harness.ts`
  - `packages/db/test/subject-state-restart.integration.test.ts`
  - `packages/db/test/subject-state-store.integration.test.ts`
  - `packages/db/test/subject-state-transaction.integration.test.ts`

## 12. Change log

- **v1.0 (2026-03-23):** Initial dossier created from candidate `CF-003`; intake fixed ownership of the PostgreSQL subject-memory kernel, explicitly separated it from narrative/memetic/perception seams, and anchored the feature to the existing `agent_state` singleton delivered by the boot/tick backbone.
- **v1.1 (2026-03-23):** `spec-compact` refined ACs into testable runtime/data contracts, fixed schema/index/revision semantics for `agent_state` + `goals`/`beliefs`/`entities`/`relationships`, and added explicit verification boundaries for restart/reload behavior.
- **v1.2 (2026-03-23):** Post-review realignment promoted evidence-reference encoding to a repo-level ADR and made subject-state delta semantics explicit: only `tick.completed` may commit subject-memory changes in this phase.
- **v1.3 (2026-03-23):** `plan-slice` completed: dossier moved to `planned`, decomposed into five delivery slices, and made the `F-0003` terminal-path realignment plus restart/reload smoke verification explicit.
- **v1.4 (2026-03-23):** `implementation` completed: subject-state schema/store/runtime wiring shipped, bounded snapshot + delta semantics landed in `packages/db`, the completed-tick path now commits subject-state atomically with episodes, restart/reload proof was added to fast tests and deployment-cell smoke, the beliefs snapshot index was realigned to the delivered query contract, and architecture terminology was updated to the delivered evidence-ref and subject-state contracts.
- **v1.5 (2026-03-24):** `change-proposal`: aligned `F-0004` with the repo-level identity-bearing write-authority matrix by making `SubjectStateStore` the explicit sole writer for `psm_json`, `goals`, `beliefs`, `entities` and `relationships`, while keeping narrative/memetic and other future cognition surfaces outside this delivered subject-state scope.
- **v1.6 (2026-03-24):** `change-proposal`: added the missing schema-evolution layer to the delivered subject-state contract. The dossier now treats bounded snapshots as versioned via `subject_state_schema_version`, fixes the JSON-vs-normalized decision rule and makes `F-0004` the explicit owner of compatibility, migration and backfill semantics for subject-state surfaces.
