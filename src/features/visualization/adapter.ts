import type { NetworkSummary, RunResult, TrialResult } from "../simulation/core/types";

export interface VisualNode {
  readonly id: string;
  readonly label: string;
  readonly side: "plant" | "visitor";
  readonly referencePartners: number;
  readonly samplePartners: number;
}
export interface VisualLink {
  readonly id: string;
  readonly plantId: string;
  readonly visitorId: string;
  readonly referenceCount: number;
  readonly sampleCount: number;
}
export interface ComparisonData {
  readonly status: "success";
  readonly nodes: readonly VisualNode[];
  readonly links: readonly VisualLink[];
  readonly reference: NetworkSummary;
  readonly trial: TrialResult;
  readonly trialIndices: readonly number[];
  readonly ratePercent: number;
  readonly datasetId: string;
  readonly archiveDoi: string;
}
export type ComparisonState = ComparisonData | { readonly status: "empty_scope" };
/** A named read-only fragment of a real result; not a synthetic shortened RunResult. */
export interface NetworkTrialView {
  readonly kind: "network_trial_view";
  readonly header: Omit<RunResult, "trials">;
  readonly trial: TrialResult;
}

function requireView(test: unknown, message: string): asserts test {
  if (!test) throw new Error(`INVALID_VISUALIZATION_RESULT: ${message}`);
}
const integer = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const key = (plant: string, visitor: string) => JSON.stringify([plant, visitor]);

/** Validate the graph boundary; never repair counts or invent nodes/edges. */
function inspect(network: NetworkSummary, reference?: NetworkSummary) {
  requireView(network && typeof network === "object", "network is missing");
  for (const count of [network.event_count, network.plant_label_count, network.visitor_label_count, network.pair_count]) {
    requireView(integer(count), "network counts must be nonnegative safe integers");
  }
  const degrees = new Map<string, number>();
  for (const side of ["plant", "visitor"] as const) {
    const nodes = network[`${side}_partner_counts`];
    requireView(Array.isArray(nodes), `${side} nodes are missing`);
    let previous = "";
    for (const node of nodes) {
      requireView(node && typeof node.label_id === "string" && node.label_id.startsWith(`${side}:`) && node.label_id.length > side.length + 1, "invalid raw label ID");
      requireView(node.label_id > previous && integer(node.partner_count), "nodes must be unique, ordered and have valid degrees");
      previous = node.label_id;
      degrees.set(node.label_id, 0);
    }
    if (reference) {
      requireView(nodes.length === reference[`${side}_partner_counts`].length && nodes.every((n, i) => n.label_id === reference[`${side}_partner_counts`][i].label_id), "sample must retain the reference node IDs/order");
    }
  }
  requireView(Array.isArray(network.pair_weights), "pair weights are missing");
  let total = 0, active = 0, previousPlant = "", previousVisitor = "";
  for (const [index, pair] of network.pair_weights.entries()) {
    requireView(pair && degrees.has(pair.plant_label_id) && pair.plant_label_id.startsWith("plant:") && degrees.has(pair.visitor_label_id) && pair.visitor_label_id.startsWith("visitor:"), "edge refers to an unknown node");
    requireView(pair.plant_label_id > previousPlant || (pair.plant_label_id === previousPlant && pair.visitor_label_id > previousVisitor), "pairs must be unique and in reference order");
    previousPlant = pair.plant_label_id; previousVisitor = pair.visitor_label_id;
    requireView(integer(pair.record_count) && (reference || pair.record_count > 0), "invalid record weight");
    if (reference) {
      const original = reference.pair_weights[index];
      requireView(original && key(pair.plant_label_id, pair.visitor_label_id) === key(original.plant_label_id, original.visitor_label_id) && pair.record_count <= original.record_count, "sample edge/weight is outside the reference");
    }
    total += pair.record_count;
    if (pair.record_count > 0) {
      active++;
      degrees.set(pair.plant_label_id, degrees.get(pair.plant_label_id)! + 1);
      degrees.set(pair.visitor_label_id, degrees.get(pair.visitor_label_id)! + 1);
    }
  }
  requireView(!reference || network.pair_weights.length === reference.pair_weights.length, "sample must retain every reference pair, including zero weights");
  requireView(total === network.event_count && active === network.pair_count, "edge weights/pair count disagree with metrics");
  for (const side of ["plant", "visitor"] as const) {
    const nodes = network[`${side}_partner_counts`];
    requireView(nodes.every(n => n.partner_count === degrees.get(n.label_id)), "partner counts disagree with edges");
    requireView(nodes.filter(n => n.partner_count > 0).length === network[`${side}_label_count`], "observed label count disagrees with edges");
  }
}

