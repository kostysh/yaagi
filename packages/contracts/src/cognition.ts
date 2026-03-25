import { z } from 'zod';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const DECISION_MODE = Object.freeze({
  REACTIVE: 'reactive',
  DELIBERATIVE: 'deliberative',
  CONTEMPLATIVE: 'contemplative',
} as const);

export type DecisionMode = (typeof DECISION_MODE)[keyof typeof DECISION_MODE];

export const decisionModeSchema = z.enum([
  DECISION_MODE.REACTIVE,
  DECISION_MODE.DELIBERATIVE,
  DECISION_MODE.CONTEMPLATIVE,
]);

export const decisionRoleSchema = z.enum(['reflex', 'deliberation', 'reflection']);

export type DecisionRole = z.infer<typeof decisionRoleSchema>;

export const contextSectionMetaSchema = z.object({
  truncated: z.boolean(),
  sourceIds: z.array(z.string().min(1)),
  conflictMarkers: z.array(z.string().min(1)),
});

export type ContextSectionMeta = z.infer<typeof contextSectionMetaSchema>;

export const perceptualContextSchema = z.object({
  tickId: z.string().min(1),
  summary: z.string().min(1),
  urgency: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  resourcePressure: z.number().min(0).max(1),
});

export type PerceptualContext = z.infer<typeof perceptualContextSchema>;

export const narrativeMemeticDecisionModeSchema = z.enum([
  'wake',
  DECISION_MODE.REACTIVE,
  DECISION_MODE.DELIBERATIVE,
  DECISION_MODE.CONTEMPLATIVE,
]);

export type NarrativeMemeticDecisionMode = z.infer<typeof narrativeMemeticDecisionModeSchema>;

export const fieldJournalMaturityStateSchema = z.enum(['immature', 'tracking', 'escalated']);

export type FieldJournalMaturityState = z.infer<typeof fieldJournalMaturityStateSchema>;

export const memeticUnitStatusSchema = z.enum([
  'active',
  'dormant',
  'quarantined',
  'retired',
  'merged',
]);

export type MemeticUnitStatus = z.infer<typeof memeticUnitStatusSchema>;

export const memeticEdgeRelationKindSchema = z.enum([
  'supports',
  'suppresses',
  'contextualizes',
  'contradicts',
]);

export type MemeticEdgeRelationKind = z.infer<typeof memeticEdgeRelationKindSchema>;

export const tickLocalMemeticCandidateSourceKindSchema = z.enum([
  'stimulus',
  'episode',
  'goal',
  'belief',
  'entity',
  'journal',
]);

export type TickLocalMemeticCandidateSourceKind = z.infer<
  typeof tickLocalMemeticCandidateSourceKindSchema
>;

const narrativeMemeticInputUnitSchema = z.object({
  unitId: z.string().min(1),
  label: z.string().min(1),
  activation: z.number().min(0).max(1),
  reinforcement: z.number().min(0).max(1),
  decay: z.number().min(0).max(1),
  provenanceAnchors: z.array(z.string().min(1)),
});

const fieldJournalExcerptInputSchema = z.object({
  entryId: z.string().min(1),
  summary: z.string().min(1),
  tensionMarkers: z.array(z.string().min(1)),
  provenanceAnchors: z.array(z.string().min(1)),
});

export const narrativeMemeticInputsSchema = z.object({
  tickId: z.string().min(1),
  decisionMode: narrativeMemeticDecisionModeSchema,
  perceptionSummary: z.object({
    stimulusRefs: z.array(z.string().min(1)),
    urgency: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    resourcePressure: z.number().min(0).max(1),
    summary: z.string().min(1),
  }),
  subjectStateSnapshot: z.object({
    subjectStateSchemaVersion: z.string().min(1),
    goals: z.array(jsonRecordSchema),
    beliefs: z.array(jsonRecordSchema),
    entities: z.array(jsonRecordSchema),
    relationships: z.array(jsonRecordSchema),
    agentState: jsonRecordSchema,
  }),
  recentEpisodes: z.array(
    z.object({
      episodeId: z.string().min(1),
      tickId: z.string().min(1),
      summary: z.string().min(1),
      sourceRefs: z.array(z.string().min(1)),
    }),
  ),
  activeMemeticUnits: z.array(narrativeMemeticInputUnitSchema),
  fieldJournalExcerpts: z.array(fieldJournalExcerptInputSchema),
  resourcePostureJson: jsonRecordSchema,
});

export type NarrativeMemeticInputs = z.infer<typeof narrativeMemeticInputsSchema>;

