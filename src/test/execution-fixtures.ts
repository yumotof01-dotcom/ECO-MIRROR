import halfJson from "../../docs/simulation/phase7-verification/half-result.json";
import provenanceJson from "../../docs/simulation/phase7-verification/half-provenance.json";
import type { RunResult } from "../features/simulation/core/types";
import type { BrowserMetadata } from "../features/execution/metadata";
import type { ExecutionInput, ReadyPayload } from "../features/execution/protocol";

// Actual historical result and its historical committed code hashes, for boundary tests only.
export const historicalResult = halfJson as unknown as RunResult;
export const historicalMetadata: BrowserMetadata = {
  version: 1, verification: "verified", reason: null,
  context: { implementation_git_revision: historicalResult.implementation_git_revision, specification_sha256: historicalResult.specification_sha256, data_identity: historicalResult.data_identity },
  code_input_sha256: provenanceJson.code_input_sha256, data_provenance_sha256: provenanceJson.data_provenance_sha256,
  application_git_revision: historicalResult.implementation_git_revision, application_input_sha256: provenanceJson.code_input_sha256,
};
export const historicalInput = { mode: "repeated_trials", request: { selection: historicalResult.selection, rate_percent: 50, master_seed: 42, repetitions: 3 } } satisfies ExecutionInput;
export function historicalPayload(): ReadyPayload {
  const { trials, ...header } = structuredClone(historicalResult);
  return { header, trial: trials[0], distribution: trials.map(t => ({ trial_index: t.trial_index, pair_count: t.sample.pair_count, pair_retention_pct: t.pair_retention_pct! })), metadata: historicalMetadata, calculation_ms: 0, ui_payload_bytes: 0 };
}
