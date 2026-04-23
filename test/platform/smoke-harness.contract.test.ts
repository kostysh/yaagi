import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Coverage refs: AC-F0024-18

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const smokeHarnessPath = path.join(repoRoot, 'infra', 'docker', 'deployment-cell.smoke.ts');
const smokeBaseComposePath = path.join(repoRoot, 'infra', 'docker', 'compose.smoke-base.yaml');
const f0003Path = path.join(
  repoRoot,
  'docs',
  'ssot',
  'features',
  'F-0003-tick-runtime-scheduler-episodic-timeline.md',
);
const f0005Path = path.join(
  repoRoot,
  'docs',
  'ssot',
  'features',
  'F-0005-perception-buffer-and-sensor-adapters.md',
);
const f0007Path = path.join(
  repoRoot,
  'docs',
  'ssot',
  'features',
  'F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md',
);
const f0021Path = path.join(
  repoRoot,
  'docs',
  'ssot',
  'features',
  'F-0021-smoke-harness-post-f0020-runtime-optimization.md',
);
const indexPath = path.join(repoRoot, 'docs', 'ssot', 'index.md');
const readmePath = path.join(repoRoot, 'README.md');
const f0021ImplementationEvidencePath = path.join(
  repoRoot,
  '.dossier',
  'verification',
  'F-0021',
  'implementation-smoke-timing-c01.json',
);

const loadText = async (targetPath: string): Promise<string> => readFile(targetPath, 'utf8');

void test('AC-F0007-01 keeps the deployment-cell harness on one suite-scoped project and one Telegram overlay activation', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /AC-F0007-01 reuses suite-scoped compose families instead of per-test full deployment-cell restarts/,
  );
  assert.match(text, /F-0007 deployment-cell smoke suite/);
  assert.match(text, /F-0007 base deployment-cell smoke family/);
  assert.match(text, /F-0007 telegram deployment-cell smoke overlay/);
  assert.match(text, /projectStarts, 1/);
  assert.match(text, /telegramOverlayActivations, 1/);
  assert.match(text, /telegramOverlayVllmFastContainerId/);
});

void test('AC-F0007-02 restores clean post-bootstrap runtime state through deterministic reset and readiness helpers', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /async function prepareFreshRuntimeScenario/);
  assert.match(text, /compose\(\['stop', 'core'\]/);
  assert.match(text, /queryPostgres\(\s*runtimeResetSql/);
  assert.match(text, /compose\(\['start', 'core'\]/);
  assert.match(text, /await waitForHttp\(coreHealthUrl\(\)\)/);
  assert.match(
    text,
    /AC-F0007-02 restores clean post-bootstrap runtime state through deterministic resets between suite-scoped smoke scenarios/,
  );
});

void test('AC-F0021-01 / AC-F0021-02 keep steady-state smoke PostgreSQL access on one direct pg client with explicit lifecycle ownership', async () => {
  const [smokeHarness, smokeBaseCompose, composeYaml, readme] = await Promise.all([
    loadText(smokeHarnessPath),
    loadText(smokeBaseComposePath),
    loadText(path.join(repoRoot, 'infra', 'docker', 'compose.yaml')),
    loadText(readmePath),
  ]);

  assert.match(smokeHarness, /import \{ Client \} from 'pg';/);
  assert.match(smokeHarness, /const smokePostgresQueryTimeoutMs = 5_000;/);
  assert.match(smokeHarness, /let smokePostgresClient: Client \| null = null;/);
  assert.match(smokeHarness, /async function connectSmokePostgres/);
  assert.match(smokeHarness, /async function closeSmokePostgres/);
  assert.match(
    smokeHarness,
    /const smokeBaseComposeFile = path.join\(repoRoot\(\), 'infra', 'docker', 'compose\.smoke-base\.yaml'\);/,
  );
  assert.match(smokeHarness, /query_timeout: smokePostgresQueryTimeoutMs/);
  assert.match(smokeHarness, /statement_timeout: smokePostgresQueryTimeoutMs/);
  assert.doesNotMatch(smokeHarness, /exec', '-T', 'postgres', 'psql'/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_POSTGRES_HOST_PORT/);
  assert.doesNotMatch(composeYaml, /YAAGI_SMOKE_POSTGRES_HOST_PORT/);
  assert.match(readme, /one smoke-only direct PostgreSQL client/);
});

void test('smoke-only compose overlays keep hard resource budgets and bounded vllm-fast serving knobs out of the product compose path', async () => {
  const [smokeBaseCompose, telegramOverlay, composeYaml] = await Promise.all([
    loadText(smokeBaseComposePath),
    loadText(path.join(repoRoot, 'infra', 'docker', 'compose.smoke-telegram.yaml')),
    loadText(path.join(repoRoot, 'infra', 'docker', 'compose.yaml')),
  ]);

  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_MEMORY_LIMIT/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_MEMORY_SWAP_LIMIT/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_CPUS/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_MAX_MODEL_LEN/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_GPU_MEMORY_UTILIZATION/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_MAX_NUM_SEQS/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_VLLM_FAST_ENFORCE_EAGER/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_CORE_MEMORY_LIMIT/);
  assert.match(smokeBaseCompose, /YAAGI_SMOKE_POSTGRES_MEMORY_LIMIT/);
  assert.match(telegramOverlay, /YAAGI_SMOKE_TELEGRAM_API_MEMORY_LIMIT/);
  assert.doesNotMatch(composeYaml, /YAAGI_SMOKE_VLLM_FAST_MEMORY_LIMIT/);
  assert.doesNotMatch(composeYaml, /VLLM_FAST_SERVING_MAX_MODEL_LEN/);
});

void test('deployment-cell smoke keeps an explicit host-memory preflight before starting the bounded compose project', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /import \{ mkdir, readFile, writeFile \} from 'node:fs\/promises';/);
  assert.match(text, /const smokeMemoryHeadroomBytes = parseByteLimit\(/);
  assert.match(text, /const smokeBaseBudgetBytes =/);
  assert.match(text, /async function readMemAvailableBytes/);
  assert.match(text, /async function ensureSmokeHostMemoryHeadroom/);
  assert.match(text, /await ensureSmokeHostMemoryHeadroom\(smokeBaseBudgetBytes\);/);
  assert.match(text, /await ensureSmokeHostMemoryHeadroom\(smokeTelegramApiMemoryLimitBytes\);/);
});

