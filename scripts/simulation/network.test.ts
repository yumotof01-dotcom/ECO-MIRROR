// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compareNetworks } from "../../src/features/simulation/core/network.ts";
import { fixtures, toy } from "./test-support.ts";

describe("verbatim bipartite networks with a common reference", () => {
  it("counts distinct pairs once while retaining every repeated event's weight", () => {
    const { reference, sample } = compareNetworks(toy, toy);
    expect(reference).toEqual(sample);
    expect(reference.event_count).toBe(10);
    expect(reference.pair_count).toBe(6);
    expect(reference.pair_weights.map(p => p.record_count)).toEqual([2, 1, 1, 2, 1, 3]);
    expect(reference.plant_partner_counts.map(n => n.partner_count)).toEqual(Object.values(fixtures.reference.plant_partner_counts));
    expect(reference.visitor_partner_counts.map(n => n.partner_count)).toEqual(Object.values(fixtures.reference.visitor_partner_counts));
  });
  it("keeps reference nodes and exactly the reference pair keys, with zero sample weights", () => {
    const { reference, sample, pair_retention_pct, lost_pair_count } = compareNetworks(toy, []);
    expect(sample).toMatchObject({ event_count: 0, plant_label_count: 0, visitor_label_count: 0, pair_count: 0, connectance_fixed: { numerator: "0", denominator: "1" }, undefined_reasons: {} });
    expect(sample.plant_partner_counts).toHaveLength(3);
    expect(sample.visitor_partner_counts).toHaveLength(3);
    expect(sample.pair_weights).toHaveLength(6);
    expect(sample.pair_weights.map(({ plant_label_id, visitor_label_id }) => [plant_label_id, visitor_label_id])).toEqual(reference.pair_weights.map(({ plant_label_id, visitor_label_id }) => [plant_label_id, visitor_label_id]));
    expect(sample.pair_weights.every(p => p.record_count === 0)).toBe(true);
    expect(lost_pair_count).toBe(6);
    expect(pair_retention_pct).toEqual({ numerator: "0", denominator: "1" });
  });
  it("returns null plus reasons for mathematical zero denominators", () => {
    const result = compareNetworks([], []);
    expect(result.reference.connectance_fixed).toBeNull();
    expect(result.sample.undefined_reasons).toEqual({ connectance_fixed: "zero_reference_nodes" });
    expect(result.pair_retention_pct).toBeNull();
    expect(result.undefined_reasons).toEqual({ pair_retention_pct: "zero_reference_pairs" });
  });
  it("does not merge synonyms, similar spellings, sides, or IDs containing delimiter characters", () => {
    const labels = [
      ["A|visitor:B", "C"], ["A", "B|visitor:C"], ["A", "Aglais_io"], ["A", "Inachis_io"], ["A", "aglais_io"],
    ];
    const events = labels.map(([plant, visitor], i) => ({ ...toy[i], plant_label_raw: plant, visitor_label_raw: visitor, plant_label_id: `plant:${plant}`, visitor_label_id: `visitor:${visitor}` }));
    const result = compareNetworks(events, events);
    expect(result.reference.pair_count).toBe(5);
    expect(result.reference.visitor_label_count).toBe(5);
    expect(result.reference.plant_label_count).toBe(2);
    expect(result.reference.visitor_partner_counts.map(n => n.label_id)).toEqual(["visitor:Aglais_io", "visitor:B|visitor:C", "visitor:C", "visitor:Inachis_io", "visitor:aglais_io"]);
  });
  it("enforces weight and both degree-sum invariants for each one-event omission", () => {
    for (let omit = 0; omit < toy.length; omit++) {
      const { reference, sample, lost_pair_count } = compareNetworks(toy, toy.filter((_, i) => i !== omit));
      expect(sample.pair_weights.reduce((sum, p) => sum + p.record_count, 0)).toBe(9);
      expect(sample.plant_partner_counts.reduce((sum, n) => sum + n.partner_count, 0)).toBe(sample.pair_count);
      expect(sample.visitor_partner_counts.reduce((sum, n) => sum + n.partner_count, 0)).toBe(sample.pair_count);
      expect(sample.pair_weights.every((p, i) => p.record_count <= reference.pair_weights[i].record_count)).toBe(true);
      expect(lost_pair_count + sample.pair_count).toBe(reference.pair_count);
    }
  });
  it("rejects outside/modified/repeated sample IDs, new pairs and bad source order", () => {
    expect(() => compareNetworks(toy.slice(1), [toy[0]])).toThrow(/NOT_A_SUBSET/);
    expect(() => compareNetworks(toy, [toy[0], toy[0]])).toThrow(/NOT_A_SUBSET/);
    expect(() => compareNetworks(toy, [{ ...toy[0], visitor_label_raw: "Z", visitor_label_id: "visitor:Z" }])).toThrow(/NOT_A_SUBSET/);
    expect(() => compareNetworks(toy, [{ ...toy[0], source_record_number: 2 }])).toThrow(/NOT_A_SUBSET/);
    expect(() => compareNetworks(toy, [toy[1], toy[0]])).toThrow(/SOURCE_ORDER/);
    expect(() => compareNetworks([{ ...toy[0], plant_label_id: "plant:corrected" }], [])).toThrow(/INVALID_NUMERIC_RESULT/);
  });
});
