// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadObservationData } from "../data/index";
import { runRepeatedTrials } from "../simulation/core/repeated";
import type { RunContext, RunResult } from "../simulation/core/types";
import { adaptRunResult } from "./adapter";
import { createBipartiteLayout, linkWidth } from "./layout";
import { NetworkComparison } from "./NetworkComparison";
import halfJson from "../../../docs/simulation/phase7-verification/half-result.json";
import fullJson from "../../../docs/simulation/phase7-verification/full-result.json";
import zeroJson from "../../../docs/simulation/phase7-verification/zero-result.json";
import emptyJson from "../../../docs/simulation/phase7-verification/empty-result.json";

const half = halfJson as unknown as RunResult;
const full = fullJson as unknown as RunResult;
const zero = zeroJson as unknown as RunResult;
const empty = emptyJson as unknown as RunResult;
const view = (r: RunResult, t = 0) => { const result = adaptRunResult(r, t); if (result.status !== "success") throw Error("expected success"); return result; };

describe("real-result visualization adapter and deterministic layout", () => {
  it("keeps all 124 verbatim labels, one link per 257 observed pairs, and exact weights", () => {
    const before = JSON.stringify(half), data = view(half);
    expect(data.nodes.filter(n => n.side === "plant")).toHaveLength(20);
    expect(data.nodes.filter(n => n.side === "visitor")).toHaveLength(104);
    expect(data.links).toHaveLength(257);
    expect(new Set(data.links.map(l => l.id)).size).toBe(257);
    expect(data.links.reduce((sum, l) => sum + l.referenceCount, 0)).toBe(3882);
    expect(data.links.reduce((sum, l) => sum + l.sampleCount, 0)).toBe(1941);
    expect(data.links.filter(l => l.sampleCount > 0)).toHaveLength(183);
    expect(data.nodes.every(n => n.id === `${n.side}:${n.label}`)).toBe(true);
    expect(data.links.some(l => l.referenceCount > 1)).toBe(true);
    expect(JSON.stringify(half)).toBe(before);
  });
  it("preserves similar but different original labels", () => {
    const data = view(half);
    for (const label of ["Inachis_io", "Aglais_io", "Phaonia_incarna", "Phaonia_sp"]) {
      expect(data.nodes.find(n => n.id === `visitor:${label}`)?.label).toBe(label);
    }
    expect(new Set(data.nodes.map(n => n.id)).size).toBe(124);
  });
  it("keeps all reference nodes/ghost pairs for 0%, and identical pairs/weights for 100%", () => {
    const none = view(zero), all = view(full);
    expect(none.nodes).toHaveLength(124);
    expect(none.nodes.every(n => n.samplePartners === 0)).toBe(true);
    expect(none.links).toHaveLength(257);
    expect(none.links.every(l => l.sampleCount === 0)).toBe(true);
    expect(all.links.every(l => l.sampleCount === l.referenceCount)).toBe(true);
    expect(all.trial.lost_pair_count).toBe(0);
    expect(adaptRunResult(empty)).toEqual({ status: "empty_scope" });
  });
  it("has identical coordinates for shuffled node input, other trials and all extraction rates", () => {
    const data = view(half), positions = createBipartiteLayout(data.nodes);
    expect(createBipartiteLayout([...data.nodes].reverse())).toEqual(positions);
    for (const r of [view(half, 1), view(half, 2), view(zero), view(full)]) expect(createBipartiteLayout(r.nodes)).toEqual(positions);
    for (const side of ["plant", "visitor"] as const) {
      const ys = data.nodes.filter(n => n.side === side).map(n => positions.positions.get(n.id)!.y);
      expect(ys.every((y, i) => i === 0 || y - ys[i - 1] >= 29.999)).toBe(true);
    }
    expect(linkWidth(0, 100)).toBe(1);
    expect(linkWidth(25, 100)).toBe(3.5);
    expect(() => linkWidth(-1, 100)).toThrow();
  });
  it.each([-1, 0.5, 3, 1000, NaN])("rejects a missing/invalid trial index %s", t => expect(() => adaptRunResult(half, t)).toThrow(/INVALID_VISUALIZATION_RESULT/));
  it.each([
    (r: RunResult) => { (r.reference!.pair_weights[0] as { record_count: number }).record_count = -1; },
    (r: RunResult) => { (r.trials[0].sample.pair_weights[0] as { plant_label_id: string }).plant_label_id = "plant:invented"; },
    (r: RunResult) => { (r.trials[0].sample.pair_weights[0] as { record_count: number }).record_count = 999999; },
    (r: RunResult) => { (r.trials[0].sample as { pair_count: number }).pair_count++; },
    (r: RunResult) => { (r.trials[0] as { lost_pair_count: number }).lost_pair_count++; },
    (r: RunResult) => { (r.trials[0].sample.plant_partner_counts[0] as { partner_count: number }).partner_count++; },
    (r: RunResult) => { (r.trials as unknown[]).pop(); },
    (r: RunResult) => { (r.trials[1] as { trial_index: number }).trial_index = 0; },
    (r: RunResult) => { (r.reference!.pair_weights as unknown[]).splice(1, 0, r.reference!.pair_weights[0]); },
    (r: RunResult) => { delete (r.trials as unknown[])[1]; },
    (r: RunResult) => { delete (r.trials[0].sample.pair_weights as unknown[])[1]; },
  ])("rejects inconsistent results instead of repairing the display", change => {
    const data = structuredClone(half); change(data); expect(() => adaptRunResult(data)).toThrow(/INVALID_VISUALIZATION_RESULT/);
  });
  it("renders existing real trials 0, 1, 99 from one R=100 result without changing positions", async () => {
    const source = await loadObservationData();
    const context: RunContext = { implementation_git_revision: half.implementation_git_revision, specification_sha256: half.specification_sha256, data_identity: half.data_identity };
    const result = await runRepeatedTrials(source, { selection: half.selection, rate_percent: 50, master_seed: 42, repetitions: 100 }, context, async text => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, "0")).join(""));
    const start = performance.now();
    const renders = [0, 1, 99].map(trialIndex => renderToStaticMarkup(createElement(NetworkComparison, { result, trialIndex })));
    const locations = renders.map(html => [...html.matchAll(/data-node-id="([^"]+)" data-x="([^"]+)" data-y="([^"]+)"/g)].map(m => m.slice(1)));
    expect(locations[0]).toHaveLength(248);
    expect(locations[1]).toEqual(locations[0]); expect(locations[2]).toEqual(locations[0]);
    expect(renders.every(html => (html.match(/data-pair=/g) ?? []).length === 514)).toBe(true);
    expect(renders[2]).toContain("試行 99");
    console.info(`three full-network SSR renders: ${Math.round(performance.now() - start)}ms, ${renders[0].length} HTML characters`);
  }, 20000);
});
