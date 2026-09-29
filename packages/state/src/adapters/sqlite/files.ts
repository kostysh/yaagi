import { closeSync, constants, lstatSync, openSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { StorageError } from '../../internal/errors.js';

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
  if (create) {
    try {
      // Only a NEW inode can be opened/closed outside SQLite. Closing an fd on
      // an existing DB/WAL/SHM can release another connection's POSIX locks.
      closeSync(
        openSync(
          path,
          constants.O_RDWR |
            constants.O_NOFOLLOW |
            constants.O_CREAT |
            constants.O_EXCL,
          0o600,
        ),
      );
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'EEXIST')
      )
        throw error;
    }
  }
  const stat = lstatSync(path);
  if (
    !stat.isFile() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  )
    throw new StorageError('unavailable');
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
