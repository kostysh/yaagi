import { once } from 'node:events';
import {
  deferred,
  job,
  limits,
  open,
  required,
  startOptions,
} from './fixture.js';

const [path, phase] = process.argv.slice(2);
await once(process, 'message');
const never = deferred();
const checkpoint = async () => {
  process.send?.(phase);
  await never.promise;
};
const root = await open(path, {
  beforePut: async (row) => {
    if (phase === 'handled' && row.status === 'completed') await checkpoint();
  },
  afterCommit: async (row) => {
    if (
      (phase === 'reserved' && row.status === 'pending' && row.lease) ||
      (phase === 'started' && row.status === 'running') ||
      (phase === 'completed' && row.status === 'completed')
    )
      await checkpoint();
  },
});
const queue = root.make(job());
required(await queue.start(startOptions, limits()));