/** Only adapts an already computed RunResult. No data loading, PRNG or simulation. */
export function adaptRunResult(result: RunResult, trialIndex = 0): ComparisonState {
  requireView(result && result.result_schema_version === "1.0.0", "unsupported result schema");
  requireView(integer(trialIndex) && trialIndex <= 999, "trial index must be an integer in 0..999");
  requireView(Array.isArray(result.trials), "trials are missing");
  if (result.status === "empty_scope") {
    requireView(result.reference === null && result.trials.length === 0 && result.sampling.eligible_record_count === 0, "invalid empty_scope");
    return { status: "empty_scope" };
  }
  requireView(result.status === "success" && result.reference, "result has not succeeded");
  requireView(integer(result.requested_repetitions) && result.requested_repetitions >= 1 && result.requested_repetitions <= 1000 && result.trials.length === result.requested_repetitions, "missing trials");
  for (const [index, trial] of result.trials.entries()) requireView(trial && trial.trial_index === index, "trial order/index mismatch");
  const trial = result.trials[trialIndex];
  requireView(trial, "requested trial does not exist");
  return adaptNetworkTrialView({ kind: "network_trial_view", header: result, trial }, trialIndex);
}

export function adaptNetworkTrialView(view: NetworkTrialView, trialIndex: number): ComparisonState {
  const result = view.header, trial = view.trial;
  requireView(view.kind === "network_trial_view" && result.result_schema_version === "1.0.0" && result.status === "success" && result.reference, "invalid network fragment");
  requireView(integer(result.requested_repetitions) && result.requested_repetitions >= 1 && result.requested_repetitions <= 1000, "invalid trial count");
  requireView(integer(trialIndex) && trialIndex < result.requested_repetitions && trial.trial_index === trialIndex, "requested trial does not match fragment");
  inspect(result.reference); inspect(trial.sample, result.reference);
  requireView(result.reference.event_count > 0 && result.reference.event_count === result.sampling.eligible_record_count, "empty or inconsistent success scope");
  requireView(trial.sample.event_count === result.sampling.sample_record_count && trial.sample.event_count === trial.sampled_source_record_numbers.length, "sample size mismatch");
  requireView(trial.lost_pair_count === result.reference.pair_count - trial.sample.pair_count, "lost-pair metric disagrees with edges");
  requireView(typeof result.data_identity?.dataset_id === "string" && typeof result.data_identity.archive_doi === "string", "data identity is missing");
  const nodes: VisualNode[] = [];
  for (const side of ["plant", "visitor"] as const) {
    result.reference[`${side}_partner_counts`].forEach((node, i) => nodes.push({
      id: node.label_id, label: node.label_id.slice(side.length + 1), side,
      referencePartners: node.partner_count, samplePartners: trial.sample[`${side}_partner_counts`][i].partner_count,
    }));
  }
  return {
    status: "success", nodes,
    links: result.reference.pair_weights.map((pair, i) => ({ id: key(pair.plant_label_id, pair.visitor_label_id), plantId: pair.plant_label_id, visitorId: pair.visitor_label_id, referenceCount: pair.record_count, sampleCount: trial.sample.pair_weights[i].record_count })),
    reference: result.reference, trial, trialIndices: Array.from({ length: result.requested_repetitions }, (_, i) => i),
    ratePercent: result.sampling.rate_percent, datasetId: result.data_identity.dataset_id, archiveDoi: result.data_identity.archive_doi,
  };
}
