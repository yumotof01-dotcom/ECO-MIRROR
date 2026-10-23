import { asciiCompare, requireSimulation } from "./errors.ts";
import { validateSubset } from "./events.ts";
import { fraction } from "./fraction.ts";
import type { CoreEvent, NetworkSummary, PairWeight } from "./types.ts";

// Nested maps preserve the ordered pair without delimiter parsing/collisions.
function weights(events: readonly CoreEvent[]) {
  const result = new Map<string, Map<string, number>>();
  for (const event of events) {
    const row = result.get(event.plant_label_id) ?? new Map<string, number>();
    row.set(event.visitor_label_id, (row.get(event.visitor_label_id) ?? 0) + 1);
    result.set(event.plant_label_id, row);
  }
  return result;
}

function summarize(events: readonly CoreEvent[], plants: readonly string[], visitors: readonly string[], pairs: readonly PairWeight[]): NetworkSummary {
  const counts = weights(events);
  const plantDegrees = new Map(plants.map(id => [id, 0]));
  const visitorDegrees = new Map(visitors.map(id => [id, 0]));
  let pairCount = 0;
  const pair_weights = pairs.map(pair => {
    const record_count = counts.get(pair.plant_label_id)?.get(pair.visitor_label_id) ?? 0;
    requireSimulation(Number.isSafeInteger(record_count) && record_count >= 0 && record_count <= pair.record_count, "INVALID_NUMERIC_RESULT", "network", `invalid weight for ${pair.plant_label_id} / ${pair.visitor_label_id}`);
    if (record_count > 0) {
      pairCount++;
      plantDegrees.set(pair.plant_label_id, plantDegrees.get(pair.plant_label_id)! + 1);
      visitorDegrees.set(pair.visitor_label_id, visitorDegrees.get(pair.visitor_label_id)! + 1);
    }
    return { plant_label_id: pair.plant_label_id, visitor_label_id: pair.visitor_label_id, record_count };
  });
  const plant_partner_counts = plants.map(label_id => ({ label_id, partner_count: plantDegrees.get(label_id)! }));
  const visitor_partner_counts = visitors.map(label_id => ({ label_id, partner_count: visitorDegrees.get(label_id)! }));
  const a = new Set(events.map(e => e.plant_label_id)).size;
  const b = new Set(events.map(e => e.visitor_label_id)).size;
  requireSimulation(pair_weights.reduce((sum, pair) => sum + pair.record_count, 0) === events.length
    && plant_partner_counts.reduce((sum, node) => sum + node.partner_count, 0) === pairCount
    && visitor_partner_counts.reduce((sum, node) => sum + node.partner_count, 0) === pairCount
    && pairCount <= Math.min(events.length, pairs.length) && pairCount <= a * b
    && a <= Math.min(events.length, plants.length) && b <= Math.min(events.length, visitors.length), "INVALID_NUMERIC_RESULT", "network", "weight, degree, node or pair invariants failed");
  const denominator = BigInt(plants.length) * BigInt(visitors.length);
  return {
    event_count: events.length, plant_label_count: a, visitor_label_count: b, pair_count: pairCount,
    connectance_fixed: denominator === 0n ? null : fraction(BigInt(pairCount), denominator),
    plant_partner_counts, visitor_partner_counts, pair_weights,
    undefined_reasons: denominator === 0n ? { connectance_fixed: "zero_reference_nodes" } : {},
  };
}

export function compareNetworks(referenceEvents: readonly CoreEvent[], sampleEvents: readonly CoreEvent[]) {
  validateSubset(referenceEvents, sampleEvents);
  const plants = [...new Set(referenceEvents.map(e => e.plant_label_id))].sort(asciiCompare);
  const visitors = [...new Set(referenceEvents.map(e => e.visitor_label_id))].sort(asciiCompare);
  const counts = weights(referenceEvents);
  const pairs: PairWeight[] = [];
  for (const plant_label_id of plants) {
    for (const visitor_label_id of [...counts.get(plant_label_id)!.keys()].sort(asciiCompare)) {
      pairs.push({ plant_label_id, visitor_label_id, record_count: counts.get(plant_label_id)!.get(visitor_label_id)! });
    }
  }
  const reference = summarize(referenceEvents, plants, visitors, pairs);
  const sample = summarize(sampleEvents, plants, visitors, pairs);
  return {
    reference, sample,
    lost_pair_count: reference.pair_count - sample.pair_count,
    pair_retention_pct: reference.pair_count === 0 ? null : fraction(100n * BigInt(sample.pair_count), BigInt(reference.pair_count)),
    undefined_reasons: reference.pair_count === 0 ? { pair_retention_pct: "zero_reference_pairs" as const } : {},
  };
}
