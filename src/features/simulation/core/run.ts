import type { ObservationData } from "../../data/index.ts";
import { validateObservationData } from "../../data/validate.ts";
import { validateContext } from "./context.ts";
import { validateEventSequence } from "./events.ts";
import { requireSimulation } from "./errors.ts";
import { fraction } from "./fraction.ts";
import { normalizeRequest } from "./inputs.ts";
import { selectScope } from "./scope.ts";
import { canonicalJson, digestText } from "./serialization.ts";
import { simulateTrial } from "./trial.ts";
import type { RunContext, RunResult, Sha256 } from "./types.ts";

/** Full-source public core. Copy before phase-4 validation/freezing to leave caller input unchanged. */
export async function runSingleTrial(data: ObservationData, requestInput: unknown, context: RunContext, sha256: Sha256): Promise<RunResult> {
  validateEventSequence(data.dataset.events, "full-source");
  requireSimulation(data.dataset.events.length === 3882 && data.dataset.events.every((event, i) => event.source_record_number === i + 1), "SOURCE_ORDER", "full-source", "expected every original record 1..3882, without gaps");
  const validated = validateObservationData(structuredClone(data.dataset), structuredClone(data.taxa));
  const request = normalizeRequest(requestInput); // Also validated when the eventual scope is empty.
  validateContext(context);
  // Snapshot caller-owned metadata before awaiting hashes.
  const metadata = structuredClone(context);
  // Phase 4's fixed-property-order format, distinct from the result's canonical format.
  // Audit totals alone cannot detect, for example, a changed Treatment with the same counts.
  for (const [name, value, expected] of [
    ["events.json", validated.dataset, metadata.data_identity.normalized_events_sha256],
    ["taxa.json", validated.taxa, metadata.data_identity.taxa_sha256],
  ] as const) {
    const actual = await digestText(`${JSON.stringify(value, null, 2)}\n`, sha256);
    requireSimulation(actual === expected, "INVALID_CONTEXT", "full-source", `${name}: full snapshot differs from the verified phase-4 artifact; use loadObservationData() without changing data or its fixed serialization`);
  }
  const selected = await selectScope(validated.dataset.events, request.selection, sha256);
  const N = selected.events.length;
  const result = N > 0 ? await simulateTrial(selected.events, request.rate_percent, request.master_seed, 0, sha256) : null;
  const k = result?.trial.sample.event_count ?? null;
  const body: RunResult = {
    result_schema_version: "1.0.0",
    specification_versions: { model: "1.0.0", metrics: "1.0.0", randomness: "1.0.0", repetitions: "1.0.0", serialization: "1.0.0" },
    ...metadata,
    selection: selected.selection, scope: selected.scope,
    sampling: {
      unit: "event", replacement: false, algorithm: "partial-fisher-yates-forward", rounding: "nearest-half-up",
      rate_percent: request.rate_percent, eligible_record_count: N, sample_record_count: k,
      actual_record_pct: k === null ? null : fraction(100n * BigInt(k), BigInt(N)),
    },
    randomness: { algorithm: "pcg-xsh-rr-64-32", master_seed: request.master_seed, stream_offset: 54 },
    execution_mode: "single_trial", requested_repetitions: 1, status: result ? "success" : "empty_scope",
    reference: result?.reference ?? null, trials: result ? [result.trial] : [], summary: null,
    summary_reason: result ? "repetition_not_requested" : "empty_scope",
  };
  canonicalJson(body); // Refuse non-JSON numeric values before claiming a successful result.
  return body;
}
