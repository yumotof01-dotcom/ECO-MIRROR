// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../simulation/core/serialization";
import { canonicalBlob, blobSha256, prepareArtifacts, trialsCsv } from "./export";
import { validateCompletedResult } from "./validate";
import { sha256Text } from "../simulation/hash";
import { historicalInput, historicalMetadata, historicalResult } from "../../test/execution-fixtures";

describe("formal byte-identical export", () => {
  it("matches canonicalJson for integer keys, Unicode, boundaries, arrays, empty values and real results", async () => {
    for (const value of [null, true, -0, { z: "🌿".repeat(40000), a: { "2": false, "10": "1", "01": null }, b: [0, {}, [], ""] }, historicalResult]) {
      expect(await canonicalBlob(value).text()).toBe(canonicalJson(value));
    }
    expect(await blobSha256(canonicalBlob(historicalResult))).toBe("4ca9a993822c3a0c9a6e8cf823cfd0bafc49cb7f18a2dad8315e7cff9b1ece87");
  });
  it.each([undefined, NaN, Infinity, -1, 1.1, 1n, { bad: undefined }, [undefined], new Date(), { "日本語キー": 1 }])("rejects noncontract JSON %s", value => expect(() => canonicalBlob(value)).toThrow());
  it("rejects cyclic/sparse arrays and additional properties", () => {
    const cyclic: unknown[] = []; cyclic.push(cyclic);
    const sparse = new Array(2); sparse[1] = 1;
    const extra = Object.assign([1], { bad: true });
    for (const value of [cyclic, sparse, extra]) expect(() => canonicalBlob(value)).toThrow();
  });
  it("validates actual source IDs, exact all-trial summary and refuses corrupted results", async () => {
    await validateCompletedResult(historicalResult, historicalInput, historicalMetadata.context!, sha256Text);
    const bad = structuredClone(historicalResult); (bad.trials[0] as { pair_retention_pct: { numerator: string; denominator: string } }).pair_retention_pct = { numerator: "1", denominator: "1" };
    await expect(validateCompletedResult(bad, historicalInput, historicalMetadata.context!, sha256Text)).rejects.toThrow(/retention/);
    const wrong = structuredClone(historicalResult); (wrong.trials[0].sampled_source_record_numbers as number[])[0] = 0;
    await expect(validateCompletedResult(wrong, historicalInput, historicalMetadata.context!, sha256Text)).rejects.toThrow();
  });
  it("writes all trial CSV rows with exact numerator/denominator and separately binds provenance to the result", async () => {
    const phases: string[] = [];
    const a = await prepareArtifacts(historicalResult, historicalMetadata, message => phases.push(message));
    const b = await prepareArtifacts(historicalResult, historicalMetadata, () => {});
    expect(await a.result.text()).toBe(await b.result.text());
    expect(a.info.result_sha256).toBe(await blobSha256(a.result));
    const provenance = JSON.parse(await a.provenance.text());
    expect(provenance.result_sha256).toBe(a.info.result_sha256);
    expect(provenance.attribution.license.name).toBe("CC BY 4.0");
    expect(provenance.application_git_revision).toBe(historicalMetadata.application_git_revision);
    expect((await a.csv.text()).split("\r\n").filter(Boolean)).toHaveLength(4);
    expect(trialsCsv(historicalResult)).toContain('"18300","257","percent"');
    expect(JSON.parse(await a.result.text())).not.toHaveProperty("result_sha256");
    expect(phases).toHaveLength(3);
    await expect(prepareArtifacts(historicalResult, { ...historicalMetadata, verification: "unverified" }, () => {})).rejects.toThrow(/UNVERIFIED_BUILD/);
  });
});
