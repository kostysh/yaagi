import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
import { load } from 'sqlite-vec';

export type Request = {
  id: number;
  kind: 'exec' | 'all' | 'run' | 'close';
  sql: string;
  params: (null | string | number | bigint | Uint8Array)[];
};
export type Reply =
  | { id: number; phase: 'starting' }
  | { id: number; phase: 'done'; rows: unknown[][]; error?: string };

const { path, cancellation } = workerData as {
  path: string;
  cancellation: SharedArrayBuffer;
};
const cancelled = new Int32Array(cancellation);
const port = parentPort;
if (!port) throw new Error('Worker only');
const db = new DatabaseSync(path, { timeout: 3000, allowExtension: true });
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON',
);
load(db);
db.enableLoadExtension(false);
port.on('message', (request: Request) => {
  port.postMessage({ id: request.id, phase: 'starting' } satisfies Reply);
  let rows: unknown[][] = [];
  let error: string | undefined;
  try {
    if (request.kind === 'close') {
      if (db.isTransaction) db.exec('ROLLBACK');
      db.close();
    } else if (request.sql === 'COMMIT' && Atomics.load(cancelled, 0)) {
      db.exec('ROLLBACK');
      throw new Error('cancelled');
    } else if (request.kind === 'exec') db.exec(request.sql);
    else {
      const statement = db.prepare(request.sql);
      statement.setReturnArrays(true);
      if (request.kind === 'run') statement.run(...request.params);
      else rows = statement.all(...request.params).map(Object.values);
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'failed';
  }
  port.postMessage({
    id: request.id,
    phase: 'done',
    rows,
    ...(error ? { error } : {}),
  } satisfies Reply);
  if (request.kind === 'close') port.close();
});
