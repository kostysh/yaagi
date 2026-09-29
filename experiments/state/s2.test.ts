import assert from "node:assert/strict";
import { execFileSync, fork } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { backup, DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { setImmediate as yieldLoop } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { getLoadablePath } from "sqlite-vec";
import { counts, fixture, value, vector, writeOwners } from "./fixture.js";
import { checkSchema, release } from "./migrations.js";
import {
  first,
  openProbeDb,
  ProbeError,
  ProbeStore,
  safeFailure,
} from "./probe.js";

test("S2: effective pragmas, fixed extension/ABI and private files including WAL/SHM", async (t) => {
  const f = fixture(t);
  assert.equal(first(f.db, "SELECT sqlite_version()"), "3.53.4");
  assert.equal(first(f.db, "SELECT vec_version()"), "v0.1.9");
  for (const db of [f.db, f.open()]) {
    assert.deepEqual(
      ["journal_mode", "synchronous", "foreign_keys", "busy_timeout"].map((p) =>
        first(db, `PRAGMA ${p}`),
      ),
      ["wal", 2, 1, 40],
    );
  }
  assert.throws(() => f.db.loadExtension(getLoadablePath()));
  assert.throws(() =>
    f.db.prepare("SELECT load_extension(?)").get(getLoadablePath()),
  );
  const controller = new ProbeStore(f.db);
  const fk = await controller.transact(async (scope) => {
    scope.run("INSERT INTO fixture_marks VALUES('bad','absent',1)");
    return { ok: true, value: undefined };
  });
  assert.deepEqual(fk, {
    ok: false,
    error: { kind: "storage", code: "sql_failed" },
  });
  assert.equal(statSync(f.dir).mode & 0o777, 0o700);
  for (const path of [f.path, `${f.path}-wal`, `${f.path}-shm`]) {
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(path).uid, process.getuid?.());
  }
  t.diagnostic(
    `Node ${process.version}; SQLite ${first(f.db, "SELECT sqlite_version()")}; vec ${first(f.db, "SELECT vec_version()")}; ${process.platform}/${process.arch}`,
  );
});

for (const mode of ["rollback", "commit"] as const) {
  test(`S2: real writer contention + SIGKILL + reopen (${mode})`, async (t) => {
    const f = fixture(t);
    value(
      await f.store.transact(async (scope) => {
        await writeOwners(scope);
        return { ok: true, value: undefined };
      }),
    );
    const child = fork(
      new URL("./writer-child.js", import.meta.url),
      [f.path, mode],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    const exited = once(child, "exit");
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await exited;
    });
    const [message] = await once(child, "message", {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(message, "writer-ready");
    let calls = 0;
    const start = performance.now();
    const result = await f.store.transact(async () => {
      calls++;
      return { ok: true, value: undefined };
    });
    const elapsed = performance.now() - start;
    assert.deepEqual(result, {
      ok: false,
      error: { kind: "storage", code: "busy" },
    });
    assert.equal(calls, 0);
    assert.ok(elapsed < 1000, `busy wait took ${elapsed}ms`);
    child.kill("SIGKILL");
    assert.deepEqual(await exited, [null, "SIGKILL"]);
    f.store.close();
    const reopened = f.open();
    assert.equal(
      first(reopened, "SELECT revision FROM fixture_notes"),
      mode === "commit" ? 11 : 0,
    );
    assert.deepEqual(counts(reopened), [1, 1, 1]);
    t.diagnostic(
      `SQL writer busy observed after ${elapsed.toFixed(1)}ms; no takeover or agent lock`,
    );
  });
}

test("S2: cooperative abort while awaited rejects commit; pre-aborted callback never runs", async (t) => {
  const f = fixture(t);
  const abort = new AbortController();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const pending = f.store.transact(
    async (scope) => {
      await writeOwners(scope);
      entered.resolve();
      await finish.promise;
      return { ok: true, value: undefined };
    },
    { signal: abort.signal },
  );
  await entered.promise;
  abort.abort("private cancellation reason");
  finish.resolve();
  assert.deepEqual(await pending, {
    ok: false,
    error: { kind: "storage", code: "cancelled" },
  });
  assert.deepEqual(
    await f.store.transact(
      async () => {
        assert.fail("Must not run");
      },
      { signal: abort.signal },
    ),
    { ok: false, error: { kind: "storage", code: "cancelled" } },
  );
  f.store.close();
  assert.deepEqual(counts(f.open()), [0, 0, 0]);
});

test("S2: synchronous SQL blocks timer; elapsed deadline rolls back before commit", async (t) => {
  const f = fixture(t);
  let fired = false;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const start = performance.now();
  const result = await f.store.transact(
    async (scope) => {
      scope.run(
        "INSERT INTO fixture_notes VALUES('deadline','x',0,X'01',NULL)",
      );
      timer = setTimeout(() => {
        fired = true;
        abort.abort();
      }, 0);
      scope.all(
        "WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<2000000) SELECT sum(x) FROM n",
      );
      return { ok: true, value: undefined };
    },
    { timeoutMs: 20, signal: abort.signal },
  );
  assert.equal(fired, false, "SQL does not yield to timer cancellation");
  assert.deepEqual(result, {
    ok: false,
    error: { kind: "storage", code: "deadline" },
  });
  clearTimeout(timer);
  assert.deepEqual(counts(f.db), [0, 0, 0]);
  t.diagnostic(
    `Synchronous SQL exceeded a 20ms cooperative deadline: ${Math.round(performance.now() - start)}ms; no interrupt/hard deadline claim`,
  );
});

test("S2: late abort cannot turn an already confirmed commit into rollback", async (t) => {
  const f = fixture(t);
  const abort = new AbortController();
  value(
    await f.store.transact(
      async (scope) => {
        await writeOwners(scope);
        return { ok: true, value: false };
      },
      { signal: abort.signal },
    ),
  );
  abort.abort();
  await yieldLoop();
  f.store.close();
  assert.deepEqual(counts(f.open()), [1, 1, 1]);
});

test("S2: full storage rolls back; unavailable/corrupt/readonly/closed map safely", async (t) => {
  const f = fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: undefined };
    }),
  );
  f.db.exec("CREATE TABLE fixture_full(value BLOB)");
  f.db.exec(
    `PRAGMA max_page_count=${Number(first(f.db, "PRAGMA page_count"))}`,
  );
  const full = await f.store.transact(async (scope) => {
    scope.run("UPDATE fixture_notes SET revision=9");
    scope.run("INSERT INTO fixture_full VALUES(zeroblob(10000000))");
    return { ok: true, value: undefined };
  });
  assert.deepEqual(full, {
    ok: false,
    error: { kind: "storage", code: "full" },
  });
  assert.equal(first(f.db, "SELECT revision FROM fixture_notes"), 0);
  assert.throws(
    () => openProbeDb(join(f.dir, "missing", "no.db")),
    new ProbeError("unavailable"),
  );
  const corrupt = join(f.dir, "corrupt.db");
  writeFileSync(corrupt, Buffer.alloc(512, 42), { mode: 0o600 });
  assert.throws(() => openProbeDb(corrupt), new ProbeError("corrupt"));
  const readonly = new DatabaseSync(f.path, { readOnly: true });
  const store = new ProbeStore(readonly);
  t.after(() => {
    if (readonly.isOpen) readonly.close();
  });
  assert.deepEqual(
    await store.transact(async (scope) => {
      scope.run("UPDATE fixture_notes SET revision=5");
      return { ok: true, value: undefined };
    }),
    { ok: false, error: { kind: "storage", code: "write_failed" } },
  );
  store.close();
  assert.deepEqual(await store.readSnapshot(async () => 1), {
    ok: false,
    error: { kind: "storage", code: "closed" },
  });
  f.store.close();
  assert.equal(first(f.open(), "SELECT revision FROM fixture_notes"), 0);
});

