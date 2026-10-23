// @vitest-environment node
import { describe, expect, it } from "vitest";
import { boundedUint, createPcg32 } from "../../src/features/simulation/core/pcg32.ts";
import { fixtures } from "./test-support.ts";

describe("PCG-XSH-RR 64/32 specification 1.0.0", () => {
  it("matches both the official initialization checkpoint and all six exact words", () => {
    const random = createPcg32(42, 0);
    expect(random.snapshot()).toEqual({ state_u64_hex: fixtures.pcg32_reference.state_after_initialization_hex, increment_u64_hex: fixtures.pcg32_reference.increment_hex, random_word_count: 0 });
    const words = Array.from({ length: 6 }, () => random.nextUint32());
    expect(words).toEqual(fixtures.pcg32_reference.words_decimal);
    expect(words.map(word => word.toString(16).padStart(8, "0"))).toEqual(fixtures.pcg32_reference.words_hex);
    expect(random.snapshot().random_word_count).toBe(6);
  });
  it.each([0, 42, 4294967295])("keeps seed %i unsigned and reproducible, with state owned by each instance", seed => {
    const a = createPcg32(seed, 0), b = createPcg32(seed, 0);
    for (let i = 0; i < 100; i++) {
      const word = a.nextUint32();
      expect(word).toBe(b.nextUint32());
      expect(Number.isInteger(word) && word >= 0 && word <= 4294967295).toBe(true);
    }
    expect(createPcg32(seed, 0).snapshot().random_word_count).toBe(0);
  });
  it.each(fixtures.stream_cases)("uses exactly stream 54+t for t=$trial_index", ({ master_seed, trial_index, increment }: { master_seed: number; trial_index: number; increment: number }) => {
    expect(createPcg32(master_seed, trial_index).snapshot().increment_u64_hex).toBe(BigInt(increment).toString(16).padStart(16, "0"));
  });
  it.each(fixtures.bounded_test_doubles)("rejects the prescribed prefix at bound $m", ({ m, supplied_words, expected_output, consumed_words }: { m: number; supplied_words: number[]; expected_output: number; consumed_words: number }) => {
    let count = 0;
    const value = boundedUint(m, () => { expect(count).toBeLessThan(supplied_words.length); return supplied_words[count++]; });
    expect(value).toBe(expected_output);
    expect(count).toBe(consumed_words);
  });
  it("counts actual PCG rejection words, not just bounded requests", () => {
    const random = createPcg32(42, 0);
    expect(random.boundedUint(2147483649)).toBe(559678134); // first word accepted
    expect(random.boundedUint(2147483649)).toBe(974992175); // second word rejected, third accepted
    expect(random.snapshot().random_word_count).toBe(3);
    const before = random.snapshot();
    expect(random.boundedUint(1)).toBe(0);
    expect(random.snapshot()).toEqual(before);
  });
  it.each([-1, 4294967296, 1.5, NaN, Infinity, "42", null, undefined])("rejects invalid seed %s without wrapping it", seed => {
    expect(() => createPcg32(seed, 0)).toThrow(/INVALID_SEED/);
  });
  it.each([-1, 1000, 0.5, "0", null, NaN, Infinity])("rejects invalid trial index %s", t => {
    expect(() => createPcg32(42, t)).toThrow(/INVALID_TRIAL_INDEX/);
  });
  it.each([0, -1, 4294967296, 0.5, "3", null, NaN, Infinity])("rejects invalid bound %s before requesting a word", bound => {
    expect(() => boundedUint(bound, () => { throw new Error("must not draw"); })).toThrow(/INVALID_BOUND/);
  });
  it("accepts the maximum bound and refuses a signed/broken word source", () => {
    expect(boundedUint(4294967295, () => 4294967295)).toBe(0);
    expect(() => boundedUint(3, () => -1)).toThrow(/INVALID_NUMERIC_RESULT/);
  });
});