void test('reactive smoke scenarios use one explicit latency budget for bounded inference waits under the smoke-only vllm profile', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /const smokeReactivePredicateTimeoutMs = Number\(/);
  assert.match(text, /YAAGI_SMOKE_REACTIVE_PREDICATE_TIMEOUT_MS/);
  assert.match(text, /waitForPostgresPredicate\([\s\S]*smokeReactivePredicateTimeoutMs,\s*\);/);
  assert.match(
    text,
    /waitForPostgresPredicate\([\s\S]*smokeReactivePredicateTimeoutMs,\s*\{ telegram: true \},\s*\);/,
  );
});

void test('AC-F0021-03 / AC-F0021-04 / AC-F0021-05 keep Telegram overlay on the shared runtime without rebuilds', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /compose\(\s*\['up', '-d', '--no-build', '--force-recreate', '--wait', 'fake-telegram-api', 'core'\],\s*\{\s*telegram: true,\s*\},\s*\);/s,
  );
  assert.doesNotMatch(
    text,
    /compose\(\['up', '-d', '--build', 'vllm-fast', 'fake-telegram-api'\], \{ telegram: true \}\);/,
  );
});

void test('AC-F0021-06 introduces predicate waits instead of repeated sequential postgres value waits for one domain outcome', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /async function waitForPostgresPredicate/);
  assert.match(text, /await waitForPostgresPredicate\(\s*`select \(/);
  assert.match(text, /await queryPostgresJson</);
});

void test('AC-F0021-07 / AC-F0021-08 keep compose health as the first barrier for startup and overlay while preserving explicit domain barriers', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /import \{ runSmokeActivationWithFence \} from '\.\/smoke-activation-fence\.ts';/,
  );
  assert.match(text, /async function fenceSmokeActivationFailure/);
  assert.match(text, /async function startSmokeProject/);
  assert.match(text, /compose\(\['up', '-d', '--build', '--wait'\], options\)/);
  assert.match(text, /await runSmokeActivationWithFence\(/);
  assert.match(
    text,
    /compose\(\s*\['up', '-d', '--no-build', '--force-recreate', '--wait', 'fake-telegram-api', 'core'\],\s*\{\s*telegram: true,\s*\},\s*\);/s,
  );
  assert.match(text, /waitForAdapterStatus\('telegram', 'healthy'\)/);
});

void test('AC-F0021-09 / AC-F0021-10 / AC-F0021-11 preserve the shared smoke baseline families and teardown ownership', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(text, /F-0007 base deployment-cell smoke family/);
  assert.match(text, /F-0007 telegram deployment-cell smoke overlay/);
  assert.match(text, /projectStarts, 1/);
  assert.match(text, /telegramOverlayActivations, 1/);
  assert.match(text, /waitForProjectResourcesToDisappear\(projectName, \{/);
  assert.match(text, /waitForPortToClose\(defaultPostgresHostPort\)/);
});

void test('AC-F0021-12 records same-machine smoke timing evidence in the implementation dossier', async () => {
  const [text, evidenceText] = await Promise.all([
    loadText(f0021Path),
    loadText(f0021ImplementationEvidencePath),
  ]);
  const evidence = JSON.parse(evidenceText) as {
    feature_id: string;
    baseline: { suite_real_s: number; base_family_s: number; telegram_overlay_s: number };
    candidate: {
      suite_real_s: number;
      suite_ms: number;
      base_family_ms: number;
      telegram_overlay_ms: number;
    };
    runtime: { warm_cache: boolean; vllm_fast_base_image: string; selected_candidate_id: string };
  };

  assert.match(text, /Delivered implementation evidence/);
  assert.match(text, /same-machine warm-cache smoke verdict/);
  assert.match(text, /Baseline shared-runtime snapshot из `F-0007`/);
  assert.match(text, /implementation-smoke-timing-c01\.json/);
  assert.match(text, /AC-F0021-12/);
  assert.equal(evidence.feature_id, 'F-0021');
  assert.equal(evidence.runtime.warm_cache, true);
  assert.equal(evidence.runtime.vllm_fast_base_image, 'vllm/vllm-openai-rocm:gemma4');
  assert.equal(evidence.runtime.selected_candidate_id, 'gemma-4-e4b-it');
  assert.equal(evidence.baseline.suite_real_s, 321.06);
  assert.equal(evidence.baseline.base_family_s, 96.02);
  assert.equal(evidence.baseline.telegram_overlay_s, 14.16);
  assert.ok(evidence.candidate.suite_real_s > 0);
  assert.ok(evidence.candidate.suite_ms > 0);
  assert.ok(evidence.candidate.base_family_ms > 0);
  assert.ok(evidence.candidate.telegram_overlay_ms > 0);
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

void test('AC-F0007-04 scopes historical performance evidence separately from the current shared-runtime snapshot', async () => {
  const text = await loadText(f0007Path);

  assert.match(text, /historical `v1\.3` comparative evidence/);
  assert.match(text, /before .* `real 133\.47`/);
  assert.match(text, /after .* `real 57\.13`/);
  assert.match(text, /current `v1\.4` shared-runtime snapshot after `F-0020`/);
  assert.match(text, /one shared `vllm-fast`\/`Gemma` runtime/);
  assert.match(text, /not compared against `v1\.3`/);
});

void test('AC-F0007-05 keeps an explicit teardown audit for the shared smoke project and host port', async () => {
  const text = await loadText(smokeHarnessPath);

  assert.match(
    text,
    /AC-F0007-05 tears down suite-scoped smoke projects without orphaned docker resources/,
  );
  assert.match(text, /waitForProjectResourcesToDisappear\(projectName, \{/);
  assert.match(text, /ignoredVolumes: \[modelsVolumeName\(\)\]/);
  assert.match(text, /waitForPortToClose\(defaultCoreHostPort\)/);
  assert.match(text, /waitForPortToClose\(defaultPostgresHostPort\)/);
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
    /historical pre-Gemma single-run `pnpm smoke:cell` improved from `133\.47s` to `57\.13s`/,
  );
  assert.match(
    f0007,
    /Current shared-runtime timing snapshot \(`321\.06s` total, `96\.02s` base family, `14\.16s` Telegram overlay\)/,
  );
  assert.match(
    indexText,
    /\| F-0007 \| Детерминированный smoke harness и suite-scoped lifecycle deployment cell \| done \|/,
  );
});