test("S2: extension loader rejects invalid binary; no fallback success", (t) => {
  const f = fixture(t);
  const invalid = join(f.dir, "invalid-extension.so");
  writeFileSync(invalid, "not a native extension", { mode: 0o600 });
  const db = new DatabaseSync(join(f.dir, "extension.db"), {
    allowExtension: true,
  });
  try {
    assert.throws(() => db.loadExtension(invalid));
    assert.throws(() => db.prepare("SELECT vec_version()").get());
    assert.deepEqual(safeFailure(new ProbeError("incompatible")), {
      kind: "storage",
      code: "incompatible",
    });
  } finally {
    db.close();
  }
});

test("S2: missing fixed extension supply fails adapter open with a safe error", (t) => {
  const f = fixture(t);
  const path = join(f.dir, "missing-extension.db");
  execFileSync(process.execPath, [
    fileURLToPath(new URL("./extension-failure-child.js", import.meta.url)),
    path,
  ]);
});

test("S2: SQLite online backup restores into isolated target, source remains unchanged", async (t) => {
  const f = fixture(t);
  value(
    await f.store.transact(async (scope) => {
      await writeOwners(scope);
      return { ok: true, value: undefined };
    }),
  );
  const target = join(f.dir, "backup.db");
  writeFileSync(target, "", { mode: 0o600, flag: "wx" });
  const originalFile = readFileSync(f.path);
  const originalWal = readFileSync(`${f.path}-wal`);
  const pages = await backup(f.db, target);
  assert.ok(pages > 0);
  assert.equal(statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(f.path), originalFile);
  assert.deepEqual(readFileSync(`${f.path}-wal`), originalWal);
  const restoredPath = join(f.dir, "restored.db");
  copyFileSync(target, restoredPath);
  const restored = openProbeDb(restoredPath);
  try {
    assert.deepEqual(counts(restored), [1, 1, 1]);
    assert.deepEqual(value(checkSchema(restored, release)), {
      applied: 3,
      pending: 0,
    });
    const rows = restored
      .prepare(
        "SELECT rowid,distance FROM fixture_vectors WHERE embedding MATCH ? AND k=1",
      )
      .all(vector);
    assert.equal(rows[0]?.distance, 0);
    restored.exec("UPDATE fixture_notes SET revision=99");
    assert.equal(first(f.db, "SELECT revision FROM fixture_notes"), 0);
  } finally {
    restored.close();
  }
});
