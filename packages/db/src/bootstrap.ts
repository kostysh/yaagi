import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PgBoss } from "pg-boss";

const MIGRATION_LEDGER_TABLE = "yaagi_platform_migrations";
const PLATFORM_METADATA_TABLE = "yaagi_platform_metadata";
const SCHEMA_VERSION_KEY = "schema_version";
const DEFAULT_BOSS_SCHEMA = "pgboss";

export type DatabaseBootstrapOptions = {
  connectionString: string;
  migrationsDir: string;
  bossSchema?: string;
};

export type DatabaseBootstrapResult = {
  appliedMigrations: string[];
  currentSchemaVersion: string | null;
  bossSchema: string;
};

const createClient = (connectionString: string): Client =>
  new Client({ connectionString });

const ensureBootstrapTables = async (client: Client): Promise<void> => {
  await client.query(`
    create table if not exists ${MIGRATION_LEDGER_TABLE} (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists ${PLATFORM_METADATA_TABLE} (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    )
  `);
};

const listMigrationFiles = async (migrationsDir: string): Promise<string[]> => {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const getAppliedMigrations = async (client: Client): Promise<Set<string>> => {
  const result = await client.query<{ name: string }>(
    `select name from ${MIGRATION_LEDGER_TABLE}`,
  );

  return new Set(result.rows.map((row: { name: string }) => row.name));
};

const applyMigration = async (
  client: Client,
  migrationName: string,
  sql: string,
): Promise<void> => {
  await client.query("begin");

  try {
    await client.query(sql);
    await client.query(
      `
        insert into ${MIGRATION_LEDGER_TABLE} (name)
        values ($1)
        on conflict (name) do nothing
      `,
      [migrationName],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};

const persistSchemaVersion = async (
  client: Client,
  schemaVersion: string | null,
): Promise<void> => {
  if (!schemaVersion) return;

  await client.query(
    `
      insert into ${PLATFORM_METADATA_TABLE} (key, value)
      values ($1, $2)
      on conflict (key) do update
      set value = excluded.value,
          updated_at = now()
    `,
    [SCHEMA_VERSION_KEY, schemaVersion],
  );
};

export async function checkPostgresConnectivity(
  connectionString: string,
): Promise<void> {
  const client = createClient(connectionString);

  await client.connect();

  try {
    await client.query("select 1");
  } finally {
    await client.end();
  }
}

export async function ensureDatabaseReady(
  options: DatabaseBootstrapOptions,
): Promise<DatabaseBootstrapResult> {
  const bossSchema = options.bossSchema ?? DEFAULT_BOSS_SCHEMA;
  const client = createClient(options.connectionString);
  const appliedMigrations: string[] = [];

  await client.connect();

  try {
    await ensureBootstrapTables(client);
    const migrationFiles = await listMigrationFiles(options.migrationsDir);
    const existingMigrations = await getAppliedMigrations(client);

    for (const migrationFile of migrationFiles) {
      if (existingMigrations.has(migrationFile)) continue;

      const migrationPath = path.join(options.migrationsDir, migrationFile);
      const sql = await readFile(migrationPath, "utf8");
      await applyMigration(client, migrationFile, sql);
      appliedMigrations.push(migrationFile);
    }

    await persistSchemaVersion(client, migrationFiles.at(-1) ?? null);
  } finally {
    await client.end();
  }

  const boss = new PgBoss({
    connectionString: options.connectionString,
    schema: bossSchema,
    migrate: true,
    supervise: false,
    schedule: false,
  });

  await boss.start();
  await boss.stop({ graceful: true, timeout: 1_000 });

  return {
    appliedMigrations,
    currentSchemaVersion: (await listMigrationFiles(options.migrationsDir)).at(-1) ?? null,
    bossSchema,
  };
}
