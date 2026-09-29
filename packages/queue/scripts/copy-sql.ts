import { cp, mkdir } from 'node:fs/promises';

const destination = new URL('../dist/storage/migrations/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(
  new URL('../migrations/0000_queue.sql', import.meta.url),
  new URL('0000_queue.sql', destination),
);
