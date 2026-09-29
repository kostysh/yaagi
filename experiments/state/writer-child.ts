import { openProbeDb } from './probe.js';

const path = process.argv[2];
const mode = process.argv[3];
if (!path) throw new Error('Missing fixture path');
const db = openProbeDb(path);
db.exec('BEGIN IMMEDIATE; UPDATE fixture_notes SET revision=11');
if (mode === 'commit')
  db.exec('COMMIT; BEGIN IMMEDIATE; UPDATE fixture_notes SET revision=33');
process.send?.('writer-ready');
// The parent kills only this test-owned process, not an agent/runtime process.
process.on('message', () => {});
