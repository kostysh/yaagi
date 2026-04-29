import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  createEmptyNarrativeMemeticOutputs,
  DECISION_MODE,
  type DecisionContext,
} from '@yaagi/contracts/cognition';
import { createDecisionHarness } from '../../src/cognition/index.ts';
import { createPhase0DecisionInvoker, PHASE0_MODEL_ID } from '../../src/platform/index.ts';

(
  globalThis as typeof globalThis & {
    AI_SDK_LOG_WARNINGS?: boolean;
  }
).AI_SDK_LOG_WARNINGS = false;

const baseContext: DecisionContext = {
  tickId: 'tick-phase0-ai',
  decisionMode: DECISION_MODE.REACTIVE,
  selectedModelProfileId: 'reflex.fast@baseline',
  selectedRole: 'reflex',
  perceptualContext: {
    tickId: 'tick-phase0-ai',
    summary: 'one operator-originated signal is waiting',
    urgency: 0.7,
    novelty: 0.5,
    resourcePressure: 0.2,
  },
  perceptualMeta: {
    truncated: false,
    sourceIds: ['stimulus-1'],
    conflictMarkers: [],
  },
  subjectState: {
    subjectStateSchemaVersion: '2026-03-25',
    agentState: {
      agentId: 'polyphony-core',
      mode: 'normal',
      currentTickId: null,
      currentModelProfileId: 'reflex.fast@baseline',
      lastStableSnapshotId: null,
      psmJson: {},
      resourcePostureJson: {
        pressure: 0.2,
      },
    },
    goals: [],
    beliefs: [],
    entities: [],
    relationships: [],
  },
  subjectStateMeta: {
    truncated: false,
    sourceIds: ['agent_state:1'],
    conflictMarkers: [],
  },
  recentEpisodes: [],
  episodeMeta: {
    truncated: false,
    sourceIds: [],
    conflictMarkers: [],
  },
  narrativeMemetic: createEmptyNarrativeMemeticOutputs(),
  narrativeMemeticMeta: {
    truncated: false,
    sourceIds: [],
    conflictMarkers: [],
  },
  resourcePostureJson: {
    pressure: 0.2,
  },
};

const baseHarnessInput = {
  tickId: 'tick-phase0-ai',
  decisionMode: DECISION_MODE.REACTIVE,
  selectedProfile: {
    modelProfileId: 'reflex.fast@baseline',
    role: 'reflex' as const,
    endpoint: '',
    adapterOf: null,
    eligibility: 'eligible' as const,
  },
  subjectStateSnapshot: {
    subjectStateSchemaVersion: '2026-03-25',
    agentState: {
      agentId: 'polyphony-core',
      mode: 'normal' as const,
      currentTickId: null,
      currentModelProfileId: 'reflex.fast@baseline',
      lastStableSnapshotId: null,
      psmJson: {},
      resourcePostureJson: {
        pressure: 0.2,
      },
    },
    goals: [],
    beliefs: [],
    entities: [],
    relationships: [],
  },
  recentEpisodes: [],
  perceptionBatch: {
    tickId: 'tick-phase0-ai',
    claimedStimulusIds: ['stimulus-1'],
    highestPriority: 'normal' as const,
    requiresImmediateTick: false,
    sourceKinds: ['system' as const],
    items: [
      {
        stimulusIds: ['stimulus-1'],
        primaryStimulusId: 'stimulus-1',
        source: 'system' as const,
        signalType: 'system.notice',
        occurredAt: '2026-03-25T00:00:00.000Z',
        priority: 'normal' as const,
        requiresImmediateTick: false,
        threadId: null,
        entityRefs: [],
        payload: {},
        dedupeKey: null,
        coalescedCount: 1,
      },
    ],
  },
};

const hasStringContent = (value: unknown): value is { content: string } =>
  typeof value === 'object' &&
  value !== null &&
  'content' in value &&
  typeof (value as { content?: unknown }).content === 'string';

