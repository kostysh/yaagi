import {
  STIMULUS_STATUS,
  getStimulusPriorityRank,
  normalizedStimulusSchema,
  type EnqueueStimulusInput,
  type PerceptionBacklogCounts,
  type PerceptionBatch,
  type StimulusInboxRecord,
} from '@yaagi/contracts/perception';

const nowIso = () => '2026-03-23T00:00:00.000Z';

export type PerceptionStoreHarness = ReturnType<typeof createPerceptionStoreHarness>;

export function createPerceptionStoreHarness(seed: StimulusInboxRecord[] = []) {
  const stimuli = new Map(seed.map((stimulus) => [stimulus.stimulusId, structuredClone(stimulus)]));
  const tickClaims = new Map<string, PerceptionBatch>();

  const store = {
    enqueueStimulus(input: EnqueueStimulusInput): Promise<StimulusInboxRecord> {
      const normalizedJson = normalizedStimulusSchema.parse({
        envelope: input.envelope,
        signalType: input.signalType,
        dedupeKey: input.dedupeKey ?? null,
        aggregateHints: input.aggregateHints ?? {},
      });

      const record: StimulusInboxRecord = {
        stimulusId: input.envelope.id,
        sourceKind: input.envelope.source,
        threadId: input.envelope.threadId ?? null,
        occurredAt: input.envelope.occurredAt,
        priority: input.envelope.priority,
        priorityRank: getStimulusPriorityRank(input.envelope.priority),
        requiresImmediateTick: input.envelope.requiresImmediateTick,
        payloadJson: input.envelope.payload,
        normalizedJson,
        dedupeKey: input.dedupeKey ?? null,
        claimTickId: null,
        status: STIMULUS_STATUS.QUEUED,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      stimuli.set(record.stimulusId, structuredClone(record));
      return Promise.resolve(structuredClone(record));
    },

    findLatestBySourceAndDedupeKey(input: {
      sourceKind: StimulusInboxRecord['sourceKind'];
      dedupeKey: string;
      statuses?: StimulusInboxRecord['status'][];
    }): Promise<StimulusInboxRecord | null> {
      const match = [...stimuli.values()]
        .filter(
          (stimulus) =>
            stimulus.sourceKind === input.sourceKind &&
            stimulus.dedupeKey === input.dedupeKey &&
            (!input.statuses || input.statuses.includes(stimulus.status)),
        )
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

      return Promise.resolve(match ? structuredClone(match) : null);
    },

    updateQueuedStimulus(input: {
      stimulusId: string;
      envelope: EnqueueStimulusInput['envelope'];
      signalType: string;
      dedupeKey?: string | null;
      aggregateHints?: Record<string, unknown>;
    }): Promise<StimulusInboxRecord | null> {
      const stimulus = stimuli.get(input.stimulusId);
      if (!stimulus || stimulus.status !== STIMULUS_STATUS.QUEUED) {
        return Promise.resolve(null);
      }

      const normalizedJson = normalizedStimulusSchema.parse({
        envelope: input.envelope,
        signalType: input.signalType,
        dedupeKey: input.dedupeKey ?? null,
        aggregateHints: input.aggregateHints ?? {},
      });

      stimulus.threadId = input.envelope.threadId ?? null;
      stimulus.occurredAt = input.envelope.occurredAt;
      stimulus.priority = input.envelope.priority;
      stimulus.priorityRank = getStimulusPriorityRank(input.envelope.priority);
      stimulus.requiresImmediateTick = input.envelope.requiresImmediateTick;
      stimulus.payloadJson = input.envelope.payload;
      stimulus.normalizedJson = normalizedJson;
      stimulus.dedupeKey = input.dedupeKey ?? null;
      stimulus.updatedAt = nowIso();

      return Promise.resolve(structuredClone(stimulus));
    },

    loadReadyStimuli(input?: { limit?: number }): Promise<StimulusInboxRecord[]> {
      return Promise.resolve(
        [...stimuli.values()]
          .filter((stimulus) => stimulus.status === STIMULUS_STATUS.QUEUED)
          .sort((left, right) => {
            const byImmediate =
              Number(right.requiresImmediateTick) - Number(left.requiresImmediateTick);
            if (byImmediate !== 0) return byImmediate;
            const byPriority = right.priorityRank - left.priorityRank;
            if (byPriority !== 0) return byPriority;
            const byOccurredAt = left.occurredAt.localeCompare(right.occurredAt);
            if (byOccurredAt !== 0) return byOccurredAt;
            return left.stimulusId.localeCompare(right.stimulusId);
          })
          .slice(0, input?.limit ?? 64)
          .map((stimulus) => structuredClone(stimulus)),
      );
    },

    claimStimuli(input: { tickId: string; stimulusIds: string[] }): Promise<StimulusInboxRecord[]> {
      const rows: StimulusInboxRecord[] = [];
      for (const stimulusId of input.stimulusIds) {
        const stimulus = stimuli.get(stimulusId);
        if (!stimulus || stimulus.status !== STIMULUS_STATUS.QUEUED) {
          continue;
        }

        stimulus.status = STIMULUS_STATUS.CLAIMED;
        stimulus.claimTickId = input.tickId;
        stimulus.updatedAt = nowIso();
        rows.push(structuredClone(stimulus));
      }
      return Promise.resolve(rows);
    },

    releaseClaimedStimuli(input: { tickId: string; stimulusIds?: string[] }): Promise<number> {
      let count = 0;
      for (const stimulus of stimuli.values()) {
        if (stimulus.claimTickId !== input.tickId || stimulus.status !== STIMULUS_STATUS.CLAIMED) {
          continue;
        }

        if (input.stimulusIds && !input.stimulusIds.includes(stimulus.stimulusId)) {
          continue;
        }

        stimulus.status = STIMULUS_STATUS.QUEUED;
        stimulus.claimTickId = null;
        stimulus.updatedAt = nowIso();
        count += 1;
      }
      return Promise.resolve(count);
    },

    countBacklog(): Promise<PerceptionBacklogCounts> {
      return Promise.resolve({
        queued: [...stimuli.values()].filter(
          (stimulus) => stimulus.status === STIMULUS_STATUS.QUEUED,
        ).length,
        claimed: [...stimuli.values()].filter(
          (stimulus) => stimulus.status === STIMULUS_STATUS.CLAIMED,
        ).length,
        consumed: [...stimuli.values()].filter(
          (stimulus) => stimulus.status === STIMULUS_STATUS.CONSUMED,
        ).length,
        dropped: [...stimuli.values()].filter(
          (stimulus) => stimulus.status === STIMULUS_STATUS.DROPPED,
        ).length,
      });
    },

    attachTickPerceptionClaim(input: { tickId: string; claim: PerceptionBatch }): Promise<void> {
      tickClaims.set(input.tickId, structuredClone(input.claim));
      return Promise.resolve();
    },
  };

  return {
    store,
    stimuli,
    tickClaims,
  };
}
