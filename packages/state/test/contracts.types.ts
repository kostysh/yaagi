import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  StorageFailure,
  StoragePort,
} from '@polyphony/state/contracts';
import type { SqlScope } from '@polyphony/state/sqlite';

declare const port: StoragePort<SqlScope>;
declare const limits: OperationOptions;
const read: Promise<Result<number, StorageFailure>> = port.readSnapshot(
  async () => 0,
  limits,
);
void read;
// @ts-expect-error mandatory operation budget
port.readSnapshot(async () => 1);
// @ts-expect-error timeout is mandatory
port.checkSchema({ signal: { aborted: false } });
// @ts-expect-error no driver/lifecycle on common contract
void port.db;
// @ts-expect-error no native API on a scoped SQL handle
declare const commit: SqlScope['commit'];
void commit;
