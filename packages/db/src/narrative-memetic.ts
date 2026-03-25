import type { Client, QueryResultRow } from 'pg';
import type { NarrativeMemeticTickDelta } from '@yaagi/contracts/cognition';

export type NarrativeMemeticDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';
const DEFAULT_ACTIVE_UNIT_LIMIT = 8;
const DEFAULT_FIELD_JOURNAL_LIMIT = 5;
const DEFAULT_EDGE_LIMIT = 16;

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;

const memeticUnitsTable = runtimeSchemaTable('memetic_units');
const memeticEdgesTable = runtimeSchemaTable('memetic_edges');
const coalitionsTable = runtimeSchemaTable('coalitions');
const narrativeSpineVersionsTable = runtimeSchemaTable('narrative_spine_versions');
const fieldJournalEntriesTable = runtimeSchemaTable('field_journal_entries');

const normalizeJsonArray = <T>(value: unknown): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as T[];
};

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`narrative/memetic field ${field} must be a string or Date timestamp`);
};

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

export type NarrativeMemeticUnitRow = {
  unitId: string;
  originKind: 'seeded' | 'consolidated' | 'governor_labeled';
  unitType: string;
  abstractLabel: string;
  canonicalSummary: string;
  activationScore: number;
  reinforcementScore: number;
  decayScore: number;
  evidenceScore: number;
  status: 'active' | 'dormant' | 'quarantined' | 'retired' | 'merged';
  lastActivatedTickId: string | null;
  createdByPath: string;
  provenanceAnchorsJson: string[];
  createdAt: string;
  updatedAt: string;
};

export type NarrativeMemeticEdgeRow = {
  edgeId: string;
  sourceUnitId: string;
  targetUnitId: string;
  relationKind: 'supports' | 'suppresses' | 'contextualizes' | 'contradicts';
  strength: number;
  confidence: number;
  tickId: string;
  updatedAt: string;
};

export type NarrativeMemeticCoalitionRow = {
  coalitionId: string;
  tickId: string;
  decisionMode: 'reactive' | 'deliberative' | 'contemplative';
  vector: string;
  memberUnitIdsJson: string[];
  supportScore: number;
  suppressionScore: number;
  winning: boolean;
  createdAt: string;
};

export type NarrativeSpineVersionRow = {
  versionId: string;
  tickId: string;
  basedOnVersionId: string | null;
  currentChapter: string;
  summary: string;
  continuityDirection: string;
  tensionsJson: Array<{
    tensionId: string;
    summary: string;
    severity: number;
  }>;
  provenanceAnchorsJson: string[];
  createdAt: string;
};

export type FieldJournalEntryRow = {
  entryId: string;
  tickId: string;
  entryType: string;
  summary: string;
  interpretation: string;
  tensionMarkersJson: string[];
  maturityState: 'immature' | 'tracking' | 'escalated';
  linkedUnitId: string | null;
  provenanceAnchorsJson: string[];
  createdAt: string;
};

export type NarrativeMemeticSnapshot = {
  activeUnits: NarrativeMemeticUnitRow[];
  activeEdges: NarrativeMemeticEdgeRow[];
  latestNarrativeVersion: NarrativeSpineVersionRow | null;
  recentFieldJournalEntries: FieldJournalEntryRow[];
};

export type NarrativeMemeticSnapshotInput = {
  activeUnitLimit?: number;
  fieldJournalLimit?: number;
  edgeLimit?: number;
};

export type NarrativeMemeticApplyTickInput = {
  tickId: string;
  episodeId: string;
  delta: NarrativeMemeticTickDelta;
};

export type NarrativeMemeticStore = {
  loadSnapshot(input?: NarrativeMemeticSnapshotInput): Promise<NarrativeMemeticSnapshot>;
  applyTickDelta(input: NarrativeMemeticApplyTickInput): Promise<void>;
};

