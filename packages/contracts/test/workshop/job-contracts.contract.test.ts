import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSHOP_JOB_KIND,
  WORKSHOP_JOB_QUEUE,
  createWorkshopJobEnvelope,
} from '../../src/workshop.ts';

void test('AC-F0015-02 defines one canonical pg-boss queue family for bounded core to workshop job payloads', () => {
  assert.deepEqual(WORKSHOP_JOB_QUEUE, {
    DATASET_BUILD: 'workshop.dataset-build',
    TRAINING_RUN: 'workshop.training-run',
    EVAL_RUN: 'workshop.eval-run',
    REGISTER_CANDIDATE: 'workshop.candidate-register',
    RECORD_STAGE_TRANSITION: 'workshop.candidate-transition',
    PREPARE_PROMOTION_PACKAGE: 'workshop.promotion-package',
  });
});

void test('AC-F0015-02 wraps bounded workshop requests in one canonical job envelope shape', () => {
  const envelope = createWorkshopJobEnvelope({
    jobKind: WORKSHOP_JOB_KIND.TRAINING_RUN,
    requestId: 'training-request-1',
    requestedAt: '2026-03-26T15:00:00.000Z',
    payload: {
      requestId: 'training-request-1',
      targetKind: 'shared_adapter',
      targetProfileId: 'deliberation.fast@baseline',
      datasetId: 'dataset-1',
      method: 'lora',
    },
  });

  assert.equal(envelope.jobKind, WORKSHOP_JOB_KIND.TRAINING_RUN);
  assert.equal(envelope.requestId, 'training-request-1');
  assert.deepEqual(envelope.payload, {
    requestId: 'training-request-1',
    targetKind: 'shared_adapter',
    targetProfileId: 'deliberation.fast@baseline',
    datasetId: 'dataset-1',
    method: 'lora',
  });
});

void test('AC-F0015-02 rejects malformed workshop job kinds instead of silently accepting unknown queue payloads', () => {
  assert.throws(
    () =>
      createWorkshopJobEnvelope({
        jobKind: 'future_job_kind' as never,
        requestId: 'bad-job-1',
        requestedAt: '2026-03-26T15:00:00.000Z',
        payload: {
          requestId: 'bad-job-1',
          targetKind: 'shared_adapter',
          targetProfileId: 'deliberation.fast@baseline',
          datasetId: 'dataset-1',
          method: 'lora',
        } as never,
      }),
    /unknown workshop jobKind/,
  );
});
