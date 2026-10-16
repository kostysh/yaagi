import { copyFile, mkdir } from 'node:fs/promises';
const target = new URL('../dist/migrations/', import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(
  new URL('../migrations/0000_timeline.sql', import.meta.url),
  new URL('0000_timeline.sql', target),
);
