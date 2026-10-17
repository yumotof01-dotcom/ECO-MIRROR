import { compareNetworks } from "./network.ts";
import { requireSimulation } from "./errors.ts";
import { sampleEvents } from "./sampling.ts";
import { u64Hex } from "./pcg32.ts";
import { idsHash } from "./serialization.ts";
import type { CoreEvent, Sha256, TrialResult } from "./types.ts";

/** One trial only; t is explicit so phase 7 can later reuse this without global RNG. */
export async function simulateTrial(events: readonly CoreEvent[], ratePercent: number, masterSeed: number, trialIndex: number, sha256: Sha256) {
  const selected = sampleEvents(events, ratePercent, masterSeed, trialIndex);
  requireSimulation(events.length > 0, "INVALID_NUMERIC_RESULT", "trial", `trial ${trialIndex}: empty scope has no trial; use the run API to obtain empty_scope`);
  const metrics = compareNetworks(events, selected.events);
  const trial: TrialResult = {
    trial_index: trialIndex, initstate_u64_hex: u64Hex(BigInt(masterSeed)), initseq_u64_hex: u64Hex(BigInt(54 + trialIndex)),
    random_word_count: selected.random_word_count,
    sampled_source_record_numbers: selected.events.map(e => e.source_record_number),
    sampled_ids_sha256: await idsHash(selected.events.map(e => e.record_id), sha256),
    sample: metrics.sample, lost_pair_count: metrics.lost_pair_count,
    pair_retention_pct: metrics.pair_retention_pct, undefined_reasons: metrics.undefined_reasons,
  };
  return { reference: metrics.reference, trial };
}
