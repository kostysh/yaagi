import { open, worker } from './fixture.js';

const path = process.argv[2];
const phase = process.argv[3];
if (!path || !phase || !process.send)
  throw new Error('Probe child arguments missing');
await new Promise<void>((resolve) => process.once('message', () => resolve()));
const { repository } = await open(path);
async function checkpoint() {
  // The parent owns this barrier: it either releases it or kills AND reaps us.
  const release = new Promise<void>((resolve) =>
    process.once('message', () => resolve()),
  );
  process.send?.({ phase });
  await release;
}
if (phase === 'reserved') repository.onReserved = checkpoint;
if (phase === 'started') repository.onStarted = checkpoint;
if (phase === 'completed') {
  const complete = repository.complete.bind(repository);
  repository.complete = async (job, result) => {
    await complete(job, result);
    await checkpoint();
  };
}
const running = worker(repository, async () => {
  if (phase === 'handled') await checkpoint();
  return 42;
});
await running.start();
