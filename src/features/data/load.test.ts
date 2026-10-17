// @vitest-environment node
import { describe, expect, it } from "vitest";
import events from "../../../data/processed/moss-evans-2022-flower-visits-v1/events.json?raw";
import taxa from "../../../data/processed/moss-evans-2022-flower-visits-v1/taxa.json?raw";
import manifest from "../../../data/processed/moss-evans-2022-flower-visits-v1/artifacts.json?raw";
import { decodeObservationData, loadObservationData } from "./load.ts";
import { validateObservationData } from "./validate.ts";

describe("typed application data entry", () => {
  it("loads the committed real data lazily with hashes and runtime validation", async () => {
    const loaded = await loadObservationData();
    expect(loaded.dataset.events).toHaveLength(3882);
    expect(loaded.taxa.plants).toHaveLength(20);
    expect(loaded.taxa.visitors).toHaveLength(104);
  });

  it("rejects even a whitespace-only processed file change", async () => {
    await expect(decodeObservationData(`${events} `, taxa, JSON.parse(manifest))).rejects.toThrow(/ARTIFACT_HASH.*events.json/);
  });

  it("rejects an incorrect schema or event count at runtime", () => {
    const dataset = JSON.parse(events);
    expect(() => validateObservationData({ ...dataset, schema_version: "future" }, JSON.parse(taxa))).toThrow(/DATA_IDENTITY/);
    expect(() => validateObservationData({ ...dataset, events: dataset.events.slice(1) }, JSON.parse(taxa))).toThrow(/DATA_RECORD_COUNT/);
  });

  it("rejects a dictionary that merges or reorders original labels", () => {
    const dictionary = JSON.parse(taxa);
    dictionary.visitors.reverse();
    expect(() => validateObservationData(JSON.parse(events), dictionary)).toThrow(/DATA_TAXA/);
  });
});
