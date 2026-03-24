import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { tickDecisionV1Schema } from '@yaagi/contracts/cognition';
import type { CoreRuntimeConfig } from './core-config.ts';
import type { DecisionAgentInvoker } from '../cognition/index.ts';

export const PHASE0_AGENT_KEY = 'phase0DecisionAgent' as const;
const PHASE0_AGENT_ID = 'phase0-decision-agent';

export function createPhase0Mastra(config: CoreRuntimeConfig): Mastra<{
  [PHASE0_AGENT_KEY]: Agent<typeof PHASE0_AGENT_ID>;
}> {
  const phase0DecisionAgent = new Agent({
    id: PHASE0_AGENT_ID,
    name: 'Phase 0 Decision Agent',
    instructions: [
      'You are the bounded decision harness for the YAAGI phase-0 runtime.',
      'Operate conservatively, prefer deterministic summaries, and assume only the selected baseline organ/profile is available.',
      'Return a compact structured decision with observations, interpretations, one declarative action proposal, an episode summary and development hints.',
      'Do not claim capabilities that are not mounted into the current deployment cell and do not fabricate narrative, memetic or executive ownership.',
    ].join(' '),
    model: {
      id: 'custom/phase-0-fast',
      url: config.fastModelBaseUrl,
    },
  });

  return new Mastra({
    agents: {
      [PHASE0_AGENT_KEY]: phase0DecisionAgent,
    },
  });
}

const buildPhase0DecisionPrompt = (input: Parameters<DecisionAgentInvoker>[0]): string =>
  [
    'Build one bounded phase-0 decision from the canonical context below.',
    `Selected profile: ${input.selectedProfile.modelProfileId} (${input.selectedProfile.role})`,
    'Prefer deterministic observations and conservative actions. When uncertain, use action.type="reflect" or "none".',
    'Decision context JSON:',
    JSON.stringify(input.context, null, 2),
  ].join('\n\n');

export function createPhase0DecisionInvoker(
  agent: Agent<typeof PHASE0_AGENT_ID>,
): DecisionAgentInvoker {
  return async (input) => {
    const output = await agent.generate(buildPhase0DecisionPrompt(input), {
      maxSteps: 1,
      structuredOutput: {
        schema: tickDecisionV1Schema,
        jsonPromptInjection: true,
      },
    });

    return output.object;
  };
}
