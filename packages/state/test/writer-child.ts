import { openSqlite } from '@polyphony/state/node';
import { limits, release, value } from './fixture.js';

const [path, mode] = process.argv.slice(2);
const state = value(await openSqlite({ path, migrations: release }, limits()));
if (mode === 'commit')
  value(
    await state.transact(async (scope) => {
      scope.run('UPDATE fixture_notes SET revision=11');
      return { ok: true, value: undefined };
    }, limits()),
  );
// Only this test-owned process is killed by its parent.
process.on('message', () => {});
await state.transact(
  async (scope) => {
    scope.run('UPDATE fixture_notes SET revision=33');
    process.send?.('writer-ready');
    await new Promise<void>(() => {});
    return { ok: true, value: undefined };
  },
  limits(undefined, 60_000),
);
