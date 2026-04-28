import type { ServingDependencyState } from '@yaagi/contracts/models';
import {
  SPECIALIST_EVIDENCE_CLASS,
  SPECIALIST_ROLLOUT_STAGE,
  type SpecialistOrganRow,
  type SpecialistRolloutPolicyRow,
} from '@yaagi/contracts/specialists';
import {
  WORKSHOP_CANDIDATE_KIND,
  WORKSHOP_CANDIDATE_STAGE,
  type WorkshopPromotionPackage,
} from '@yaagi/contracts/workshop';
import { createSpecialistPolicyStore } from '@yaagi/db';
import { createSpecialistPolicyDbHarness } from '../../../packages/db/testing/specialist-policy-db-harness.ts';
import {
  createSpecialistPolicyService,
  type SpecialistAdmissionInput,
  type SpecialistFallbackReadiness,
  type SpecialistGovernorEvidence,
  type SpecialistHealthEvidence,
  type SpecialistPolicyEvidencePorts,
  type SpecialistPolicyService,
  type SpecialistReleaseEvidence,
} from '../src/runtime/index.ts';

export const SPECIALIST_TEST_NOW = '2026-04-28T10:00:00.000Z';

export type SpecialistPolicyTestHarness = {
  service: SpecialistPolicyService;
  store: ReturnType<typeof createSpecialistPolicyStore>;
  dbHarness: ReturnType<typeof createSpecialistPolicyDbHarness>;
  evidence: {
    promotionPackages: Map<string, WorkshopPromotionPackage>;
    governorDecisions: Map<string, SpecialistGovernorEvidence>;
    releaseEvidence: Map<string, SpecialistReleaseEvidence>;
    healthEvidence: Map<string, SpecialistHealthEvidence>;
    fallbackReadiness: Map<string, SpecialistFallbackReadiness>;
    servingDependencies: Map<string, ServingDependencyState>;
  };
  admissionInput(patch?: Partial<SpecialistAdmissionInput>): SpecialistAdmissionInput;
};

const specialistId = 'specialist.summary@v1';
const taskSignature = 'summarize.incident';
const candidateId = 'candidate-specialist-1';
const promotionPackageRef = 'workshop-promotion:candidate-specialist-1';
const modelProfileId = 'summary.specialist@v1';
const fallbackTargetProfileId = 'deliberation.fast@baseline';

const baseOrgan = (patch: Partial<SpecialistOrganRow> = {}): SpecialistOrganRow => ({
  specialistId,
  taskSignature,
  capability: 'summarization',
  workshopCandidateId: candidateId,
  promotionPackageRef,
  modelProfileId,
  serviceId: 'vllm-fast',
  predecessorProfileId: fallbackTargetProfileId,
  rollbackTargetProfileId: fallbackTargetProfileId,
  fallbackTargetProfileId,
  stage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
  statusReason: 'limited-active rollout approved',
  currentPolicyId: 'policy-specialist-1',
  createdAt: SPECIALIST_TEST_NOW,
  updatedAt: SPECIALIST_TEST_NOW,
  ...patch,
});

const basePolicy = (
  patch: Partial<SpecialistRolloutPolicyRow> = {},
): SpecialistRolloutPolicyRow => ({
  policyId: 'policy-specialist-1',
  requestId: 'policy-request-1',
  normalizedRequestHash: 'policy-hash-1',
  specialistId,
  governedScope: taskSignature,
  allowedStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
  trafficLimit: 2,
  requiredEvidenceClassesJson: [
    SPECIALIST_EVIDENCE_CLASS.WORKSHOP_PROMOTION,
    SPECIALIST_EVIDENCE_CLASS.GOVERNOR_DECISION,
    SPECIALIST_EVIDENCE_CLASS.SERVING_READINESS,
    SPECIALIST_EVIDENCE_CLASS.RELEASE_EVIDENCE,
    SPECIALIST_EVIDENCE_CLASS.HEALTH,
    SPECIALIST_EVIDENCE_CLASS.ROLLBACK_TARGET,
  ],
  healthMaxAgeMs: 300_000,
  fallbackTargetProfileId,
  evidenceRefsJson: ['policy:evidence:1'],
  createdAt: SPECIALIST_TEST_NOW,
  ...patch,
});

const basePromotionPackage = (): WorkshopPromotionPackage => ({
  candidateId,
  candidateStage: WORKSHOP_CANDIDATE_STAGE.LIMITED_ACTIVE,
  candidateKind: WORKSHOP_CANDIDATE_KIND.SPECIALIST_CANDIDATE,
  targetProfileId: modelProfileId,
  predecessorProfileId: fallbackTargetProfileId,
  rollbackTarget: fallbackTargetProfileId,
  requiredEvalSuite: 'summary-specialist-regression',
  lastKnownGoodEvalReportUri: 'file:///tmp/reports/eval-summary-specialist.json',
  artifactUri: 'file:///tmp/models/summary-specialist/artifact.json',
  dependencyRef: {
    serviceId: 'vllm-fast',
    artifactUri: 'file:///tmp/models/summary-specialist/artifact.json',
    artifactDescriptorPath: '/models/summary-specialist/descriptor.json',
    runtimeArtifactRoot: '/models/summary-specialist',
    readiness: 'ready',
  },
});

