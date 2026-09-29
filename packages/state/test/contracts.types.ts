import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  StorageFailure,
  StoragePort,
  StorageAdapter,
} from '@polyphony/state/contracts';
import type { SqlScope } from '@polyphony/state/adapters/sqlite';
import { createState } from '@polyphony/state';

declare const adapter: StorageAdapter<{ load(): Promise<string> }>;
const neutral: StoragePort<{ read(): Promise<string> }> = createState(
  adapter,
  (scope) => ({ read: () => scope.load() }),
);
void neutral;
// @ts-expect-error SQL is not a common contract
type Forbidden = import('@polyphony/state/contracts').SqlScope;
// @ts-expect-error backend factory is not re-exported by the core
type RootFactory = typeof import('@polyphony/state').createSqliteAdapter;
// @ts-expect-error removed legacy entrypoint
type Legacy = typeof import('@polyphony/state/node');
declare const forbidden: Forbidden | RootFactory | Legacy;
void forbidden;

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