export const tickLocalMemeticCandidateSchema = z.object({
  candidateId: z.string().min(1),
  abstractLabel: z.string().min(1),
  supportingRefs: z.array(z.string().min(1)),
  sourceKinds: z.array(tickLocalMemeticCandidateSourceKindSchema),
  durablePromotionAllowed: z.literal(false),
});

export type TickLocalMemeticCandidate = z.infer<typeof tickLocalMemeticCandidateSchema>;

export const narrativeMemeticOutputsSchema = z.object({
  activeMemeticUnits: z.array(
    z.object({
      unitId: z.string().min(1),
      label: z.string().min(1),
      activation: z.number().min(0).max(1),
      reinforcement: z.number().min(0).max(1),
      decay: z.number().min(0).max(1),
    }),
  ),
  winningCoalition: z
    .object({
      coalitionId: z.string().min(1),
      vector: z.string().min(1),
      strength: z.number().min(0).max(1),
      memberUnitIds: z.array(z.string().min(1)),
    })
    .nullable(),
  coalitionDiagnostics: z.object({
    suppressedUnitIds: z.array(z.string().min(1)),
    supportEdges: z.array(z.string().min(1)),
    conflictMarkers: z.array(z.string().min(1)),
  }),
  affectPatch: jsonRecordSchema,
  narrativeSummary: z.object({
    currentChapter: z.string().min(1),
    summary: z.string().min(1),
    continuityDirection: z.string().min(1),
  }),
  fieldJournalExcerpts: z.array(
    z.object({
      entryId: z.string().min(1),
      summary: z.string().min(1),
      maturityState: fieldJournalMaturityStateSchema,
    }),
  ),
  narrativeTensions: z.array(
    z.object({
      tensionId: z.string().min(1),
      summary: z.string().min(1),
      severity: z.number().min(0).max(1),
    }),
  ),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticOutputs = z.infer<typeof narrativeMemeticOutputsSchema>;

export const narrativeMemeticSeedUnitSchema = z.object({
  unitId: z.string().min(1),
  originKind: z.enum(['seeded', 'consolidated', 'governor_labeled']),
  unitType: z.string().min(1),
  abstractLabel: z.string().min(1),
  canonicalSummary: z.string().min(1),
  activation: z.number().min(0).max(1),
  reinforcement: z.number().min(0).max(1),
  decay: z.number().min(0).max(1),
  evidenceScore: z.number().min(0).max(1),
  status: memeticUnitStatusSchema,
  createdByPath: z.string().min(1),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticSeedUnit = z.infer<typeof narrativeMemeticSeedUnitSchema>;

export const narrativeMemeticUnitUpdateSchema = z.object({
  unitId: z.string().min(1),
  activation: z.number().min(0).max(1),
  reinforcement: z.number().min(0).max(1),
  decay: z.number().min(0).max(1),
  evidenceScore: z.number().min(0).max(1),
  status: memeticUnitStatusSchema,
  lastActivatedTickId: z.string().min(1).nullable(),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticUnitUpdate = z.infer<typeof narrativeMemeticUnitUpdateSchema>;

export const narrativeMemeticEdgeUpsertSchema = z.object({
  edgeId: z.string().min(1),
  sourceUnitId: z.string().min(1),
  targetUnitId: z.string().min(1),
  relationKind: memeticEdgeRelationKindSchema,
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export type NarrativeMemeticEdgeUpsert = z.infer<typeof narrativeMemeticEdgeUpsertSchema>;

export const narrativeMemeticCoalitionRecordSchema = z.object({
  coalitionId: z.string().min(1),
  decisionMode: decisionModeSchema,
  vector: z.string().min(1),
  memberUnitIds: z.array(z.string().min(1)),
  supportScore: z.number().min(0).max(1),
  suppressionScore: z.number().min(0).max(1),
  winning: z.boolean(),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticCoalitionRecord = z.infer<typeof narrativeMemeticCoalitionRecordSchema>;

export const narrativeMemeticTensionSchema = z.object({
  tensionId: z.string().min(1),
  summary: z.string().min(1),
  severity: z.number().min(0).max(1),
});

export type NarrativeMemeticTension = z.infer<typeof narrativeMemeticTensionSchema>;

export const narrativeMemeticNarrativeVersionSchema = z.object({
  versionId: z.string().min(1),
  basedOnVersionId: z.string().min(1).nullable(),
  currentChapter: z.string().min(1),
  summary: z.string().min(1),
  continuityDirection: z.string().min(1),
  tensions: z.array(narrativeMemeticTensionSchema),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticNarrativeVersion = z.infer<
  typeof narrativeMemeticNarrativeVersionSchema
>;

export const narrativeMemeticJournalEntrySchema = z.object({
  entryId: z.string().min(1),
  entryType: z.string().min(1),
  summary: z.string().min(1),
  interpretation: z.string().min(1),
  tensionMarkers: z.array(z.string().min(1)),
  maturityState: fieldJournalMaturityStateSchema,
  linkedUnitId: z.string().min(1).nullable(),
  provenanceAnchors: z.array(z.string().min(1)),
});

export type NarrativeMemeticJournalEntry = z.infer<typeof narrativeMemeticJournalEntrySchema>;

export const narrativeMemeticTickDeltaSchema = z.object({
  seedMemeticUnits: z.array(narrativeMemeticSeedUnitSchema),
  memeticUnitUpdates: z.array(narrativeMemeticUnitUpdateSchema),
  memeticEdgeUpserts: z.array(narrativeMemeticEdgeUpsertSchema),
  coalition: narrativeMemeticCoalitionRecordSchema.nullable(),
  narrativeVersion: narrativeMemeticNarrativeVersionSchema.nullable(),
  fieldJournalEntries: z.array(narrativeMemeticJournalEntrySchema),
});

export type NarrativeMemeticTickDelta = z.infer<typeof narrativeMemeticTickDeltaSchema>;

export const createEmptyNarrativeMemeticOutputs = (): NarrativeMemeticOutputs => ({
  activeMemeticUnits: [],
  winningCoalition: null,
  coalitionDiagnostics: {
    suppressedUnitIds: [],
    supportEdges: [],
    conflictMarkers: [],
  },
  affectPatch: {},
  narrativeSummary: {
    currentChapter: 'bootstrap',
    summary: 'narrative/memetic handoff is empty',
    continuityDirection: 'hold',
  },
  fieldJournalExcerpts: [],
  narrativeTensions: [],
  provenanceAnchors: [],
});

export const decisionContextSchema = z.object({
  tickId: z.string().min(1),
  decisionMode: decisionModeSchema,
  selectedModelProfileId: z.string().min(1),
  selectedRole: decisionRoleSchema,
  perceptualContext: perceptualContextSchema,
  perceptualMeta: contextSectionMetaSchema,
  subjectState: z.object({
    subjectStateSchemaVersion: z.string().min(1),
    agentState: jsonRecordSchema,
    goals: z.array(jsonRecordSchema),
    beliefs: z.array(jsonRecordSchema),
    entities: z.array(jsonRecordSchema),
    relationships: z.array(jsonRecordSchema),
  }),
  subjectStateMeta: contextSectionMetaSchema,
  recentEpisodes: z.array(
    z.object({
      episodeId: z.string().min(1),
      tickId: z.string().min(1),
      summary: z.string().min(1),
      resultJson: jsonRecordSchema,
      createdAt: z.string().datetime({ offset: true }),
    }),
  ),
  episodeMeta: contextSectionMetaSchema,
  narrativeMemetic: narrativeMemeticOutputsSchema,
  narrativeMemeticMeta: contextSectionMetaSchema,
  resourcePostureJson: jsonRecordSchema,
});

export type DecisionContext = z.infer<typeof decisionContextSchema>;

export const tickDecisionActionSchema = z.object({
  type: z.enum(['none', 'tool_call', 'reflect', 'schedule_job']),
  summary: z.string().min(1),
  tool: z.string().min(1).optional(),
  argsJson: jsonRecordSchema.optional(),
});

export type TickDecisionAction = z.infer<typeof tickDecisionActionSchema>;

export const tickDecisionV1Schema = z.object({
  observations: z.array(z.string().min(1)),
  interpretations: z.array(z.string().min(1)),
  action: tickDecisionActionSchema,
  episode: z.object({
    summary: z.string().min(1),
    importance: z.number().min(0).max(1),
  }),
  developmentHints: z.array(z.string().min(1)),
});

export type TickDecisionV1 = z.infer<typeof tickDecisionV1Schema>;

export const decisionRefusalReasonSchema = z.enum([
  'context_incompatible',
  'selected_profile_missing',
  'selected_profile_ineligible',
  'unsupported_decision_mode',
  'decision_schema_invalid',
]);

export type DecisionRefusalReason = z.infer<typeof decisionRefusalReasonSchema>;

export const decisionAcceptedSchema = z.object({
  accepted: z.literal(true),
  decision: tickDecisionV1Schema,
});

export const decisionRefusalSchema = z.object({
  accepted: z.literal(false),
  reason: decisionRefusalReasonSchema,
  detail: z.string().min(1),
});

export const decisionResultSchema = z.discriminatedUnion('accepted', [
  decisionAcceptedSchema,
  decisionRefusalSchema,
]);

export type DecisionAccepted = z.infer<typeof decisionAcceptedSchema>;
export type DecisionRefusal = z.infer<typeof decisionRefusalSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;
