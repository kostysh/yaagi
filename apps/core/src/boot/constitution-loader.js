import { readFile } from "node:fs/promises";

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseScalar = (value) => stripQuotes(value);

const parseSimpleYaml = (text) => {
  const result = {};
  let currentListKey = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch && currentListKey) {
      if (!Array.isArray(result[currentListKey])) {
        result[currentListKey] = [];
      }
      result[currentListKey].push(parseScalar(listMatch[1]));
      continue;
    }

    const keyValue = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValue) continue;

    const [, key, value] = keyValue;
    if (value === "") {
      currentListKey = key;
      result[key] = [];
      continue;
    }

    currentListKey = null;
    result[key] = parseScalar(value);
  }

  return result;
};

export async function loadConstitution(constitutionPath) {
  const text = await readFile(constitutionPath, "utf8");
  const parsed = parseSimpleYaml(text);

  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`constitution file ${constitutionPath} is missing a version`);
  }

  if (typeof parsed.schemaVersion !== "string" || parsed.schemaVersion.length === 0) {
    throw new Error(`constitution file ${constitutionPath} is missing schemaVersion`);
  }

  return {
    version: parsed.version,
    schemaVersion: parsed.schemaVersion,
    requiredVolumes: Array.isArray(parsed.requiredVolumes) ? parsed.requiredVolumes : [],
    allowedDegradedDependencies: Array.isArray(parsed.allowedDegradedDependencies)
      ? parsed.allowedDegradedDependencies
      : [],
  };
}
