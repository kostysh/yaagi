import {
  ADAPTER_HEALTH_STATUS,
  SENSOR_SOURCE,
  STIMULUS_PRIORITY,
  type AdapterHealthSnapshot,
} from '@yaagi/contracts/perception';
import {
  createAdapterSnapshot,
  type AdapterStatusReporter,
  type SensorAdapterRuntime,
  type SensorEmitter,
} from './adapters.ts';

type TelegramUpdate = {
  update_id: number;
  message?: {
    date?: number;
    message_id?: number;
    text?: string;
    chat?: {
      id?: number;
      type?: string;
    };
    from?: {
      id?: number;
      username?: string;
    };
  };
};

const DEFAULT_TELEGRAM_POLL_TIMEOUT_SECONDS = 1;

const buildTelegramUrl = (baseUrl: string, botToken: string, method: string): URL =>
  new URL(`bot${botToken}/${method}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

export function createTelegramAdapter(options: {
  enabled: boolean;
  botToken: string | null;
  allowedChatIds: string[];
  apiBaseUrl: string;
  emitSignal: SensorEmitter;
  reportStatus: AdapterStatusReporter;
  now?: () => string;
  pollTimeoutSeconds?: number;
}): SensorAdapterRuntime {
  const now = options.now ?? (() => new Date().toISOString());
  const allowedChatIds = new Set(options.allowedChatIds);
  const pollTimeoutSeconds = options.pollTimeoutSeconds ?? DEFAULT_TELEGRAM_POLL_TIMEOUT_SECONDS;

  let running = false;
  let pollController: AbortController | null = null;
  let offset = 0;
  let snapshot: AdapterHealthSnapshot = createAdapterSnapshot(
    SENSOR_SOURCE.TELEGRAM,
    options.enabled ? ADAPTER_HEALTH_STATUS.HEALTHY : ADAPTER_HEALTH_STATUS.DISABLED,
  );

  const pollOnce = async (): Promise<void> => {
    if (!options.enabled || !options.botToken) {
      return;
    }

    const endpoint = buildTelegramUrl(options.apiBaseUrl, options.botToken, 'getUpdates');
    endpoint.searchParams.set('timeout', String(pollTimeoutSeconds));
    endpoint.searchParams.set('offset', String(offset));

    pollController = new AbortController();

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: pollController.signal,
    });
    if (!response.ok) {
      throw new Error(`telegram getUpdates failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      ok: boolean;
      result?: TelegramUpdate[];
    };

    if (!payload.ok || !Array.isArray(payload.result)) {
      throw new Error('telegram getUpdates returned an invalid payload');
    }

    for (const update of payload.result) {
      const chatId = update.message?.chat?.id;
      if (typeof chatId !== 'number') {
        offset = Math.max(offset, update.update_id + 1);
        continue;
      }

      const chatIdKey = String(chatId);
      offset = Math.max(offset, update.update_id + 1);
      if (!allowedChatIds.has(chatIdKey)) {
        continue;
      }

      const occurredAt =
        typeof update.message?.date === 'number'
          ? new Date(update.message.date * 1000).toISOString()
          : now();

      await options.emitSignal({
        source: SENSOR_SOURCE.TELEGRAM,
        signalType: 'telegram.message',
        occurredAt,
        priority: STIMULUS_PRIORITY.HIGH,
        requiresImmediateTick: true,
        threadId: chatIdKey,
        payload: {
          updateId: update.update_id,
          messageId: update.message?.message_id ?? null,
          chatId: chatIdKey,
          text: update.message?.text ?? '',
          chatType: update.message?.chat?.type ?? null,
          fromId: update.message?.from?.id ?? null,
          fromUsername: update.message?.from?.username ?? null,
        },
        dedupeKey: `telegram:update:${update.update_id}`,
      });

      snapshot = {
        source: SENSOR_SOURCE.TELEGRAM,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
        lastSignalAt: occurredAt,
      };
      options.reportStatus(snapshot);
    }
  };

  const loop = async (): Promise<void> => {
    while (running) {
      try {
        await pollOnce();
        snapshot = {
          ...snapshot,
          status: ADAPTER_HEALTH_STATUS.HEALTHY,
        };
        options.reportStatus(snapshot);
      } catch (error) {
        if (!running) {
          break;
        }

        snapshot = {
          source: SENSOR_SOURCE.TELEGRAM,
          status: ADAPTER_HEALTH_STATUS.DEGRADED,
          detail: error instanceof Error ? error.message : String(error),
          lastSignalAt: snapshot.lastSignalAt ?? null,
        };
        options.reportStatus(snapshot);

        await new Promise((resolve) => setTimeout(resolve, 250));
      } finally {
        pollController = null;
      }
    }
  };

  return {
    source: SENSOR_SOURCE.TELEGRAM,

    start(): Promise<void> {
      if (!options.enabled) {
        snapshot = createAdapterSnapshot(SENSOR_SOURCE.TELEGRAM, ADAPTER_HEALTH_STATUS.DISABLED);
        options.reportStatus(snapshot);
        return Promise.resolve();
      }

      if (running) {
        return Promise.resolve();
      }

      running = true;
      snapshot = {
        source: SENSOR_SOURCE.TELEGRAM,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
      };
      options.reportStatus(snapshot);
      void loop();
      return Promise.resolve();
    },

    stop(): Promise<void> {
      running = false;
      pollController?.abort();
      pollController = null;
      snapshot = createAdapterSnapshot(
        SENSOR_SOURCE.TELEGRAM,
        options.enabled ? ADAPTER_HEALTH_STATUS.DISABLED : ADAPTER_HEALTH_STATUS.DISABLED,
      );
      options.reportStatus(snapshot);
      return Promise.resolve();
    },

    snapshot(): AdapterHealthSnapshot {
      return snapshot;
    },
  };
}
