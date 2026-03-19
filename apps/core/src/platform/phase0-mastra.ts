import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import type { CoreRuntimeConfig } from "./core-config.ts";

export const PHASE0_AGENT_KEY = "phase0DecisionAgent" as const;
const PHASE0_AGENT_ID = "phase0-decision-agent";

export function createPhase0Mastra(config: CoreRuntimeConfig): Mastra<{
  [PHASE0_AGENT_KEY]: Agent<typeof PHASE0_AGENT_ID>;
}> {
  const phase0DecisionAgent = new Agent({
    id: PHASE0_AGENT_ID,
    name: "Phase 0 Decision Agent",
    instructions: [
      "You are the bounded decision harness for the YAAGI phase-0 runtime.",
      "Operate conservatively, prefer deterministic summaries, and assume only the fast model organ is available.",
      "Do not claim capabilities that are not mounted into the current deployment cell.",
    ].join(" "),
    model: {
      id: "custom/phase-0-fast",
      url: config.fastModelBaseUrl,
    },
  });

  return new Mastra({
    agents: {
      [PHASE0_AGENT_KEY]: phase0DecisionAgent,
    },
  });
}
