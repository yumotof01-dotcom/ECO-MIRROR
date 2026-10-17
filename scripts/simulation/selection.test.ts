// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { loadObservationData } from "../../src/features/data/index.ts";
import type { ObservationData } from "../../src/features/data/index.ts";
import { normalizeSelection } from "../../src/features/simulation/core/inputs.ts";
import { selectScope } from "../../src/features/simulation/core/scope.ts";
import { allSelection, copy, sha256 } from "./test-support.ts";

describe("explicit year/plot/treatment/year-specific-round scope", () => {
  let data: ObservationData;
  beforeAll(async () => { data = await loadObservationData(); });
  it("canonicalizes only input order, preserving original data order and all duplicate-content events", async () => {
    const shuffled = {
      years: [2015, 2014], plot_ids: [...allSelection.plot_ids].reverse(), treatments: [...allSelection.treatments].reverse(),
      rounds_by_year: { 2015: [...allSelection.rounds_by_year[2015]!].reverse(), 2014: [...allSelection.rounds_by_year[2014]!].reverse() },
    };
    expect(normalizeSelection(shuffled)).toEqual(allSelection);
    const a = await selectScope(data.dataset.events, allSelection, sha256);
    expect(await selectScope(data.dataset.events, shuffled, sha256)).toEqual(a);
    expect(a.events).toHaveLength(3882);
    expect(a.events[0]).toBe(data.dataset.events[0]);
    expect(a.scope).toMatchObject({ scope_mode: "pooled_records", plot_year_count: 48, observation_group_count: 321, records_by_year: [{ year: 2014, record_count: 1687 }, { year: 2015, record_count: 2195 }] });
    expect(a.scope.no_record_groups).toHaveLength(15);
    expect(a.scope.eligible_source_record_numbers).toEqual(Array.from({ length: 3882 }, (_, i) => i + 1));
  });
  it("combines different fields with AND and values within a field with OR", async () => {
    const selection = { years: [2014], plot_ids: ["1", "2"], treatments: ["Control", "Heat+Water"], rounds_by_year: { 2014: ["1", "3"] } };
    const { events } = await selectScope(data.dataset.events, selection, sha256);
    expect(events).toHaveLength(14); // Plot1:1+6, Plot2:2+5 from phase-3 counts.
    expect(events.every(e => e.year === 2014 && ["1", "2"].includes(e.plot_id) && ["1", "3"].includes(e.round_label))).toBe(true);
    const none = await selectScope(data.dataset.events, { ...selection, treatments: ["Heat"] }, sha256);
    expect(none.events).toEqual([]);
    expect(none.scope.no_record_groups).toEqual([]); // Do not invent Heat groups for these plots.
  });
  it("retains source-level effort-unknown groups, including an entirely empty but valid scope", async () => {
    const { events, scope } = await selectScope(data.dataset.events, { years: [2014], plot_ids: ["3"], treatments: ["Water"], rounds_by_year: { 2014: ["1"] } }, sha256);
    expect(events).toEqual([]);
    expect(scope.no_record_groups).toEqual([{ year: 2014, plot_id: "3", round_label: "1", status: "no_record_effort_unknown" }]);
    expect(scope.records_by_year).toEqual([{ year: 2014, record_count: 0 }]);
  });
  it.each([
    null, {}, { ...allSelection, extra: true }, { ...allSelection, years: [] }, { ...allSelection, years: [2014, 2014] },
    { ...allSelection, years: ["2014"] }, { ...allSelection, years: [2016] }, { ...allSelection, plot_ids: [1] },
    { ...allSelection, plot_ids: ["01"] }, { ...allSelection, plot_ids: ["25"] }, { ...allSelection, plot_ids: [" 1"] },
    { ...allSelection, plot_ids: ["1", "1"] }, { ...allSelection, treatments: ["heat"] }, { ...allSelection, treatments: [] },
    { ...allSelection, treatments: ["Control", "Control"] }, { ...allSelection, rounds_by_year: { 2014: ["1"] } },
    { ...allSelection, years: [2014], rounds_by_year: { 2014: ["2"] } },
    { ...allSelection, years: [2014], rounds_by_year: { 2014: ["6"] } },
    { ...allSelection, years: [2015], rounds_by_year: { 2015: ["8"] } },
    { ...allSelection, years: [2015], rounds_by_year: { 2015: ["9"] } },
    { ...allSelection, years: [2014], rounds_by_year: { 2014: [1] } },
    { ...allSelection, years: [2014], rounds_by_year: { 2014: ["1", "1"] } },
    { ...allSelection, years: [2014], rounds_by_year: { 2014: [] } },
    { ...allSelection, years: [2014] }, { ...allSelection, rounds_by_year: ["1"] },
  ])("rejects malformed selection %j without trimming, deduplicating or filling defaults", input => {
    expect(() => normalizeSelection(input)).toThrow(/INVALID_SELECTION/);
  });
  it("leaves mutable selection input unchanged and returns a detached canonical selection", () => {
    const input = copy(allSelection), before = JSON.stringify(input);
    const normalized = normalizeSelection(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(normalized.years).not.toBe(input.years);
    expect(normalized.rounds_by_year[2014]).not.toBe(input.rounds_by_year[2014]);
  });
});
