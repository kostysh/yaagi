import type { Result } from '@polyphony/core-types';
import type { StoragePort } from '@polyphony/state/contracts';
import type {
  FailureReason,
  JsonValue,
  QueueFailure,
  Registration,
  RetainedResult,
} from '../contracts.js';
import type {
  Delivery,
  ProcessingStore,
  QueueScope,
  StoredJob,
} from '../ports.js';
import {
  Budget,
  decode,
  internalOptions,
  QueueError,
  record,
  safely,
  terminal,
  unwrap,
} from './model.js';

export const typeKey = (name: string, version: number): string =>
  JSON.stringify([name, version]);
const nextTime = (row: StoredJob): number =>
  Math.min(
    8_640_000_000_000_000,
    Math.max(row.notBefore, Date.now() + row.policy.backoffMs),
  );
type Change<T> = { value: T; next?: StoredJob };

// All transitions belong to the neutral core. The scope is an owner-local mapping,
// and state alone supplies transaction serialization and commit semantics.
export class Store implements ProcessingStore {
  constructor(
    readonly namespace: string,
    readonly storage: StoragePort<QueueScope>,
    readonly registrations: ReadonlyMap<string, Registration<unknown, unknown>>,
    readonly accepting: () => boolean,
  ) {}

  async validate(value: unknown, id?: string): Promise<StoredJob | undefined> {
    const row = await record(value, this.namespace, id);
    if (!row) return;
    const registration = this.registrations.get(typeKey(row.name, row.version));
    if (!registration) throw new QueueError('corrupt');
    if (!row.cleaned) decode(registration.type.payload, row.payload, 'corrupt');
    if (row.result.available)
      decode(registration.type.result, row.result.value, 'corrupt');
    return row;
  }

  async read(
    id: string,
    budget = new Budget(internalOptions()),
  ): Promise<StoredJob | undefined> {
    const result = await this.storage.readSnapshot(
      (scope) =>
        safely(async () =>
          this.validate(await scope.get(this.namespace, id), id),
        ),
      budget.options(),
    );
    if (!result.ok)
      throw new QueueError(
        result.error.code === 'cancelled' || result.error.code === 'deadline'
          ? result.error.code
          : 'storage',
      );
    return unwrap(result.value);
  }

  async mutate<T>(
    id: string,
    change: (row: StoredJob | undefined) => Change<T>,
    confirm: (row: StoredJob | undefined) => { value: T } | undefined,
    budget = new Budget(internalOptions()),
  ): Promise<T> {
    let submitted = false;
    const result = await this.storage.transact(
      (scope) =>
        safely(async () => {
          const row = await this.validate(
            await scope.get(this.namespace, id),
            id,
          );
          const decision = change(row);
          if (decision.next) {
            submitted = true;
            await scope.put(decision.next);
          }
          return decision.value;
        }),
      budget.options(),
    );
    if (result.ok) return result.value;
    if (result.error.kind === 'owner')
      throw new QueueError(result.error.error.code);
    if (!submitted)
      throw new QueueError(
        result.error.code === 'cancelled' || result.error.code === 'deadline'
          ? result.error.code
          : 'storage',
      );
    // A failed acknowledgement is not proof of rollback. Never repeat the write
    // here: read the same identity/token, within the caller's remaining budget.
    try {
      const confirmed = confirm(await this.read(id, budget));
      if (confirmed) return confirmed.value;
    } catch {
      /* Unknown stays unknown; no fabricated rollback or success. */
    }
    throw new QueueError('unknown_commit');
  }

  async reserve(
    name: string,
    version: number,
    through: number,
    lockDeadline: number,
  ): Promise<Result<Delivery | undefined, QueueFailure>> {
    return safely(async () => {
      if (!this.accepting()) return;
      if (!this.registrations.has(typeKey(name, version)))
        throw new QueueError('unknown_job');
      const token = crypto.randomUUID();
      let selected: Delivery | undefined;
      const result = await this.storage.transact(
        (scope) =>
          safely(async () => {
            const row = await this.validate(
              await scope.candidate(
                this.namespace,
                name,
                version,
                through,
                lockDeadline,
              ),
            );
            if (!row || !this.accepting()) return;
            if (
              row.name !== name ||
              row.version !== version ||
              terminal(row.status) ||
              (row.lease && row.lease.lockedAt > lockDeadline)
            )
              throw new QueueError('corrupt');
            if (row.status === 'running') {
              const last = row.attempts.at(-1);
              if (!last) throw new QueueError('corrupt');
              await scope.put({
                ...row,
                status:
                  row.attempts.length === row.policy.maxAttempts
                    ? 'failed'
                    : 'pending',
                lease: null,
                notBefore: nextTime(row),
                attempts: [
                  ...row.attempts.slice(0, -1),
                  {
                    ...last,
                    status: 'failed',
                    reason: 'interrupted',
                    finishedAt: Math.max(Date.now(), last.startedAt),
                  },
                ],
              });
              return;
            }
            if (row.notBefore > through) throw new QueueError('corrupt');
            const lockedAt = Date.now();
            selected = {
              id: row.id,
              name,
              version,
              token,
              lockedAt,
              notBefore: row.notBefore,
            };
            await scope.put({ ...row, lease: { token, lockedAt } });
            return selected;
          }),
        internalOptions(),
      );
      if (result.ok) return result.value;
      if (result.error.kind === 'owner')
        throw new QueueError(result.error.error.code);
      if (selected) {
        try {
          const row = await this.read(selected.id);
          if (row?.lease?.token === token && row.status === 'pending')
            return selected;
        } catch {
          /* Dispatch cannot proceed without durable confirmation. */
        }
      }
      throw new QueueError(selected ? 'unknown_commit' : 'storage');
    });
  }

