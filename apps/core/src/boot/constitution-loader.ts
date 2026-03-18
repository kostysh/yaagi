import { readFile } from "node:fs/promises";

type ParsedYamlValue = string | string[];
type ParsedYaml = Record<string, ParsedYamlValue>;

const stripQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseScalar = (value: string): string => stripQuotes(value);

const parseSimpleYaml = (text: string): ParsedYaml => {
  const result: ParsedYaml = {};
  let currentListKey: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listMatch = trimmed.match(/^- (.+)$/);
    if (listMatch && typeof listMatch[1] === "string" && currentListKey) {
      const existingValue = result[currentListKey];
      if (!Array.isArray(existingValue)) {
        result[currentListKey] = [];
      }

      const listValue = result[currentListKey];
      if (Array.isArray(listValue)) {
        listValue.push(parseScalar(listMatch[1]));
      }
      continue;
    }

    const keyValue = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValue) continue;

    const key = keyValue[1];
    const value = keyValue[2];
    if (typeof key !== "string" || typeof value !== "string") continue;

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

export type ConstitutionConfig = {
  version: string;
  schemaVersion: string;
  requiredVolumes: string[];
  allowedDegradedDependencies: string[];
};

export async function loadConstitution(
  constitutionPath: string,
): Promise<ConstitutionConfig> {
  const text = await readFile(constitutionPath, "utf8");
  const parsed = parseSimpleYaml(text);

  if (typeof parsed["version"] !== "string" || parsed["version"].length === 0) {
    throw new Error(`constitution file ${constitutionPath} is missing a version`);
  }

  if (
    typeof parsed["schemaVersion"] !== "string" ||
    parsed["schemaVersion"].length === 0
  ) {
    throw new Error(`constitution file ${constitutionPath} is missing schemaVersion`);
  }

  return {
    version: parsed["version"],
    schemaVersion: parsed["schemaVersion"],
    requiredVolumes: Array.isArray(parsed["requiredVolumes"]) ? parsed["requiredVolumes"] : [],
    allowedDegradedDependencies: Array.isArray(parsed["allowedDegradedDependencies"])
      ? parsed["allowedDegradedDependencies"]
      : [],
  };
}
