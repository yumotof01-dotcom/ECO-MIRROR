import { loadObservationData } from "../data/index.ts";
import { runSingleTrial } from "./core/index.ts";
import type { RunContext, SingleTrialRequest } from "./core/index.ts";
import { sha256Text } from "./hash.ts";

/** Headless entry only. No page, provider or enabled button imports this module. */
export async function runObservationSimulation(request: SingleTrialRequest, context: RunContext) {
  const data = await loadObservationData();
  return runSingleTrial(data, request, context, sha256Text);
}
