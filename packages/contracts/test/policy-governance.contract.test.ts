import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTANT_KIND,
  PERCEPTION_POLICY_OUTCOME,
  POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE,
  POLICY_GOVERNANCE_OWNED_WRITE_SURFACE,
  POLICY_GOVERNANCE_SCOPE,
  POLICY_PROFILE_STATUS,
  POLICY_REFUSAL_REASON,
  assertPolicyGovernanceOwnedWriteSurface,
  assertValidPolicyProfile,
  isConsultantKind,
  isPerceptionPolicyOutcome,
  isPolicyGovernanceScope,
  isPolicyProfileStatus,
  type PolicyProfileRow,
} from '../src/policy-governance.ts';

const validProfile = (): PolicyProfileRow => ({
  profileId: 'policy.phase6.baseline',
  profileVersion: '2026-04-24.phase6-conservative',
  status: POLICY_PROFILE_STATUS.ACTIVE,
  governedScopesJson: [
    POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE,
  ],
  activationRequirementsJson: {
    callerAdmissionEvidence: true,
    governorEvidence: true,
    perimeterEvidence: true,
    reportingEvidence: false,
    maxEvidenceAgeMs: 300_000,
  },
  rulesJson: {
    externalConsultantsEnabled: false,
    supportedConsultantKinds: [CONSULTANT_KIND.EXTERNAL_LLM],
    defaultPerceptionOutcome: PERCEPTION_POLICY_OUTCOME.ACCEPTED,
  },
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
});

void test('AC-F0025-01 / AC-F0025-02 defines the phase-6 policy-profile vocabulary', () => {
  assert.equal(isPolicyProfileStatus(POLICY_PROFILE_STATUS.DRAFT), true);
  assert.equal(isPolicyProfileStatus(POLICY_PROFILE_STATUS.ACTIVE), true);
  assert.equal(isPolicyProfileStatus(POLICY_PROFILE_STATUS.RETIRED), true);
  assert.equal(isPolicyProfileStatus(POLICY_PROFILE_STATUS.BLOCKED), true);
  assert.equal(isPolicyGovernanceScope(POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION), true);
  assert.equal(isPolicyGovernanceScope(POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE), true);
  assert.equal(isConsultantKind(CONSULTANT_KIND.EXTERNAL_LLM), true);
  assert.equal(isPerceptionPolicyOutcome(PERCEPTION_POLICY_OUTCOME.HUMAN_GATED), true);

  assert.doesNotThrow(() => assertValidPolicyProfile(validProfile()));
});

void test('AC-F0025-02 rejects active profiles without governed scopes or valid evidence thresholds', () => {
  assert.throws(
    () =>
      assertValidPolicyProfile({
        ...validProfile(),
        governedScopesJson: [],
      }),
    /at least one governed scope/,
  );
  assert.throws(
    () =>
      assertValidPolicyProfile({
        ...validProfile(),
        activationRequirementsJson: {
          ...validProfile().activationRequirementsJson,
          maxEvidenceAgeMs: 0,
        },
      }),
    /maxEvidenceAgeMs/,
  );
});

void test('AC-F0025-01 / AC-F0025-14 limits owned write surfaces to F-0025 decision facts', () => {
  assert.doesNotThrow(() =>
    assertPolicyGovernanceOwnedWriteSurface(
      POLICY_GOVERNANCE_OWNED_WRITE_SURFACE.CONSULTANT_ADMISSION_DECISIONS,
    ),
  );
  assert.throws(
    () =>
      assertPolicyGovernanceOwnedWriteSurface(
        POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE.STIMULUS_INBOX,
      ),
    new RegExp(POLICY_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED),
  );
});