  private current(row: StoredJob | undefined, delivery: Delivery): StoredJob {
    if (
      !row ||
      row.lease?.token !== delivery.token ||
      row.name !== delivery.name ||
      row.version !== delivery.version
    )
      throw new QueueError('conflict');
    return row;
  }

  begin(delivery: Delivery): Promise<Result<void, QueueFailure>> {
    return safely(() =>
      this.mutate(
        delivery.id,
        (value) => {
          const row = this.current(value, delivery);
          if (
            row.status === 'running' &&
            row.attempts.at(-1)?.token === delivery.token
          )
            return { value: undefined };
          if (!this.accepting()) throw new QueueError('stopping');
          if (
            row.status !== 'pending' ||
            row.notBefore > Date.now() ||
            row.attempts.length >= row.policy.maxAttempts
          )
            throw new QueueError('conflict');
          const startedAt = Date.now();
          return {
            value: undefined,
            next: {
              ...row,
              status: 'running',
              lease: { token: delivery.token, lockedAt: startedAt },
              attempts: [
                ...row.attempts,
                {
                  number: row.attempts.length + 1,
                  token: delivery.token,
                  startedAt,
                  finishedAt: null,
                  status: 'running',
                  reason: null,
                },
              ],
            },
          };
        },
        (row) =>
          row?.status === 'running' &&
          row.lease?.token === delivery.token &&
          row.attempts.at(-1)?.token === delivery.token
            ? { value: undefined }
            : undefined,
      ),
    );
  }

  touch(
    delivery: Delivery,
    lockedAt: number,
  ): Promise<Result<void, QueueFailure>> {
    return safely(() =>
      this.mutate(
        delivery.id,
        (value) => {
          // The durable outcome ends this generation regardless of ACK order.
          // Confirm it without renewing a lease or asserting that a particular
          // heartbeat committed. Cancellation/recovery/replacement still fail.
          if (this.finishedAttempt(value, delivery))
            return { value: undefined };
          const row = this.current(value, delivery);
          if (row.status !== 'running') throw new QueueError('conflict');
          return {
            value: undefined,
            next: {
              ...row,
              lease: {
                token: delivery.token,
                lockedAt: Math.max(lockedAt, row.lease?.lockedAt ?? 0),
              },
            },
          };
        },
        (row) =>
          (row?.status === 'running' &&
            row.lease?.token === delivery.token &&
            row.lease.lockedAt >= lockedAt) ||
          this.finishedAttempt(row, delivery)
            ? { value: undefined }
            : undefined,
      ),
    );
  }

  private finishedAttempt(
    row: StoredJob | undefined,
    delivery: Delivery,
  ): boolean {
    const last = row?.attempts.at(-1);
    return (
      row?.name === delivery.name &&
      row.version === delivery.version &&
      row.lease === null &&
      (row.status === 'completed' ||
        row.status === 'failed' ||
        row.status === 'pending') &&
      last?.token === delivery.token &&
      last.finishedAt !== null &&
      last.status !== 'running' &&
      last.reason !== 'cancelled' &&
      last.reason !== 'interrupted'
    );
  }

  release(delivery: Delivery): Promise<Result<void, QueueFailure>> {
    return safely(() =>
      this.mutate(
        delivery.id,
        (value) => {
          const row = this.current(value, delivery);
          if (row.status !== 'pending') throw new QueueError('conflict');
          return { value: undefined, next: { ...row, lease: null } };
        },
        (row) =>
          row?.status === 'pending' && row.lease === null
            ? { value: undefined }
            : undefined,
      ),
    );
  }

  async finish(
    delivery: Delivery,
    outcome: {
      result: RetainedResult<JsonValue>;
      reason: FailureReason | null;
    },
  ): Promise<void> {
    await this.mutate(
      delivery.id,
      (value) => {
        const row = this.current(value, delivery);
        const last = row.attempts.at(-1);
        if (row.status !== 'running' || !last || last.token !== delivery.token)
          throw new QueueError('conflict');
        const status = outcome.result.available
          ? 'completed'
          : row.attempts.length === row.policy.maxAttempts
            ? 'failed'
            : 'pending';
        return {
          value: undefined,
          next: {
            ...row,
            status,
            result: outcome.result,
            lease: null,
            notBefore: outcome.result.available ? row.notBefore : nextTime(row),
            attempts: [
              ...row.attempts.slice(0, -1),
              {
                ...last,
                status: outcome.result.available ? 'completed' : 'failed',
                reason: outcome.reason,
                finishedAt: Math.max(Date.now(), last.startedAt),
              },
            ],
          },
        };
      },
      (row) => {
        const attempt = row?.attempts.find(
          (entry) => entry.token === delivery.token,
        );
        return attempt &&
          attempt.status !== 'running' &&
          attempt.reason === outcome.reason &&
          (outcome.result.available ? row?.status === 'completed' : true)
          ? { value: undefined }
          : undefined;
      },
    );
  }
}
