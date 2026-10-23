import { loadObservationData } from "../data/index.ts";
import { runSingleTrial, runRepeatedTrials } from "./core/index.ts";
import type { RunContext, SingleTrialRequest, RepeatedTrialRequest } from "./core/index.ts";
import { sha256Text } from "./hash.ts";

/** Headless entry only. No page, provider or enabled button imports this module. */
export async function runObservationSimulation(request: SingleTrialRequest, context: RunContext) {
  const data = await loadObservationData();
  return runSingleTrial(data, request, context, sha256Text);
}

export async function runRepeatedObservationSimulation(request: RepeatedTrialRequest, context: RunContext) {
  return runRepeatedTrials(await loadObservationData(), request, context, sha256Text);
}
