import { ROUNDS, TREATMENTS } from "../../data/contract.ts";
import type { ObservationYear, Treatment } from "../../data/index.ts";
import { hasKeys, isObject, requireSimulation } from "./errors.ts";
import type { Selection, SingleTrialRequest } from "./types.ts";

function values<T extends string | number>(value: unknown, allowed: readonly T[], field: string): T[] {
  requireSimulation(Array.isArray(value) && value.length > 0, "INVALID_SELECTION", "selection", `${field}: expected nonempty array`);
  const result: T[] = [];
  for (const item of value) {
    requireSimulation(allowed.includes(item), "INVALID_SELECTION", "selection", `${field}: unsupported value ${String(item)}`);
    requireSimulation(!result.includes(item), "INVALID_SELECTION", "selection", `${field}: duplicate value ${String(item)}`);
    result.push(item);
  }
  return result.sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
}

export function normalizeSelection(input: unknown): Selection {
  requireSimulation(isObject(input) && hasKeys(input, ["years", "plot_ids", "treatments", "rounds_by_year"]), "INVALID_SELECTION", "selection", "expected exactly years, plot_ids, treatments, rounds_by_year");
  const years = values<ObservationYear>(input.years, [2014, 2015], "years");
  const plots = Array.from({ length: 24 }, (_, i) => String(i + 1));
  const plot_ids = values(input.plot_ids, plots, "plot_ids");
  const treatments = values<Treatment>(input.treatments, TREATMENTS, "treatments");
  requireSimulation(isObject(input.rounds_by_year) && hasKeys(input.rounds_by_year, years.map(String)), "INVALID_SELECTION", "selection", "rounds_by_year: keys must exactly match selected years");
  const rounds_by_year: Partial<Record<ObservationYear, readonly string[]>> = {};
  for (const year of years) rounds_by_year[year] = values(input.rounds_by_year[year], ROUNDS[year], `rounds_by_year.${year}`);
  return { years, plot_ids, treatments, rounds_by_year };
}

export function validateRate(value: unknown): asserts value is number {
  requireSimulation(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100, "INVALID_RATE", "sampling", "rate_percent must be an integer in 0..100");
}
export function validateSeed(value: unknown): asserts value is number {
  requireSimulation(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295, "INVALID_SEED", "randomness", "master_seed must be an integer in 0..4294967295");
}
export function validateTrialIndex(value: unknown): asserts value is number {
  requireSimulation(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999, "INVALID_TRIAL_INDEX", "randomness", "trial_index must be an integer in 0..999");
}
export function normalizeRequest(input: unknown): SingleTrialRequest {
  requireSimulation(isObject(input), "INVALID_SELECTION", "request", "expected single-trial request object");
  if (Object.hasOwn(input, "trial_index")) requireSimulation(false, "INVALID_TRIAL_INDEX", "request", "single_trial always uses t=0; use the lower-level trial function for an individual t");
  requireSimulation(hasKeys(input, ["selection", "rate_percent", "master_seed"]), "INVALID_SELECTION", "request", "expected exactly selection, rate_percent, master_seed; repetitions are outside phase 6");
  const selection = normalizeSelection(input.selection);
  validateRate(input.rate_percent);
  validateSeed(input.master_seed);
  return { selection, rate_percent: input.rate_percent, master_seed: input.master_seed };
}