const hasSchemaKeyword = (value: unknown, keyword: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasSchemaKeyword(item, keyword));
  }

  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (keyword in value) {
    return true;
  }

  return Object.values(value).some((item) => hasSchemaKeyword(item, keyword));
};

const withServer = async <T>(
  handler: (requestBody: Record<string, unknown>) => string,
  run: (endpoint: string, requests: Array<Record<string, unknown>>) => Promise<T>,
): Promise<T> => {
  const requests: Array<Record<string, unknown>> = [];
  const server = createServer((request, response) => {
    void (async () => {
      const bodyChunks: Buffer[] = [];
      for await (const chunk of request) {
        bodyChunks.push(
          typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array),
        );
      }

      const requestBody =
        bodyChunks.length === 0
          ? {}
          : (JSON.parse(Buffer.concat(bodyChunks).toString('utf8')) as Record<string, unknown>);
      requests.push(requestBody);

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'chatcmpl-phase0-ai-test',
          object: 'chat.completion',
          created: 0,
          model: PHASE0_MODEL_ID,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: handler(requestBody),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      );
    })().catch((error: unknown) => {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    throw new Error('failed to bind phase0 AI integration server');
  }

  try {
    return await run(`http://127.0.0.1:${address.port}/v1`, requests);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
};

void test('AC-F0009-03 returns a validated TickDecisionV1 envelope from the bounded AI SDK decision harness', async () => {
  await withServer(
    () =>
      JSON.stringify({
        observations: ['phase-0 adapter received the bounded context'],
        interpretations: ['ai sdk structured generation is wired'],
        action: {
          type: 'reflect',
          summary: 'keep the decision boundary conservative',
        },
        episode: {
          summary: 'bounded ai sdk decision completed',
          importance: 0.35,
        },
        developmentHints: ['preserve the health-only public surface'],
      }),
    async (endpoint, requests) => {
      const invokeDecision = createPhase0DecisionInvoker();
      const decision = await invokeDecision({
        context: baseContext,
        selectedProfile: {
          ...baseHarnessInput.selectedProfile,
          endpoint,
        },
      });

      assert.equal(requests.length, 1);
      const [requestBody] = requests;
      const messages = requestBody?.['messages'];

      assert.equal(requestBody?.['model'], PHASE0_MODEL_ID);
      assert.equal(
        (requestBody?.['response_format'] as { type?: unknown } | undefined)?.type,
        'json_schema',
      );
      assert.equal(
        (
          requestBody?.['response_format'] as
            | {
                json_schema?: { schema?: unknown; name?: unknown };
              }
            | undefined
        )?.json_schema?.name,
        'TickDecisionV1',
      );
      const providerSchema = (
        requestBody?.['response_format'] as
          | {
              json_schema?: { schema?: unknown };
            }
          | undefined
      )?.json_schema?.schema;
      assert.equal(hasSchemaKeyword(providerSchema, 'propertyNames'), false);
      assert.equal(hasSchemaKeyword(providerSchema, 'patternProperties'), false);
      assert.ok(
        Array.isArray(messages) &&
          messages.some(
            (message) =>
              hasStringContent(message) &&
              message.content.includes('Selected profile: reflex.fast@baseline (reflex)'),
          ),
      );
      assert.ok(
        Array.isArray(messages) &&
          messages.some(
            (message) =>
              hasStringContent(message) && message.content.includes('never copy into action.tool'),
          ),
      );
      assert.ok(
        Array.isArray(messages) &&
          messages.some(
            (message) =>
              hasStringContent(message) &&
              message.content.includes(
                'When perceptualContext.summary contains a telegram.private stimulus',
              ) &&
              message.content.includes('Use the matching perceptualMeta.sourceIds stimulus id'),
          ),
      );

      assert.equal((decision as { action: { type: string } }).action.type, 'reflect');
      assert.equal(
        (decision as { episode: { summary: string } }).episode.summary,
        'bounded ai sdk decision completed',
      );
    },
  );
});

void test('AC-F0020-03 sanitizes endpoint-echo tool calls back into bounded inaction before executive handoff', async () => {
  let selectedEndpoint = '';
  await withServer(
    () =>
      JSON.stringify({
        observations: ['telegram stimulus requires immediate handling'],
        interpretations: ['the selected endpoint was mistakenly treated as a tool'],
        action: {
          type: 'tool_call',
          tool: selectedEndpoint,
          summary: 'Invoke the selected endpoint to process the current stimuli.',
        },
        episode: {
          summary: 'endpoint echo was normalized before executive handoff',
          importance: 0.4,
        },
        developmentHints: ['keep endpoint transport metadata out of action.tool'],
      }),
    async (endpoint) => {
      selectedEndpoint = endpoint;
      const invokeDecision = createPhase0DecisionInvoker();
      const decision = await invokeDecision({
        context: baseContext,
        selectedProfile: {
          ...baseHarnessInput.selectedProfile,
          endpoint,
        },
      });

      assert.equal((decision as { action: { type: string } }).action.type, 'none');
      assert.equal(
        (decision as { action: { summary: string } }).action.summary,
        'Keep the outcome bounded without invoking the model endpoint as a tool.',
      );
      assert.equal('tool' in (decision as { action: Record<string, unknown> }).action, false);
    },
  );
});

void test('AC-F0029-24 adds concrete Telegram reply correlation fields to the phase-0 prompt', async () => {
  await withServer(
    () =>
      JSON.stringify({
        observations: ['operator telegram stimulus needs a reply'],
        interpretations: ['phase-0 can answer through the bounded telegram tool'],
        action: {
          type: 'tool_call',
          tool: 'telegram.sendMessage',
          summary: 'Send one bounded Telegram acknowledgement.',
          argsJson: {
            text: 'Acknowledged.',
            correlationId: 'telegram:tick-phase0-ai:stimulus-telegram-1',
            replyToStimulusId: 'stimulus-telegram-1',
            replyToTelegramUpdateId: 77,
          },
        },
        episode: {
          summary: 'operator telegram reply was selected',
          importance: 0.4,
        },
        developmentHints: ['keep telegram egress inside the executive gateway'],
      }),
    async (endpoint, requests) => {
      const invokeDecision = createPhase0DecisionInvoker();
      const decision = await invokeDecision({
        context: {
          ...baseContext,
          perceptualContext: {
            ...baseContext.perceptualContext,
            summary:
              '1 claimed stimuli (telegram:1); telegram.private stimulus stimulus-telegram-1 updateId=77 text="answer with one short acknowledgement"',
          },
          perceptualMeta: {
            ...baseContext.perceptualMeta,
            sourceIds: ['stimulus-telegram-1'],
          },
        },
        selectedProfile: {
          ...baseHarnessInput.selectedProfile,
          endpoint,
        },
      });

      const messages = requests[0]?.['messages'];
      assert.ok(
        Array.isArray(messages) &&
          messages.some(
            (message) =>
              hasStringContent(message) &&
              message.content.includes(
                '"correlationId":"telegram:tick-phase0-ai:stimulus-telegram-1"',
              ) &&
              message.content.includes('"replyToTelegramUpdateId":77'),
          ),
      );
      assert.equal((decision as { action: { type: string } }).action.type, 'tool_call');
    },
  );
});

void test('AC-F0009-04 refuses invalid AI SDK decision output before downstream handoff', async () => {
  await withServer(
    () =>
      JSON.stringify({
        action: {
          type: 'reflect',
        },
      }),
    async (endpoint) => {
      const harness = createDecisionHarness({
        invokeAgent: createPhase0DecisionInvoker(),
      });

      const result = await harness.run({
        ...baseHarnessInput,
        selectedProfile: {
          ...baseHarnessInput.selectedProfile,
          endpoint,
        },
      });

      assert.equal(result.accepted, false);
      if (result.accepted) {
        return;
      }

      assert.equal(result.reason, 'decision_schema_invalid');
    },
  );
});
