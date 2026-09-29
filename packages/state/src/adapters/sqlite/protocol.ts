import type { Result } from '@polyphony/core-types';
import type { SchemaStatus, StorageFailure } from '../../contracts.js';
import type { SqlMigration, SqlValue } from '../sqlite.js';

export type Config = { path: string; migrations: readonly SqlMigration[] };
export type Job =
  | 'open'
  | 'check'
  | 'migrate'
  | 'backup'
  | 'snapshot'
  | 'transaction';
export type Start = {
  config: Config;
  job: Job;
  end: number;
  cancelled: SharedArrayBuffer;
  target?: string;
};
export type Command =
  | {
      id: number;
      kind: 'all' | 'run';
      sql: string;
      params: readonly SqlValue[];
    }
  | { id: number; kind: 'finish'; outcome: 'commit' | 'rollback' };
export type Payload =
  | { kind: 'ready' | 'done' }
  | { kind: 'schema'; status: SchemaStatus }
  | { kind: 'rows'; rows: SqlValue[][] }
  | { kind: 'run'; changes: number; lastInsertRowid: bigint };
export type Reply = { id: number; result: Result<Payload, StorageFailure> };
