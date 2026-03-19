import path from "node:path";
import { ensureDatabaseReady } from "../bootstrap.ts";

const connectionString = process.env["YAAGI_POSTGRES_URL"];

if (!connectionString) {
  throw new Error("YAAGI_POSTGRES_URL is required");
}

const repoRoot = process.cwd();
const migrationsDir =
  process.env["YAAGI_MIGRATIONS_DIR"] ?? path.join(repoRoot, "infra/migrations");
const bossSchema = process.env["YAAGI_PGBOSS_SCHEMA"];

const result = await ensureDatabaseReady({
  connectionString,
  migrationsDir,
  ...(bossSchema ? { bossSchema } : {}),
});

console.log(JSON.stringify(result, null, 2));
