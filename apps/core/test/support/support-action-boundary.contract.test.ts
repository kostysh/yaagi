import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_ACTION_MODE,
  SUPPORT_ACTION_STATUS,
  type SupportActionRecord,
} from '@yaagi/contracts/support';
import { routeSupportAction } from '../../src/support/support-actions.ts';

const now = '2026-04-29T12:00:00.000Z';

const ownerRoutedAction = (patch: Partial<SupportActionRecord> = {}): SupportActionRecord => ({
  mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
  owner: 'F-0026',
  ref: 'support-action:release-owner',
  requestedAction: 'request release owner inspection',
  status: SUPPORT_ACTION_STATUS.REQUESTED,
  evidenceRef: null,
  recordedAt: now,
  ...patch,
});

void test('AC-F0028-10 refuses owner-routed support actions when no owner seam is available', async () => {
  const result = await routeSupportAction({ action: ownerRoutedAction() });

  assert.equal(result.accepted, false);
  assert.equal(result.action.status, SUPPORT_ACTION_STATUS.UNAVAILABLE);
  if (!result.accepted) {
    assert.equal(result.reason, 'owner_seam_unavailable');
  }
});

void test('AC-F0028-10 marks owner-routed action successful only with owner evidence', async () => {
  const result = await routeSupportAction({
    action: ownerRoutedAction(),
    ownerSeams: {
      'F-0026': () =>
        Promise.resolve({
          accepted: true,
          evidenceRef: 'release-request:1',
        }),
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.action.status, SUPPORT_ACTION_STATUS.SUCCEEDED);
  assert.equal(result.action.evidenceRef, 'release-request:1');
});

void test('AC-F0028-10 keeps human-only actions documented, not executable', async () => {
  const result = await routeSupportAction({
    action: ownerRoutedAction({
      mode: SUPPORT_ACTION_MODE.HUMAN_ONLY,
      owner: 'human',
      ref: 'support-action:human-only',
      requestedAction: 'manual duty-owner escalation',
    }),
  });

  assert.equal(result.accepted, true);
  assert.equal(result.action.status, SUPPORT_ACTION_STATUS.DOCUMENTED);
  assert.equal(result.action.evidenceRef, null);
});
