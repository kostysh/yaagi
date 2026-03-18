import {
  DEPENDENCY,
  DEFAULT_DEPENDENCY_ORDER,
  STARTUP_MODE,
  type DependencyCheckResult,
  type DependencyId,
  type DependencyProbeResult,
  type StartupMode,
} from "@yaagi/contracts/boot";

export type DependencyProbe = () => Promise<DependencyProbeResult>;
export type DependencyProbeMap = Partial<Record<DependencyId, DependencyProbe>>;

const toDetail = (value: unknown): string | undefined => {
  if (value instanceof Error) return value.message;
  return typeof value === "string" ? value : undefined;
};

const createDependencyResult = ({
  dependency,
  ok,
  requiredForNormal,
  detail,
}: {
  dependency: DependencyId;
  ok: boolean;
  requiredForNormal: boolean;
  detail?: string;
}): DependencyCheckResult => ({
  dependency,
  ok,
  requiredForNormal,
  ...(detail ? { detail } : {}),
});

export async function runDependencyProbes({
  dependencyProbes,
  dependencyOrder = DEFAULT_DEPENDENCY_ORDER,
}: {
  dependencyProbes: DependencyProbeMap;
  dependencyOrder?: readonly DependencyId[];
}): Promise<DependencyCheckResult[]> {
  const results: DependencyCheckResult[] = [];

  for (const dependency of dependencyOrder) {
    const probe = dependencyProbes[dependency];
    if (typeof probe !== "function") {
      results.push(createDependencyResult({
        dependency,
        ok: false,
        requiredForNormal: true,
        detail: "missing dependency probe",
      }));
      continue;
    }

    try {
      const result = await probe();
      const detail = toDetail(result.detail);
      results.push(createDependencyResult({
        dependency,
        ok: result.ok === true,
        requiredForNormal: true,
        ...(detail ? { detail } : {}),
      }));
    } catch (error) {
      const detail = toDetail(error);
      results.push(createDependencyResult({
        dependency,
        ok: false,
        requiredForNormal: true,
        ...(detail ? { detail } : {}),
      }));
    }
  }

  return results;
}

export function selectStartupMode({
  dependencyResults,
  allowedDegradedDependencies = [],
}: {
  dependencyResults: DependencyCheckResult[];
  allowedDegradedDependencies?: readonly string[];
}): {
  selectedMode: StartupMode;
  degradedDependencies: DependencyId[];
} {
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
