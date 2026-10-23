import { requireSimulation } from "./errors.ts";
import { validateSeed, validateTrialIndex } from "./inputs.ts";

const MASK64 = (1n << 64n) - 1n;
const MASK32 = (1n << 32n) - 1n;
const MULTIPLIER = 6364136223846793005n;
export const u64Hex = (value: bigint) => value.toString(16).padStart(16, "0");

/** Unbiased range mapping; the supplied source owns/counts every rejected word. */
export function boundedUint(bound: unknown, nextUint32: () => number): number {
  requireSimulation(typeof bound === "number" && Number.isSafeInteger(bound) && bound >= 1 && bound <= 4294967295, "INVALID_BOUND", "randomness", "bound must be an integer in 1..4294967295");
  if (bound === 1) return 0;
  const threshold = 4294967296 % bound;
  for (;;) {
    const word = nextUint32();
    requireSimulation(Number.isSafeInteger(word) && word >= 0 && word <= 4294967295, "INVALID_NUMERIC_RESULT", "randomness", "word source returned an invalid uint32");
    if (word >= threshold) return word % bound;
  }
}

/** PCG-XSH-RR 64/32, randomness.md 1.0.0. State belongs only to this instance. */
export function createPcg32(masterSeed: unknown, trialIndex: unknown) {
  validateSeed(masterSeed);
  validateTrialIndex(trialIndex);
  let state = 0n;
  const increment = 2n * BigInt(54 + trialIndex) + 1n;
  let wordCount = 0;
  function step(): number {
    const old = state;
    state = (old * MULTIPLIER + increment) & MASK64;
    const shifted = (((old >> 18n) ^ old) >> 27n) & MASK32;
    const rotation = old >> 59n;
    return Number(((shifted >> rotation) | ((shifted << ((32n - rotation) & 31n)) & MASK32)) & MASK32);
  }
  step();
  state = (state + BigInt(masterSeed)) & MASK64;
  step();
  function nextUint32(): number {
    requireSimulation(Number.isSafeInteger(wordCount + 1), "INVALID_NUMERIC_RESULT", "randomness", "random word counter exceeded safe integer range");
    wordCount++;
    return step();
  }
  return {
    nextUint32,
    boundedUint: (bound: unknown) => boundedUint(bound, nextUint32),
    snapshot: () => ({ state_u64_hex: u64Hex(state), increment_u64_hex: u64Hex(increment), random_word_count: wordCount }),
  };
}
