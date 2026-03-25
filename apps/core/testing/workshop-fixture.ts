import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkshopStore } from '@yaagi/db';
import { createWorkshopService } from '../src/workshop/service.ts';
import { createWorkshopDbHarness } from '../../../packages/db/testing/workshop-db-harness.ts';

export async function createWorkshopServiceHarness(): Promise<{
  root: string;
  service: ReturnType<typeof createWorkshopService>;
  store: ReturnType<typeof createWorkshopStore>;
  state: ReturnType<typeof createWorkshopDbHarness>['state'];
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-workshop-'));
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'models'), { recursive: true });

  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);
  const service = createWorkshopService({
    store,
    dataPath: path.join(root, 'data'),
    modelsPath: path.join(root, 'models'),
    createId: (() => {
      let index = 0;
      return () => `workshop-${++index}`;
    })(),
    now: (() => {
      let index = 0;
      return () => new Date(Date.UTC(2026, 2, 26, 17, 0, index++));
    })(),
  });

  return {
    root,
    service,
    store,
    state: harness.state,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
