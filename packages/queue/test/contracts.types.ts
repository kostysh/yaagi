import type { Result } from '@polyphony/core-types';
import type {
  Queue,
  QueueCode,
  Status,
  JobType,
  Registration,
} from '@polyphony/queue/contracts';
import type { QueueAdapter, QueueScope } from '@polyphony/queue/ports';
import type { StoragePort } from '@polyphony/state/contracts';
import { createQueue, defineJob } from '@polyphony/queue';

const statuses: Record<Status, true> = {
  pending: true,
  running: true,
  completed: true,
  cancelled: true,
  failed: true,
};
const codes: Record<QueueCode, true> = {
  invalid: true,
  unknown_job: true,
  not_found: true,
  conflict: true,
  corrupt: true,
  storage: true,
  unknown_commit: true,
  cancelled: true,
  deadline: true,
  already_running: true,
  stopping: true,
  stop_incomplete: true,
  adapter: true,
};
declare const queue: Queue;
declare const type: JobType<number, string>;
declare const storage: StoragePort<QueueScope>;
declare const adapter: QueueAdapter;
const signal = {
  aborted: false,
  addEventListener() {},
  removeEventListener() {},
};
const options = { signal, timeoutMs: 10 };
const registration: Result<
  Registration<number, string>,
  { code: QueueCode }
> = defineJob({
  name: 'work',
  version: 1,
  payload: () => ({ ok: true, value: 1 }),
  result: () => ({ ok: true, value: 'one' }),
  handler: async (payload, context) => {
    payload satisfies number;
    context.signal.aborted satisfies boolean;
    return String(payload);
  },
});
if (registration.ok)
  createQueue({
    namespace: 'a',
    registrations: [registration.value],
    storage,
    adapter,
  });
void queue.enqueue(
  type,
  {
    id: 'a',
    // @ts-expect-error payload must follow the selected JobType
    payload: 'wrong',
    policy: { maxAttempts: 1, backoffMs: 0, timeoutMs: 1 },
  },
  options,
);
void queue.get(type, 'a', options).then((result) => {
  if (result.ok && result.value.result.available)
    result.value.result.value satisfies string;
});
void statuses;
void codes;
