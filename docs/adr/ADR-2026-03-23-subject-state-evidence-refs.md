# ADR-2026-03-23 Subject-State Evidence Refs

- Status: Accepted
- Date: 2026-03-23
- Related: [F-0004](../features/F-0004-subject-state-kernel-and-memory-model.md), [F-0003](../features/F-0003-tick-runtime-scheduler-episodic-timeline.md), [system.md](../architecture/system.md)

## Context

Архитектура фиксирует, что beliefs/goals и соседние memory surfaces должны сохранять traceability к субъективной линии времени, но текущая таблица в `system.md` задаёт для `beliefs` только `evidence_episode_ids`.

На практике этого недостаточно для phase-0/1 runtime seam:

- часть state revisions будет рождаться на terminal boundary самого тика ещё до richer narrative layers;
- goals, beliefs, entities и relationships должны использовать один согласованный evidence encoding, а не разные ad hoc поля;
- будущие context/API/consolidation seams унаследуют этот encoding, поэтому его нельзя оставлять скрытым решением внутри одного dossier.

## Decision

Репозиторий закрепляет единый evidence reference encoding для subject-state surfaces:

- canonical field name: `evidence_refs_json`;
- shape: array of objects `{ tickId?, episodeId?, kind, note? }`;
- allowed `kind` values for this phase: `tick`, `episode`, `system`, `operator`;
- for belief and goal updates, refs may point to `tick_id`, `episode_id`, or both;
- duplicate refs are removed by the tuple `(tickId, episodeId, kind)`.

Interpretation rules:

- `episodeId` remains the preferred higher-level narrative anchor when an episode exists;
- `tickId` is allowed as a direct continuity anchor for phase-0/1 flows that commit on terminal tick boundaries before richer narrative layers are present;
- this ADR sets the cross-cutting encoding contract only; it does not require append-only history tables in the current phase.

## Alternatives

- Keep `beliefs.evidence_episode_ids` and let other surfaces invent their own evidence fields later.
- Use only `episode_id` links and forbid direct `tick_id` references until narrative layers arrive.
- Store evidence linkage only in timeline/log payloads instead of normalized subject-state rows.

## Consequences

- `F-0004` can shape one consistent contract for goals, beliefs, entities and relationships without inventing a feature-local exception.
- Future architecture/data-model updates should converge on `evidence_refs_json` instead of duplicating `evidence_episode_ids`.
- Later dossiers that need richer provenance or history can extend this encoding, but they must stay compatible with this baseline contract unless superseded by a new ADR.
