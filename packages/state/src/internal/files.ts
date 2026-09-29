import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  statSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { StorageError } from './errors.js';

export function privateDirectory(path: string): void {
  const stat = statSync(path);
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  )
    throw new StorageError('unavailable');
}

export function privateFile(path: string, create = false): void {
  const fd = openSync(
    path,
    constants.O_RDWR | constants.O_NOFOLLOW | (create ? constants.O_CREAT : 0),
    0o600,
  );
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0
    )
      throw new StorageError('unavailable');
  } finally {
    closeSync(fd);
  }
}

export function databaseFiles(path: string, allowMissing = false): void {
  privateDirectory(dirname(path));
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${path}${suffix}`;
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (!stat && suffix === '' && !allowMissing)
      throw new StorageError('unavailable');
    if (stat) privateFile(file);
  }
}
