import type { QueryResultRow } from 'pg';
import type { BoundaryCheck, ExecutiveVerdictKind } from '@yaagi/contracts/actions';
import { RUNTIME_SCHEMA, type RuntimeDbExecutor } from './runtime.ts';

export type RuntimeActionLogRow = {
  actionId: string;
  tickId: string;
  actionKind: ExecutiveVerdictKind;
  toolName: string | null;
  parametersJson: Record<string, unknown>;
  boundaryCheckJson: BoundaryCheck;
  resultJson: Record<string, unknown>;
  success: boolean;
  createdAt: string;
};

export type RuntimeActionLogAppendInput = {
  actionId: string;
  tickId: string;
  actionKind: ExecutiveVerdictKind;
  toolName?: string | null;
  parametersJson?: Record<string, unknown>;
  boundaryCheckJson: BoundaryCheck;
  resultJson?: Record<string, unknown>;
  success: boolean;
  createdAt?: Date;
};

export type RuntimeActionLogStore = {
  appendActionLog(input: RuntimeActionLogAppendInput): Promise<RuntimeActionLogRow>;
  getActionLog(actionId: string): Promise<RuntimeActionLogRow | null>;
  listActionLogForTick(input: { tickId: string; limit?: number }): Promise<RuntimeActionLogRow[]>;
};

const actionLogTable = `${RUNTIME_SCHEMA}.action_log`;
const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const actionLogColumns = `
  action_id as "actionId",
  tick_id as "tickId",
  action_kind as "actionKind",
  tool_name as "toolName",
  parameters_json as "parametersJson",
  boundary_check_json as "boundaryCheckJson",
  result_json as "resultJson",
  success,
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`action_log field ${field} must be a string or Date timestamp`);
};

const normalizeActionLogRow = (row: QueryResultRow): RuntimeActionLogRow => ({
  ...(row as unknown as RuntimeActionLogRow),
  createdAt: normalizeTimestamp(row['createdAt'], 'action_log.createdAt'),
});

export function createRuntimeActionLogStore(db: RuntimeDbExecutor): RuntimeActionLogStore {
  return {
    async appendActionLog(input: RuntimeActionLogAppendInput): Promise<RuntimeActionLogRow> {
      const result = await db.query<RuntimeActionLogRow>(
        `insert into ${actionLogTable} (
          action_id,
          tick_id,
          action_kind,
          tool_name,
          parameters_json,
          boundary_check_json,
          result_json,
          success,
          created_at
        ) values (
          $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, coalesce($9, now())
        )
        returning ${actionLogColumns}`,
        [
          input.actionId,
          input.tickId,
          input.actionKind,
          input.toolName ?? null,
          JSON.stringify(input.parametersJson ?? {}),
          JSON.stringify(input.boundaryCheckJson),
          JSON.stringify(input.resultJson ?? {}),
          input.success,
          input.createdAt?.toISOString() ?? null,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to append action_log row ${input.actionId}`);
      }

      return normalizeActionLogRow(row);
    },

    async getActionLog(actionId: string): Promise<RuntimeActionLogRow | null> {
      const result = await db.query<RuntimeActionLogRow>(
        `select ${actionLogColumns}
         from ${actionLogTable}
         where action_id = $1`,
        [actionId],
      );

      return result.rows[0] ? normalizeActionLogRow(result.rows[0]) : null;
    },

    async listActionLogForTick(input: {
      tickId: string;
      limit?: number;
    }): Promise<RuntimeActionLogRow[]> {
      const result = await db.query<RuntimeActionLogRow>(
        `select ${actionLogColumns}
         from ${actionLogTable}
         where tick_id = $1
         order by created_at desc, action_id desc
         limit $2`,
        [input.tickId, input.limit ?? 50],
      );

      return result.rows.map((row) => normalizeActionLogRow(row));
    },
  };
}
