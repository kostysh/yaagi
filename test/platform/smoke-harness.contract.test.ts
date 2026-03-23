import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const smokeHarnessPath = path.join(repoRoot, 'infra', 'docker', 'deployment-cell.smoke.ts');
const f0003Path = path.join(
  repoRoot,
  'docs',
  'features',
  'F-0003-tick-runtime-scheduler-episodic-timeline.md',
);
const f0005Path = path.join(
  repoRoot,
  'docs',
  'features',
  'F-0005-perception-buffer-and-sensor-adapters.md',
);
const f0007Path = path.join(
  repoRoot,
  'docs',
  'features',
  'F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md',
);
const indexPath = path.join(repoRoot, 'docs', 'ssot', 'index.md');
const readmePath = path.join(repoRoot, 'README.md');

const loadText = async (targetPath: string): Promise<string> => readFile(targetPath, 'utf8');

void test('AC-F0007-01 keeps the deployment-cell harness on one base family boot and one Telegram family boot', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /AC-F0007-01 reuses suite-scoped compose families instead of per-test full deployment-cell restarts/,
  );
  assert.match(text, /F-0007 base deployment-cell smoke family/);
  assert.match(text, /F-0007 telegram deployment-cell smoke family/);
  assert.match(text, /baseFamilyStarts, 1/);
  assert.match(text, /telegramFamilyStarts, 1/);
});

void test('AC-F0007-02 restores clean post-bootstrap runtime state through deterministic reset and readiness helpers', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /async function prepareFreshRuntimeScenario/);
  assert.match(text, /compose\(\['stop', 'core'\]/);
  assert.match(text, /queryPostgres\(\s*runtimeResetSql/);
  assert.match(text, /compose\(\['start', 'core'\]/);
  assert.match(
    text,
    /AC-F0007-02 restores clean post-bootstrap runtime state through deterministic resets between suite-scoped smoke scenarios/,
  );
});

void test('AC-F0007-03 retains F-0002 startup smoke ownership and removes lease plus perception restart probes from container smoke', async () => {
  const [f0003, f0005, f0007] = await Promise.all([
    loadText(f0003Path),
    loadText(f0005Path),
    loadText(f0007Path),
  ]);

  assert.doesNotMatch(f0003, /AC-F0003-02 .*smoke in `infra\/docker\/deployment-cell\.smoke\.ts`/);
  assert.match(
    f0005,
    /restart-safe behavior .* доказывается fast integration path, а не container smoke/,
  );
  assert.match(f0007, /`F-0002` bootstrap\/materialization proof stays in container smoke/);
  assert.match(
    f0007,
    /lease-discipline probe and the `F-0005` restart-safe perception probe leave `deployment-cell\.smoke\.ts`/,
  );
});

void test('AC-F0007-04 records before and after smoke timings with a materially faster post-implementation result', async () => {
  const text = await loadText(f0007Path);
  const beforeMatch = text.match(/before: .*?`real ([0-9]+\.[0-9]+)`/);
  const afterMatch = text.match(/after: .*?`real ([0-9]+\.[0-9]+)`/);

  assert.ok(beforeMatch?.[1]);
  assert.ok(afterMatch?.[1]);

  const before = Number(beforeMatch[1]);
  const after = Number(afterMatch[1]);
  assert.ok(Number.isFinite(before));
  assert.ok(Number.isFinite(after));
  assert.ok(after < before);
  assert.ok(after <= before * 0.65);
});

void test('AC-F0007-05 keeps an explicit teardown audit for both smoke projects and their host ports', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /AC-F0007-05 tears down suite-scoped smoke projects without orphaned docker resources/,
  );
  assert.match(text, /waitForProjectResourcesToDisappear\(projectName\)/);
  assert.match(text, /waitForProjectResourcesToDisappear\(telegramProjectName\)/);
  assert.match(text, /waitForPortToClose\(defaultCoreHostPort\)/);
  assert.match(text, /waitForPortToClose\(telegramCoreHostPort\)/);
});

void test('AC-F0007-06 realigns README and dossier references to the delivered smoke execution model', async () => {
  const [readme, f0007, indexText] = await Promise.all([
    loadText(readmePath),
    loadText(f0007Path),
    loadText(indexPath),
  ]);

  assert.match(
    readme,
    /runs a suite-scoped deployment-cell harness with deterministic runtime resets between individual scenarios inside each scenario family/,
  );
  assert.match(f0007, /Статус: `done`/);
  assert.match(
    f0007,
    /measured single-run `pnpm smoke:cell` improved from `133\.47s` to `57\.13s`/,
  );
  assert.match(
    indexText,
    /\| F-0007 \| Детерминированный smoke harness и suite-scoped lifecycle deployment cell \| done \|/,
  );
});
