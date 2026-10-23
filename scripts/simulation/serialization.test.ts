// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fraction, validateFraction } from "../../src/features/simulation/core/fraction.ts";
import { canonicalJson, digestText, idsHash } from "../../src/features/simulation/core/serialization.ts";
import { sha256Text } from "../../src/features/simulation/hash.ts";
import { sha256 } from "./test-support.ts";

describe("exact numerical values and canonical serialization", () => {
  it("reduces BigInt ratios including exact percentages and zero", () => {
    expect(fraction(400n, 6n)).toEqual({ numerator: "200", denominator: "3" });
    expect(fraction(0n, 9n)).toEqual({ numerator: "0", denominator: "1" });
    expect(fraction(123456789012345678901234567890n, 30n)).toEqual({ numerator: "4115226300411522630041152263", denominator: "1" });
  });
  it.each([[1n, 0n], [-1n, 1n], [1n, -2n]])("rejects invalid numerator/denominator %s/%s", (n, d) => {
    expect(() => fraction(n, d)).toThrow(/INVALID_NUMERIC_RESULT/);
  });
  it.each([
    { numerator: "4", denominator: "6" }, { numerator: "0", denominator: "2" }, { numerator: "1", denominator: "0" },
    { numerator: "01", denominator: "1" }, { numerator: "+1", denominator: "1" }, { numerator: "-1", denominator: "2" },
    { numerator: 1, denominator: "1" }, { numerator: "1", denominator: "1", approximation: 1 },
  ])("refuses noncanonical persisted fractions %j", input => {
    expect(() => validateFraction(input)).toThrow(/INVALID_NUMERIC_RESULT/);
  });
  it("accepts canonical fractions and serializes ASCII-sorted keys with semantic array order and one LF", () => {
    validateFraction({ numerator: "200", denominator: "3" });
    expect(canonicalJson({ z: [3, 1], a: { b: 0, A: "x" } })).toBe('{\n  "a": {\n    "A": "x",\n    "b": 0\n  },\n  "z": [\n    3,\n    1\n  ]\n}\n');
    expect(canonicalJson({ a: -0 })).toBe(canonicalJson({ a: 0 }));
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
  it.each([undefined, 1n, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, new Date(), [undefined], new Array(1)])("rejects forbidden JSON numeric/value input %s", input => {
    expect(() => canonicalJson(input)).toThrow(/INVALID_NUMERIC_RESULT/);
  });
  it("rejects cycles, symbol keys and custom objects without stripping information", () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow(/cyclic/);
    expect(() => canonicalJson({ [Symbol("x")]: 1 })).toThrow(/symbol/);
    expect(() => canonicalJson(new Map([["a", 1]]))).toThrow(/INVALID_NUMERIC_RESULT/);
  });
  it("hashes the compact original ID array + LF separately from pretty result bytes", async () => {
    expect(await idsHash([], sha256)).toBe(sha256("[]\n"));
    expect(await idsHash(["original:2", "original:10"], sha256)).toBe(sha256('["original:2","original:10"]\n'));
    expect(await idsHash(["original:10", "original:2"], sha256)).not.toBe(await idsHash(["original:2", "original:10"], sha256));
    expect(await sha256Text("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Text(canonicalJson({ a: 1 }))).toBe(sha256(canonicalJson({ a: 1 })));
  });
  it("refuses a broken hash provider rather than recording an invalid hash", async () => {
    await expect(digestText("x", () => "bad")).rejects.toThrow(/INVALID_CONTEXT/);
  });
});