const baseServingDependency = (): ServingDependencyState => ({
  serviceId: 'vllm-fast',
  endpoint: 'http://vllm-fast:8000/v1',
  bootCritical: true,
  optionalUntilPromoted: false,
  artifactUri: 'file:///tmp/models/summary-specialist/artifact.json',
  artifactDescriptorPath: '/models/summary-specialist/descriptor.json',
  runtimeArtifactRoot: '/models/summary-specialist',
  readiness: 'ready',
  readinessBasis: 'probe_passed',
  candidateId,
  baseModel: 'model-fast',
  servedModelName: 'summary-specialist',
  detail: 'ready',
  lastCheckedAt: SPECIALIST_TEST_NOW,
});

export async function createSpecialistPolicyTestHarness(
  input: { organ?: Partial<SpecialistOrganRow>; policy?: Partial<SpecialistRolloutPolicyRow> } = {},
): Promise<SpecialistPolicyTestHarness> {
  const dbHarness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(dbHarness.db);
  const organRow = baseOrgan(input.organ);
  const policyRow = basePolicy(input.policy);
  await store.registerSpecialistOrgan(organRow);
  await store.recordRolloutPolicy(policyRow);

  const promotionPackages = new Map<string, WorkshopPromotionPackage>([
    [promotionPackageRef, basePromotionPackage()],
  ]);
  const governorDecisions = new Map<string, SpecialistGovernorEvidence>([
    [
      'governor:allow:1',
      {
        decisionRef: 'governor:allow:1',
        approved: true,
        scope: taskSignature,
        observedAt: SPECIALIST_TEST_NOW,
      },
    ],
  ]);
  const releaseEvidence = new Map<string, SpecialistReleaseEvidence>([
    [
      'release:evidence:1',
      {
        evidenceRef: 'release:evidence:1',
        ready: true,
        observedAt: SPECIALIST_TEST_NOW,
        deploymentIdentity: 'deployment-cell:local',
        modelServingReadinessRef: 'serving:vllm-fast:ready:1',
        governorEvidenceRef: 'governor:allow:1',
        lifecycleRollbackTargetRef: organRow.rollbackTargetProfileId ?? fallbackTargetProfileId,
        specialistId: organRow.specialistId,
        modelProfileId: organRow.modelProfileId,
        serviceId: organRow.serviceId,
        policyId: policyRow.policyId,
        rolloutStage: policyRow.allowedStage,
      },
    ],
  ]);
  const healthEvidence = new Map<string, SpecialistHealthEvidence>([
    [
      'health:ready:1',
      {
        healthRef: 'health:ready:1',
        healthy: true,
        observedAt: SPECIALIST_TEST_NOW,
      },
    ],
  ]);
  const fallbackReadiness = new Map<string, SpecialistFallbackReadiness>([
    [
      fallbackTargetProfileId,
      {
        fallbackTargetProfileId,
        available: true,
        evidenceRef: 'fallback:ready:1',
        observedAt: SPECIALIST_TEST_NOW,
      },
    ],
  ]);
  const servingDependencies = new Map<string, ServingDependencyState>([
    ['vllm-fast', baseServingDependency()],
  ]);

  const ports: SpecialistPolicyEvidencePorts = {
    getWorkshopPromotionPackage: ({ promotionPackageRef: ref }) =>
      Promise.resolve(promotionPackages.get(ref) ?? null),
    getGovernorDecision: (ref) => Promise.resolve(governorDecisions.get(ref) ?? null),
    getServingDependencyState: ({ serviceId }) =>
      Promise.resolve(servingDependencies.get(serviceId) ?? null),
    getReleaseEvidence: (ref) => Promise.resolve(releaseEvidence.get(ref) ?? null),
    getHealthEvidence: ({ healthRef }) =>
      Promise.resolve(healthRef ? (healthEvidence.get(healthRef) ?? null) : null),
    getFallbackReadiness: ({ fallbackTargetProfileId: ref }) =>
      Promise.resolve(fallbackReadiness.get(ref) ?? null),
  };

  return {
    service: createSpecialistPolicyService({
      store,
      evidence: ports,
      now: () => SPECIALIST_TEST_NOW,
      createId: () =>
        `specialist-decision:${Object.keys(dbHarness.state.admissionsById).length + Object.keys(dbHarness.state.retirementsById).length + 1}`,
    }),
    store,
    dbHarness,
    evidence: {
      promotionPackages,
      governorDecisions,
      releaseEvidence,
      healthEvidence,
      fallbackReadiness,
      servingDependencies,
    },
    admissionInput(patch = {}) {
      return {
        requestId: 'admission-request-1',
        specialistId,
        taskSignature,
        selectedModelProfileId: modelProfileId,
        requestedAt: SPECIALIST_TEST_NOW,
        evidenceRefs: {
          governorDecisionRef: 'governor:allow:1',
          servingReadinessRef: 'serving:vllm-fast:ready:1',
          releaseEvidenceRef: 'release:evidence:1',
          healthRef: 'health:ready:1',
          fallbackReadinessRef: 'fallback:ready:1',
        },
        payloadJson: { test: true },
        ...patch,
      };
    },
  };
}
