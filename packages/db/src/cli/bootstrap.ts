import path from 'node:path';
import { ensureDatabaseReady } from '../bootstrap.ts';

const {
  YAAGI_POSTGRES_URL: connectionString,
  YAAGI_MIGRATIONS_DIR: migrationsDirFromEnv,
  YAAGI_PGBOSS_SCHEMA: bossSchema,
} = process.env;

if (!connectionString) {
  throw new Error('YAAGI_POSTGRES_URL is required');
}

const repoRoot = process.cwd();
const migrationsDir = migrationsDirFromEnv ?? path.join(repoRoot, 'infra/migrations');

const result = await ensureDatabaseReady({
  connectionString,
  migrationsDir,
  ...(bossSchema ? { bossSchema } : {}),
});

console.log(JSON.stringify(result, null, 2));
