import type { StoragePort } from '@polyphony/state/contracts';

export interface FixtureOwners {
  alpha: { read(): Promise<number>; write(value: number): Promise<void> };
  beta: { read(): Promise<string>; write(value: string): Promise<void> };
}

// The same consumer is compiled once: no SQL, Node or implementation selection.
export class Consumer {
  readonly #port: StoragePort<FixtureOwners>;
  constructor(port: StoragePort<FixtureOwners>) {
    this.#port = port;
  }
  read(options: Parameters<StoragePort<FixtureOwners>['checkSchema']>[0]) {
    return this.#port.readSnapshot(
      async (owners) => ({
        alpha: await owners.alpha.read(),
        beta: await owners.beta.read(),
      }),
      options,
    );
  }
  save(
    expected: number,
    alpha: number,
    beta: string,
    options: Parameters<StoragePort<FixtureOwners>['checkSchema']>[0],
  ) {
    return this.#port.transact(async (owners) => {
      if ((await owners.alpha.read()) !== expected)
        return { ok: false, error: 'conflict' };
      await owners.alpha.write(alpha);
      await owners.beta.write(beta);
      return { ok: true, value: undefined };
    }, options);
  }
}
