import { DEPENDENCY, DEFAULT_DEPENDENCY_ORDER, STARTUP_MODE } from "@yaagi/contracts/boot";

const toDetail = (value) => {
  if (value instanceof Error) return value.message;
  return typeof value === "string" ? value : undefined;
};

export async function runDependencyProbes({
  dependencyProbes,
  dependencyOrder = DEFAULT_DEPENDENCY_ORDER,
}) {
  const results = [];

  for (const dependency of dependencyOrder) {
    const probe = dependencyProbes[dependency];
    if (typeof probe !== "function") {
      results.push({
        dependency,
        ok: false,
        requiredForNormal: true,
        detail: "missing dependency probe",
      });
      continue;
    }

    try {
      const result = await probe();
      results.push({
        dependency,
        ok: result?.ok === true,
        requiredForNormal: true,
        detail: toDetail(result?.detail),
      });
    } catch (error) {
      results.push({
        dependency,
        ok: false,
        requiredForNormal: true,
        detail: toDetail(error),
      });
    }
  }

  return results;
}

export function selectStartupMode({ dependencyResults, allowedDegradedDependencies = [] }) {
  const failedDependencies = dependencyResults.filter((dependency) => !dependency.ok);
  if (failedDependencies.length === 0) {
    return {
      selectedMode: STARTUP_MODE.NORMAL,
      degradedDependencies: [],
    };
  }

  if (failedDependencies.some((dependency) => dependency.dependency === DEPENDENCY.POSTGRES)) {
    return {
      selectedMode: STARTUP_MODE.RECOVERY,
      degradedDependencies: [],
    };
  }

  const failedNames = failedDependencies.map((dependency) => dependency.dependency);
  const allowed = new Set(allowedDegradedDependencies);

  if (failedNames.every((dependency) => allowed.has(dependency))) {
    return {
      selectedMode: STARTUP_MODE.DEGRADED,
      degradedDependencies: failedNames,
    };
  }

  return {
    selectedMode: STARTUP_MODE.RECOVERY,
    degradedDependencies: [],
  };
}
