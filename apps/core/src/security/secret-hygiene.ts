import type { CoreRuntimeConfig } from '../platform/core-config.ts';

type SecretScanMatch = {
  path: string;
  reason: string;
};

export type SecretHygieneGuardOptions = {
  explicitSecretValues?: string[];
};

const SENSITIVE_KEY_PATTERNS = [
  /(?:^|[_-])(secret|token|password|api[_-]?key|bot[_-]?token)(?:$|[_-])/i,
];

const normalizeSecretValues = (values: Array<string | null | undefined>): string[] => [
  ...new Set(values.map((value) => value?.trim() ?? '').filter((value) => value.length > 0)),
];

const shouldInspectKey = (key: string): boolean =>
  SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

const inspectValue = (
  value: unknown,
  path: string,
  secretValues: string[],
  matches: SecretScanMatch[],
): void => {
  if (typeof value === 'string') {
    for (const secretValue of secretValues) {
      if (secretValue.length > 0 && value.includes(secretValue)) {
        matches.push({
          path,
          reason: 'payload contains configured secret material',
        });
        return;
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      inspectValue(entry, `${path}[${index}]`, secretValues, matches);
    });
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    if (shouldInspectKey(key) && typeof entryValue === 'string' && entryValue.trim().length > 0) {
      matches.push({
        path: entryPath,
        reason: 'payload uses a forbidden secret-bearing field',
      });
      continue;
    }

    inspectValue(entryValue, entryPath, secretValues, matches);
  }
};

export const createSecretHygieneGuard = (
  config: Pick<CoreRuntimeConfig, 'telegramBotToken'>,
  options: SecretHygieneGuardOptions = {},
) => {
  const secretValues = normalizeSecretValues([
    config.telegramBotToken,
    ...(options.explicitSecretValues ?? []),
  ]);

  return (payload: unknown, surface: string): void => {
    const matches: SecretScanMatch[] = [];
    inspectValue(payload, '$', secretValues, matches);
    if (matches.length === 0) {
      return;
    }

    const [firstMatch] = matches;
    throw new Error(
      `${surface} failed secret hygiene at ${firstMatch?.path ?? '$'}: ${firstMatch?.reason ?? 'unknown secret-bearing payload'}`,
    );
  };
};