const memeticUnitColumns = `
  unit_id as "unitId",
  origin_kind as "originKind",
  unit_type as "unitType",
  abstract_label as "abstractLabel",
  canonical_summary as "canonicalSummary",
  activation_score::float8 as "activationScore",
  reinforcement_score::float8 as "reinforcementScore",
  decay_score::float8 as "decayScore",
  evidence_score::float8 as "evidenceScore",
  status,
  last_activated_tick_id as "lastActivatedTickId",
  created_by_path as "createdByPath",
  provenance_anchors_json as "provenanceAnchorsJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const memeticEdgeColumns = `
  edge_id as "edgeId",
  source_unit_id as "sourceUnitId",
  target_unit_id as "targetUnitId",
  relation_kind as "relationKind",
  strength::float8 as "strength",
  confidence::float8 as "confidence",
  tick_id as "tickId",
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const narrativeVersionColumns = `
  version_id as "versionId",
  tick_id as "tickId",
  based_on_version_id as "basedOnVersionId",
  current_chapter as "currentChapter",
  summary,
  continuity_direction as "continuityDirection",
  tensions_json as "tensionsJson",
  provenance_anchors_json as "provenanceAnchorsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const fieldJournalColumns = `
  entry_id as "entryId",
  tick_id as "tickId",
  entry_type as "entryType",
  summary,
  interpretation,
  tension_markers_json as "tensionMarkersJson",
  maturity_state as "maturityState",
  linked_unit_id as "linkedUnitId",
  provenance_anchors_json as "provenanceAnchorsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeMemeticUnitRow = (row: QueryResultRow): NarrativeMemeticUnitRow => ({
  ...(row as unknown as NarrativeMemeticUnitRow),
  provenanceAnchorsJson: normalizeJsonArray<string>(row['provenanceAnchorsJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'memetic_units.createdAt'),
  updatedAt: normalizeTimestamp(row['updatedAt'], 'memetic_units.updatedAt'),
});

const normalizeMemeticEdgeRow = (row: QueryResultRow): NarrativeMemeticEdgeRow => ({
  ...(row as unknown as NarrativeMemeticEdgeRow),
  updatedAt: normalizeTimestamp(row['updatedAt'], 'memetic_edges.updatedAt'),
});

