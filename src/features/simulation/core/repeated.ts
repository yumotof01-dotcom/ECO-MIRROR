import type { ObservationData } from "../../data/index.ts";
import { hasKeys, isObject, requireSimulation } from "./errors.ts";
import { normalizeRequest, validateRate, validateSeed } from "./inputs.ts";
import { validateEventSequence } from "./events.ts";
import { runSingleTrial } from "./run.ts";
import { selectScope } from "./scope.ts";
import { sampleSize } from "./sampling.ts";
import { simulateTrial } from "./trial.ts";
import { summarizeTrials } from "./statistics.ts";
import type { CoreEvent, NetworkSummary, RepeatedRunResult, RepeatedTrialRequest, RunContext, Sha256, TrialResult } from "./types.ts";

export const DEFAULT_REPETITIONS = 100;
export function validateRepetitions(value: unknown): asserts value is number {
  requireSimulation(typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 1000, "INVALID_REPETITIONS", "repetitions", "repetitions must be an integer in 1..1000");
}
export function normalizeRepeatedRequest(input: unknown): RepeatedTrialRequest {
  requireSimulation(isObject(input), "INVALID_SELECTION", "request", "expected repeated-trial request");
  validateRepetitions(input.repetitions);
  requireSimulation(hasKeys(input, ["selection", "rate_percent", "master_seed", "repetitions"]), "INVALID_SELECTION", "request", "expected exactly selection, rate_percent, master_seed, repetitions");
  const request = normalizeRequest({ selection: input.selection, rate_percent: input.rate_percent, master_seed: input.master_seed });
  return { ...request, repetitions: input.repetitions };
}
async function collect(events: readonly CoreEvent[], p: number, seed: number, R: number, sha256: Sha256, first?: { reference: NetworkSummary; trial: TrialResult }) {
  const k = sampleSize(events.length, p);
  const initial = first ?? await simulateTrial(events, p, seed, 0, sha256);
  const trials = [initial.trial];
  for (let t = 1; t < R; t++) {
    // Same D and a new instance for (seed, 54+t), never a previous sample/global stream.
    const next = await simulateTrial(events, p, seed, t, sha256);
    requireSimulation(next.trial.sample.event_count === k, "INVALID_NUMERIC_RESULT", "repetitions", `trial ${t}: sample size changed`);
    trials.push(next.trial); // Repeated outcomes are retained, not retried/deduplicated.
  }
  return { reference: initial.reference, trials, summary: summarizeTrials(trials) };
}
/** Lower-level positive scope only; synthetic fixtures never enter the real-data loader. */
export async function simulateRepetitions(events: readonly CoreEvent[], p: number, seed: number, repetitions: number, sha256: Sha256) {
  validateEventSequence(events); validateRate(p); validateSeed(seed); validateRepetitions(repetitions);
  requireSimulation(events.length > 0, "INVALID_NUMERIC_RESULT", "repetitions", "empty source has no trials; use runRepeatedTrials for empty_scope");
  return collect(events, p, seed, repetitions, sha256);
}
/** Headless full-source mode. Phase-6 verification and t=0 are reused without altered mathematics. */
export async function runRepeatedTrials(data: ObservationData, input: unknown, context: RunContext, sha256: Sha256): Promise<RepeatedRunResult> {
  const request = normalizeRepeatedRequest(input);
  // Snapshot before any await; callers cannot change D while another trial is running.
  const source = structuredClone(data), metadata = structuredClone(context);
  const first = await runSingleTrial(source, { selection: request.selection, rate_percent: request.rate_percent, master_seed: request.master_seed }, metadata, sha256);
  if (first.status === "empty_scope") {
    return { ...first, execution_mode: "repeated_trials", requested_repetitions: request.repetitions, summary: null, summary_reason: "empty_scope" };
  }
  const selected = await selectScope(source.dataset.events, request.selection, sha256);
  requireSimulation(selected.scope.eligible_ids_sha256 === first.scope.eligible_ids_sha256 && first.reference !== null, "INVALID_NUMERIC_RESULT", "repetitions", "reference scope changed");
  const computed = await collect(selected.events, request.rate_percent, request.master_seed, request.repetitions, sha256, { reference: first.reference, trial: first.trials[0] });
  const body: RepeatedRunResult = { ...first, execution_mode: "repeated_trials", requested_repetitions: request.repetitions, ...computed, summary_reason: null };
  return body;
}
