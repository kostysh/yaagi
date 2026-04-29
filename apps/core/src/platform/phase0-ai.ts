import { generateText, jsonSchema, Output } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { tickDecisionV1Schema, type TickDecisionV1 } from '@yaagi/contracts/cognition';
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
  'The selected model endpoint is internal transport metadata, never an allowlisted tool name, and must never appear in action.tool.',
].join(' ');

const createPhase0LanguageModel = (endpoint: string) =>
  createOpenAICompatible({
    name: PHASE0_PROVIDER_NAME,
    baseURL: endpoint,
    apiKey: PHASE0_PROVIDER_API_KEY,
    supportsStructuredOutputs: true,
  })(PHASE0_MODEL_ID);

const VLLM_UNSUPPORTED_JSON_SCHEMA_KEYS = new Set(['propertyNames', 'patternProperties']);

const sanitizeVllmStructuredOutputSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeVllmStructuredOutputSchema(item));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const sanitizedEntries = Object.entries(value).flatMap(([key, nestedValue]) =>
    VLLM_UNSUPPORTED_JSON_SCHEMA_KEYS.has(key)
      ? []
      : [[key, sanitizeVllmStructuredOutputSchema(nestedValue)]],
  );

  return Object.fromEntries(sanitizedEntries);
};

const buildPhase0DecisionServingSchemaDefinition = (): Record<string, unknown> => {
  const canonicalSchema = z.toJSONSchema(tickDecisionV1Schema, {
    target: 'draft-07',
  });

  const sanitizedSchema = sanitizeVllmStructuredOutputSchema(canonicalSchema);
  if (
    sanitizedSchema === null ||
    typeof sanitizedSchema !== 'object' ||
    Array.isArray(sanitizedSchema)
  ) {
    throw new Error('phase-0 decision schema must serialize to a JSON object schema');
  }

  return {
    ...sanitizedSchema,
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TickDecisionV1',
  };
};

const phase0DecisionServingSchema = jsonSchema<TickDecisionV1>(
  buildPhase0DecisionServingSchemaDefinition(),
  {
    validate: async (value) => {
      const result = await tickDecisionV1Schema.safeParseAsync(value);
      return result.success
        ? { success: true, value: result.data }
        : { success: false, error: result.error };
    },
  },
);

const buildTelegramReplyInstruction = (
  input: Parameters<DecisionAgentInvoker>[0],
): string | null => {
  const summary = input.context.perceptualContext.summary;
  const match = summary.match(/telegram\.private stimulus ([^\s]+) updateId=(\d+|unknown) text=/);
  if (!match) {
    return null;
  }

  const stimulusId = match[1];
  if (!stimulusId || !input.context.perceptualMeta.sourceIds.includes(stimulusId)) {
    return null;
  }

  const updateId = match[2] === 'unknown' ? null : Number(match[2]);
  const argsJson = {
    text: 'Acknowledged.',
    correlationId: `telegram:${input.context.tickId}:${stimulusId}`,
    replyToStimulusId: stimulusId,
    ...(updateId === null ? {} : { replyToTelegramUpdateId: updateId }),
  };

  return [
    'Current context includes an operator direct Telegram message that asks for a reply.',
    'For this context, choose action.type="tool_call" and tool="telegram.sendMessage".',
    `Use argsJson shaped like this, with natural reply text if you can improve it: ${JSON.stringify(argsJson)}.`,
  ].join(' ');
};

const buildPhase0DecisionPrompt = (input: Parameters<DecisionAgentInvoker>[0]): string =>
  [
    'Build one bounded phase-0 decision from the canonical context below.',
    `Selected profile: ${input.selectedProfile.modelProfileId} (${input.selectedProfile.role})`,
    `Selected model endpoint (transport metadata only, never copy into action.tool): ${input.selectedProfile.endpoint}`,
    'Prefer deterministic observations and conservative actions. When uncertain, use action.type="reflect" or "none".',
    'If you choose action.type="tool_call", tool must be an allowlisted tool name and never a URL, endpoint, or model identifier.',
    'When perceptualContext.summary contains a telegram.private stimulus that needs an answer, use action.type="tool_call" with tool="telegram.sendMessage".',
    'For telegram.sendMessage argsJson, include only text, correlationId, replyToStimulusId and optional replyToTelegramUpdateId. Use the matching perceptualMeta.sourceIds stimulus id as replyToStimulusId and the summary updateId as replyToTelegramUpdateId when present. Never include chat_id, chatId, recipientChatId or any recipient field.',
    buildTelegramReplyInstruction(input),
    'Return a JSON object that satisfies the requested decision schema and contains no surrounding prose.',
    'Decision context JSON:',
    JSON.stringify(input.context),
  ]
    .filter((line): line is string => typeof line === 'string' && line.length > 0)
    .join('\n\n');

const normalizeComparableUrl = (value: string): string => {
  const parsed = new URL(value);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/+$/, '');
};

const isEndpointEchoTool = (toolName: string | undefined, endpoint: string): boolean => {
  if (!toolName || !endpoint) {
    return false;
  }

  if (toolName === endpoint) {
    return true;
  }

  try {
    return normalizeComparableUrl(toolName) === normalizeComparableUrl(endpoint);
  } catch {
    return false;
  }
};

const sanitizePhase0DecisionOutput = (
  decision: TickDecisionV1,
  endpoint: string,
): TickDecisionV1 => {
  if (decision.action.type !== 'tool_call') {
    return decision;
  }

  if (!isEndpointEchoTool(decision.action.tool, endpoint)) {
    return decision;
  }

  return {
    ...decision,
    action: {
      type: 'none',
      summary: 'Keep the outcome bounded without invoking the model endpoint as a tool.',
    },
  };
};

export function createPhase0DecisionInvoker(): DecisionAgentInvoker {
  return async (input) => {
    const { output } = await generateText({
      model: createPhase0LanguageModel(input.selectedProfile.endpoint),
      system: PHASE0_DECISION_SYSTEM_PROMPT,
      prompt: buildPhase0DecisionPrompt(input),
      output: Output.object({
        schema: phase0DecisionServingSchema,
        name: 'TickDecisionV1',
        description: 'YAAGI phase-0 bounded decision envelope',
      }),
      temperature: 0,
      maxRetries: 0,
    });

    return sanitizePhase0DecisionOutput(output, input.selectedProfile.endpoint);
  };
}
