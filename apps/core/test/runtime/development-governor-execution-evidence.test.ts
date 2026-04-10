import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVELOPMENT_PROPOSAL_EXECUTION_OUTCOME_KIND } from '@yaagi/contracts/governor';
import { createDbBackedDevelopmentGovernorService } from '../../src/runtime/development-governor.ts';

void test('AC-F0016-09 rejects under-specified execution outcome evidence before DB handoff', async () => {
  const governor = createDbBackedDevelopmentGovernorService({
    postgresUrl: 'postgres://unused:unused@127.0.0.1:65432/unused',
  });

  const result = await governor.recordProposalExecutionOutcome({
    requestId: 'proposal-execution-missing-evidence',
    proposalId: 'development-proposal:1',
    outcomeKind: DEVELOPMENT_PROPOSAL_EXECUTION_OUTCOME_KIND.EXECUTED,
    outcomeOrigin: 'human_override',
    targetRef: '',
    evidenceRefs: [],
    recordedAt: '2026-04-10T12:40:00.000Z',
  });

  assert.deepEqual(result, {
    accepted: false,
    requestId: 'proposal-execution-missing-evidence',
    reason: 'insufficient_evidence',
  });
});
