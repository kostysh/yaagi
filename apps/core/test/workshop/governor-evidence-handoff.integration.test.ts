import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_CANDIDATE_KIND, WORKSHOP_CANDIDATE_STAGE } from '@yaagi/contracts/workshop';
import { buildWorkshopPromotionProposalCommand } from '../../src/runtime/development-governor.ts';

void test('AC-F0016-10 maps workshop promotion package evidence into a governor-owned proposal gate', () => {
  const command = buildWorkshopPromotionProposalCommand({
    requestId: 'governor-workshop-proposal-1',
    requestedAt: '2026-04-10T12:30:00.000Z',
    packageUri: 'file:///runtime/reports/workshop/promotion/workshop-candidate-1.json',
    promotionPackage: {
      candidateId: 'workshop-candidate-1',
      candidateStage: WORKSHOP_CANDIDATE_STAGE.SHADOW,
      candidateKind: WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER,
      targetProfileId: 'model-profile:reflex.fast@candidate',
      predecessorProfileId: 'model-profile:reflex.fast@baseline',
      rollbackTarget: 'model-profile:reflex.fast@baseline',
      requiredEvalSuite: 'reflex-regression',
      lastKnownGoodEvalReportUri: 'file:///runtime/reports/workshop/evals/eval-1.json',
      artifactUri: 'file:///runtime/models/reflex-adapter.safetensors',
    },
  });

  assert.equal(command.originSurface, 'workshop');
  assert.equal(command.submitterOwner, 'F-0015');
  assert.equal(command.proposalKind, 'model_adapter');
  assert.equal(command.rollbackPlanRef, 'model-profile:reflex.fast@baseline');
  assert.equal(command.targetRef, 'model-profile:reflex.fast@candidate');
  assert.deepEqual(command.storeEvidenceRefs, [
    'workshop:artifact:file:///runtime/models/reflex-adapter.safetensors',
    'workshop:candidate:workshop-candidate-1',
    'workshop:eval-report:file:///runtime/reports/workshop/evals/eval-1.json',
    'workshop:promotion-package:file:///runtime/reports/workshop/promotion/workshop-candidate-1.json',
  ]);
  assert.deepEqual(command.payloadJson, {
    handoffSource: 'workshop_promotion_package',
    candidateId: 'workshop-candidate-1',
    packageUri: 'file:///runtime/reports/workshop/promotion/workshop-candidate-1.json',
    candidateKind: 'shared_adapter',
  });
});
