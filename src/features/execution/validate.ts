import { validateContext } from "../simulation/core/context";
import { canonicalJson, idsHash } from "../simulation/core/serialization";
import { fraction, validateFraction } from "../simulation/core/fraction";
import { summarizeTrials } from "../simulation/core/statistics";
import { adaptNetworkTrialView } from "../visualization/adapter";
import type { RunContext, RunResult, Sha256 } from "../simulation/core/types";
import type { ExecutionInput } from "./protocol";
import { normalizeExecutionInput } from "./input";
import { hasKeys, isObject } from "../simulation/core/errors";

function check(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`RESULT_VALIDATION: ${reason}`);
}
function shape(value: unknown, keys: readonly string[], name: string) { check(isObject(value) && hasKeys(value, [...keys]), `${name}: unexpected/missing contract keys`); }

/** Validates only complete real-core results, never treats a display fragment as one. */
export async function validateCompletedResult(result: RunResult, input: ExecutionInput, context: RunContext, sha256: Sha256): Promise<void> {
  validateContext(context);
  const normalized = normalizeExecutionInput(input), request = normalized.request;
  check(result && result.result_schema_version === "1.0.0", "unsupported schema");
  shape(result, ["result_schema_version", "specification_versions", "implementation_git_revision", "specification_sha256", "data_identity", "selection", "scope", "sampling", "randomness", "execution_mode", "requested_repetitions", "status", "reference", "trials", "summary", "summary_reason"], "result");
  shape(result.scope, ["scope_mode", "eligible_source_record_numbers", "eligible_ids_sha256", "records_by_year", "plot_year_count", "observation_group_count", "no_record_groups"], "scope");
  shape(result.sampling, ["unit", "replacement", "algorithm", "rounding", "rate_percent", "eligible_record_count", "sample_record_count", "actual_record_pct"], "sampling");
  shape(result.randomness, ["algorithm", "master_seed", "stream_offset"], "randomness");
  for (const field of ["implementation_git_revision", "specification_sha256", "data_identity"] as const) check(canonicalJson(result[field]) === canonicalJson(context[field]), `${field} differs from verified context`);
  check(canonicalJson(result.selection) === canonicalJson(request.selection) && result.sampling.rate_percent === request.rate_percent && result.randomness.master_seed === request.master_seed, "result/input mismatch");
  check(result.execution_mode === normalized.mode && result.requested_repetitions === (normalized.mode === "repeated_trials" ? normalized.request.repetitions : 1), "execution mode/repetition mismatch");
  check(Object.values(result.specification_versions).every(v => v === "1.0.0") && Object.keys(result.specification_versions).sort().join(",") === "metrics,model,randomness,repetitions,serialization", "specification versions differ");
  check(result.sampling.unit === "event" && result.sampling.replacement === false && result.sampling.algorithm === "partial-fisher-yates-forward" && result.sampling.rounding === "nearest-half-up" && result.randomness.algorithm === "pcg-xsh-rr-64-32" && result.randomness.stream_offset === 54, "sampling contract differs");
  const eligible = result.scope.eligible_source_record_numbers;
  check(Array.isArray(eligible) && eligible.length === result.sampling.eligible_record_count, "scope size differs");
  check(eligible.every((n, i) => Number.isSafeInteger(n) && n >= 1 && n <= 3882 && (i === 0 || n > eligible[i - 1])), "invalid original source numbers");
  const recordId = (n: number) => `sha256:${context.data_identity.source_sha256}:record:${n}`;
  check(await idsHash(eligible.map(recordId), sha256) === result.scope.eligible_ids_sha256, "scope hash differs");
  if (result.status === "empty_scope") {
    check(eligible.length === 0 && result.reference === null && result.trials.length === 0 && result.summary === null && result.summary_reason === "empty_scope" && result.sampling.sample_record_count === null && result.sampling.actual_record_pct === null, "invalid empty_scope");
    return;
  }
  check(result.status === "success" && result.reference && eligible.length > 0, "invalid success");
  const inspectShape = (network: NonNullable<RunResult["reference"]>) => {
    shape(network, ["event_count", "plant_label_count", "visitor_label_count", "pair_count", "connectance_fixed", "plant_partner_counts", "visitor_partner_counts", "pair_weights", "undefined_reasons"], "network");
    shape(network.undefined_reasons, [], "network reasons");
    for (const node of [...network.plant_partner_counts, ...network.visitor_partner_counts]) shape(node, ["label_id", "partner_count"], "partner count");
    for (const pair of network.pair_weights) shape(pair, ["plant_label_id", "visitor_label_id", "record_count"], "pair weight");
  };
  inspectShape(result.reference); validateFraction(result.reference.connectance_fixed);
  check(canonicalJson(result.reference.connectance_fixed) === canonicalJson(fraction(BigInt(result.reference.pair_count), BigInt(result.reference.plant_label_count * result.reference.visitor_label_count))), "reference connectance differs");
  check(result.trials.length === result.requested_repetitions, "incomplete trials");
  const allowed = new Set(eligible), k = result.sampling.sample_record_count;
  check(typeof k === "number" && k === Math.floor((eligible.length * request.rate_percent + 50) / 100), "sample count differs");
  validateFraction(result.sampling.actual_record_pct);
  check(canonicalJson(result.sampling.actual_record_pct) === canonicalJson(fraction(100n * BigInt(k), BigInt(eligible.length))), "actual record percentage differs");
  for (let i = 0; i < result.trials.length; i++) {
    const trial = result.trials[i];
    check(trial?.trial_index === i, "trial order differs");
    shape(trial, ["trial_index", "initstate_u64_hex", "initseq_u64_hex", "random_word_count", "sampled_source_record_numbers", "sampled_ids_sha256", "sample", "lost_pair_count", "pair_retention_pct", "undefined_reasons"], "trial");
    shape(trial.undefined_reasons, [], "trial reasons"); inspectShape(trial.sample);
    adaptNetworkTrialView({ kind: "network_trial_view", header: result, trial }, i);
    const numbers = trial.sampled_source_record_numbers;
    check(numbers.length === k && numbers.every((n, j) => allowed.has(n) && (j === 0 || n > numbers[j - 1])), `trial ${i}: original IDs are not a distinct ordered subset`);
    check(await idsHash(numbers.map(recordId), sha256) === trial.sampled_ids_sha256, `trial ${i}: sampled ID hash differs`);
    check(trial.initstate_u64_hex === BigInt(request.master_seed).toString(16).padStart(16, "0") && trial.initseq_u64_hex === BigInt(54 + i).toString(16).padStart(16, "0"), `trial ${i}: seed stream differs`);
    check(Number.isSafeInteger(trial.random_word_count) && ((k === 0 || k === eligible.length) ? trial.random_word_count === 0 : trial.random_word_count >= k), `trial ${i}: random word count differs`);
    validateFraction(trial.pair_retention_pct); validateFraction(trial.sample.connectance_fixed);
    check(canonicalJson(trial.pair_retention_pct) === canonicalJson(fraction(100n * BigInt(trial.sample.pair_count), BigInt(result.reference.pair_count))), `trial ${i}: retention differs`);
    check(canonicalJson(trial.sample.connectance_fixed) === canonicalJson(fraction(BigInt(trial.sample.pair_count), BigInt(result.reference.plant_label_count * result.reference.visitor_label_count))), `trial ${i}: connectance differs`);
  }
  if (result.execution_mode === "repeated_trials") check(result.summary_reason === null && canonicalJson(result.summary) === canonicalJson(summarizeTrials(result.trials)), "summary differs from complete trials");
  else check(result.summary === null && result.summary_reason === "repetition_not_requested", "single mode must not have a repeated summary");
}
