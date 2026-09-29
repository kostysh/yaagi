import {
  closeSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  openSync,
  rmSync,
  type Stats,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
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

function checkPrivateFile(stat: Stats): void {
  if (
    !stat.isFile() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  )
    throw new StorageError('unavailable');
}

export function privateFile(path: string, create = false): void {
  if (create && !lstatSync(path, { throwIfNoEntry: false })) {
    const temporary = mkdtempSync(join(dirname(path), '.state-create-'));
    try {
      const file = join(temporary, 'empty');
      // Close before publishing: another creator can use the final pathname
      // immediately, so even a newly-created DB inode must not be closed here.
      closeSync(openSync(file, 'wx', 0o600));
      try {
        linkSync(file, path);
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            'code' in error &&
            error.code === 'EEXIST'
          )
        )
          throw error;
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  checkPrivateFile(lstatSync(path));
}

export function databaseFiles(path: string, allowMissing = false): void {
  privateDirectory(dirname(path));
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${path}${suffix}`;
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (!stat && suffix === '' && !allowMissing)
      throw new StorageError('unavailable');
    // SQLite may remove optional sidecars when its last connection closes.
    // Validate this metadata snapshot without a second racing filesystem read.
    if (stat) checkPrivateFile(stat);
  }
}