const normalizeNarrativeVersionRow = (row: QueryResultRow): NarrativeSpineVersionRow => ({
  ...(row as unknown as NarrativeSpineVersionRow),
  tensionsJson: normalizeJsonArray<NarrativeSpineVersionRow['tensionsJson'][number]>(
    row['tensionsJson'],
  ),
  provenanceAnchorsJson: normalizeJsonArray<string>(row['provenanceAnchorsJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'narrative_spine_versions.createdAt'),
});

const normalizeFieldJournalRow = (row: QueryResultRow): FieldJournalEntryRow => ({
  ...(row as unknown as FieldJournalEntryRow),
  tensionMarkersJson: normalizeJsonArray<string>(row['tensionMarkersJson']),
  provenanceAnchorsJson: normalizeJsonArray<string>(row['provenanceAnchorsJson']),
  linkedUnitId: (row['linkedUnitId'] as string | null) ?? null,
  createdAt: normalizeTimestamp(row['createdAt'], 'field_journal_entries.createdAt'),
});

const withEpisodeAnchor = (anchors: string[], episodeId: string): string[] => {
  const merged = new Set(anchors);
  merged.add(`episode:${episodeId}`);
  return [...merged];
};

export function createNarrativeMemeticStore(db: NarrativeMemeticDbExecutor): NarrativeMemeticStore {
  return {
    async loadSnapshot(
      input: NarrativeMemeticSnapshotInput = {},
    ): Promise<NarrativeMemeticSnapshot> {
      const activeUnitLimit = input.activeUnitLimit ?? DEFAULT_ACTIVE_UNIT_LIMIT;
      const fieldJournalLimit = input.fieldJournalLimit ?? DEFAULT_FIELD_JOURNAL_LIMIT;
      const edgeLimit = input.edgeLimit ?? DEFAULT_EDGE_LIMIT;

      const activeUnitsResult = await db.query<NarrativeMemeticUnitRow>(
        `select ${memeticUnitColumns}
         from ${memeticUnitsTable}
         where status in ('active', 'dormant')
         order by activation_score desc, reinforcement_score desc, updated_at desc
         limit $1`,
        [activeUnitLimit],
      );
      const activeUnits = activeUnitsResult.rows.map((row) => normalizeMemeticUnitRow(row));

      const activeUnitIds = activeUnits.map((unit) => unit.unitId);
      const activeEdgesResult =
        activeUnitIds.length > 0
          ? await db.query<NarrativeMemeticEdgeRow>(
              `select ${memeticEdgeColumns}
               from ${memeticEdgesTable}
               where source_unit_id = any($1::text[])
                  or target_unit_id = any($1::text[])
               order by updated_at desc, edge_id asc
               limit $2`,
              [activeUnitIds, edgeLimit],
            )
          : { rows: [] };

      const latestNarrativeResult = await db.query<NarrativeSpineVersionRow>(
        `select ${narrativeVersionColumns}
         from ${narrativeSpineVersionsTable}
         order by created_at desc, version_id desc
         limit 1`,
      );

      const recentFieldJournalResult = await db.query<FieldJournalEntryRow>(
        `select ${fieldJournalColumns}
         from ${fieldJournalEntriesTable}
         order by created_at desc, entry_id desc
         limit $1`,
        [fieldJournalLimit],
      );

      return {
        activeUnits,
        activeEdges: activeEdgesResult.rows.map((row) => normalizeMemeticEdgeRow(row)),
        latestNarrativeVersion: latestNarrativeResult.rows[0]
          ? normalizeNarrativeVersionRow(latestNarrativeResult.rows[0])
          : null,
        recentFieldJournalEntries: recentFieldJournalResult.rows.map((row) =>
          normalizeFieldJournalRow(row),
        ),
      };
    },

    async applyTickDelta(input: NarrativeMemeticApplyTickInput): Promise<void> {
      for (const unit of input.delta.seedMemeticUnits) {
        await db.query(
          `insert into ${memeticUnitsTable} (
             unit_id,
             origin_kind,
             unit_type,
             abstract_label,
             canonical_summary,
             activation_score,
             reinforcement_score,
             decay_score,
             evidence_score,
             status,
             last_activated_tick_id,
             created_by_path,
             provenance_anchors_json,
             created_at,
             updated_at
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, now(), now()
           )
           on conflict (unit_id) do update
           set abstract_label = excluded.abstract_label,
               canonical_summary = excluded.canonical_summary,
               activation_score = excluded.activation_score,
               reinforcement_score = excluded.reinforcement_score,
               decay_score = excluded.decay_score,
               evidence_score = excluded.evidence_score,
               status = excluded.status,
               last_activated_tick_id = excluded.last_activated_tick_id,
               provenance_anchors_json = excluded.provenance_anchors_json,
               updated_at = now()`,
          [
            unit.unitId,
            unit.originKind,
            unit.unitType,
            unit.abstractLabel,
            unit.canonicalSummary,
            unit.activation,
            unit.reinforcement,
            unit.decay,
            unit.evidenceScore,
            unit.status,
            input.tickId,
            unit.createdByPath,
            JSON.stringify(withEpisodeAnchor(unit.provenanceAnchors, input.episodeId)),
          ],
        );
      }

      for (const update of input.delta.memeticUnitUpdates) {
        await db.query(
          `update ${memeticUnitsTable}
           set activation_score = $2,
               reinforcement_score = $3,
               decay_score = $4,
               evidence_score = $5,
               status = $6,
               last_activated_tick_id = $7,
               provenance_anchors_json = $8::jsonb,
               updated_at = now()
           where unit_id = $1`,
          [
            update.unitId,
            update.activation,
            update.reinforcement,
            update.decay,
            update.evidenceScore,
            update.status,
            update.lastActivatedTickId,
            JSON.stringify(withEpisodeAnchor(update.provenanceAnchors, input.episodeId)),
          ],
        );
      }

      for (const edge of input.delta.memeticEdgeUpserts) {
        await db.query(
          `insert into ${memeticEdgesTable} (
             edge_id,
             source_unit_id,
             target_unit_id,
             relation_kind,
             strength,
             confidence,
             tick_id,
             updated_at
           ) values ($1, $2, $3, $4, $5, $6, $7, now())
           on conflict (source_unit_id, target_unit_id, relation_kind) do update
           set edge_id = excluded.edge_id,
               strength = excluded.strength,
               confidence = excluded.confidence,
               tick_id = excluded.tick_id,
               updated_at = now()`,
          [
            edge.edgeId,
            edge.sourceUnitId,
            edge.targetUnitId,
            edge.relationKind,
            edge.strength,
            edge.confidence,
            input.tickId,
          ],
        );
      }

      if (input.delta.coalition) {
        await db.query(
          `insert into ${coalitionsTable} (
             coalition_id,
             tick_id,
             decision_mode,
             vector,
             member_unit_ids_json,
             support_score,
             suppression_score,
             winning,
             created_at
           ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, now())
           on conflict (coalition_id) do update
           set vector = excluded.vector,
               member_unit_ids_json = excluded.member_unit_ids_json,
               support_score = excluded.support_score,
               suppression_score = excluded.suppression_score,
               winning = excluded.winning`,
          [
            input.delta.coalition.coalitionId,
            input.tickId,
            input.delta.coalition.decisionMode,
            input.delta.coalition.vector,
            JSON.stringify(input.delta.coalition.memberUnitIds),
            input.delta.coalition.supportScore,
            input.delta.coalition.suppressionScore,
            input.delta.coalition.winning,
          ],
        );
      }

      if (input.delta.narrativeVersion) {
        await db.query(
          `insert into ${narrativeSpineVersionsTable} (
             version_id,
             tick_id,
             based_on_version_id,
             current_chapter,
             summary,
             continuity_direction,
             tensions_json,
             provenance_anchors_json,
             created_at
           ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())
           on conflict (version_id) do update
           set based_on_version_id = excluded.based_on_version_id,
               current_chapter = excluded.current_chapter,
               summary = excluded.summary,
               continuity_direction = excluded.continuity_direction,
               tensions_json = excluded.tensions_json,
               provenance_anchors_json = excluded.provenance_anchors_json`,
          [
            input.delta.narrativeVersion.versionId,
            input.tickId,
            input.delta.narrativeVersion.basedOnVersionId,
            input.delta.narrativeVersion.currentChapter,
            input.delta.narrativeVersion.summary,
            input.delta.narrativeVersion.continuityDirection,
            JSON.stringify(input.delta.narrativeVersion.tensions),
            JSON.stringify(
              withEpisodeAnchor(input.delta.narrativeVersion.provenanceAnchors, input.episodeId),
            ),
          ],
        );
      }

      for (const entry of input.delta.fieldJournalEntries) {
        await db.query(
          `insert into ${fieldJournalEntriesTable} (
             entry_id,
             tick_id,
             entry_type,
             summary,
             interpretation,
             tension_markers_json,
             maturity_state,
             linked_unit_id,
             provenance_anchors_json,
             created_at
           ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, now())
           on conflict (entry_id) do update
           set summary = excluded.summary,
               interpretation = excluded.interpretation,
               tension_markers_json = excluded.tension_markers_json,
               maturity_state = excluded.maturity_state,
               linked_unit_id = excluded.linked_unit_id,
               provenance_anchors_json = excluded.provenance_anchors_json`,
          [
            entry.entryId,
            input.tickId,
            entry.entryType,
            entry.summary,
            entry.interpretation,
            JSON.stringify(entry.tensionMarkers),
            entry.maturityState,
            entry.linkedUnitId,
            JSON.stringify(withEpisodeAnchor(entry.provenanceAnchors, input.episodeId)),
          ],
        );
      }
    },
  };
}
