import { generateText, Output } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { tickDecisionV1Schema } from '@yaagi/contracts/cognition';
import type { DecisionAgentInvoker } from '../cognition/index.ts';

export const PHASE0_AGENT_KEY = 'phase0DecisionAgent' as const;
export const PHASE0_AGENT_KEYS = [PHASE0_AGENT_KEY] as const;
export const PHASE0_MODEL_ID = 'phase-0-fast' as const;

const PHASE0_PROVIDER_NAME = 'yaagi-fast-model';
const PHASE0_PROVIDER_API_KEY = 'phase-0-local';
const PHASE0_DECISION_SYSTEM_PROMPT = [
  'You are the bounded decision harness for the YAAGI phase-0 runtime.',
  'Operate conservatively, prefer deterministic summaries, and assume only the selected baseline organ/profile is available.',
  'Return a compact structured decision with observations, interpretations, one declarative action proposal, an episode summary and development hints.',
  'Do not claim capabilities that are not mounted into the current deployment cell and do not fabricate narrative, memetic or executive ownership.',
].join(' ');

const createPhase0LanguageModel = (endpoint: string) =>
  createOpenAICompatible({
    name: PHASE0_PROVIDER_NAME,
    baseURL: endpoint,
    apiKey: PHASE0_PROVIDER_API_KEY,
  })(PHASE0_MODEL_ID);

const buildPhase0DecisionPrompt = (input: Parameters<DecisionAgentInvoker>[0]): string =>
  [
    'Build one bounded phase-0 decision from the canonical context below.',
    `Selected profile: ${input.selectedProfile.modelProfileId} (${input.selectedProfile.role})`,
    `Selected endpoint: ${input.selectedProfile.endpoint}`,
    'Prefer deterministic observations and conservative actions. When uncertain, use action.type="reflect" or "none".',
    'Return a JSON object that satisfies the requested decision schema and contains no surrounding prose.',
    'Decision context JSON:',
    JSON.stringify(input.context, null, 2),
  ].join('\n\n');

export function createPhase0DecisionInvoker(): DecisionAgentInvoker {
  return async (input) => {
    const { output } = await generateText({
      model: createPhase0LanguageModel(input.selectedProfile.endpoint),
      system: PHASE0_DECISION_SYSTEM_PROMPT,
      prompt: buildPhase0DecisionPrompt(input),
      output: Output.object({
        schema: tickDecisionV1Schema,
        name: 'TickDecisionV1',
        description: 'YAAGI phase-0 bounded decision envelope',
      }),
      temperature: 0,
      maxRetries: 0,
    });

    return output;
  };
}
