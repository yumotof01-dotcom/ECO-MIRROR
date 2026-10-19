import { describe, expect, it } from "vitest";
import { draftErrors, draftFromInput, draftToInput, freshDraft } from "../simulation/model";
import { inputKey, normalizeExecutionInput } from "./input";

describe("complete explicit browser input", () => {
  it("has the exact phase-5 defaults and preserves distinct single/repeated-R=1 contracts", () => {
    const draft = freshDraft(), input = draftToInput(draft);
    expect(input).toMatchObject({ mode: "repeated_trials", request: { rate_percent: 50, master_seed: 42, repetitions: 100 } });
    expect(input.request.selection.plot_ids).toHaveLength(24);
    expect(input.request.selection.treatments).toHaveLength(4);
    expect(input.request.selection.rounds_by_year).toEqual({ 2014: ["1", "3", "4", "5", "7", "8", "9"], 2015: ["1", "2", "3", "4", "5", "6", "7"] });
    expect(draftToInput({ ...draft, mode: "single_trial", repetitions: "" }).request).not.toHaveProperty("repetitions");
    expect(draftToInput({ ...draft, repetitions: "1" }).request).toHaveProperty("repetitions", 1);
    expect(draftToInput(draftFromInput(input))).toEqual(input);
  });
  it.each(["", " ", " 42", "+42", "-1", "1e2", "1.0", "1.5", "4294967296", "Infinity", "NaN"])("keeps invalid seed text invalid: %s", seed => {
    const draft = { ...freshDraft(), seed };
    expect(draftErrors(draft).join()).toMatch(/シード/);
    expect(() => draftToInput(draft)).toThrow(); expect(draft.seed).toBe(seed);
  });
  it.each(["", "0", "1001", "1e2", "1.5", "-1"])("rejects invalid repetition text: %s", repetitions => expect(() => draftToInput({ ...freshDraft(), repetitions })).toThrow(/反復/));
  it.each([0, 100])("accepts p=%i as an explicit value", observationRate => expect(draftToInput({ ...freshDraft(), observationRate }).request.rate_percent).toBe(observationRate));
  it("normalizes ordering only and rejects empty selection, wrong year rounds and extra keys", () => {
    const original = draftToInput(freshDraft()), reordered = structuredClone(original);
    (reordered.request.selection.plot_ids as string[]).reverse();
    expect(inputKey(original)).toBe(inputKey(reordered));
    for (const invalid of [
      { ...original, request: { ...original.request, selection: { ...original.request.selection, plot_ids: [] } } },
      { ...original, request: { ...original.request, selection: { ...original.request.selection, years: [2014], rounds_by_year: { 2014: ["2"] } } } },
      { ...original, request: { ...original.request, selection: { ...original.request.selection, years: [2014] } } },
      { ...original, extra: true },
    ]) expect(() => normalizeExecutionInput(invalid as typeof original)).toThrow();
    expect(freshDraft().selection.plot_ids).toHaveLength(24);
  });
});
