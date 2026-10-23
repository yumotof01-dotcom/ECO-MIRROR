import { requireSimulation } from "./errors.ts";
import { validateEventSequence } from "./events.ts";
import { validateRate, validateSeed, validateTrialIndex } from "./inputs.ts";
import { createPcg32 } from "./pcg32.ts";
import type { CoreEvent } from "./types.ts";

export function sampleSize(eligibleCount: number, ratePercent: unknown): number {
  validateRate(ratePercent);
  requireSimulation(Number.isSafeInteger(eligibleCount) && eligibleCount >= 0 && eligibleCount <= 3882, "INVALID_NUMERIC_RESULT", "sampling", "eligible count must be an integer in 0..3882");
  return Math.floor((eligibleCount * ratePercent + 50) / 100);
}

export function sampleEvents<T extends CoreEvent>(events: readonly T[], ratePercent: unknown, masterSeed: unknown, trialIndex: unknown) {
  validateEventSequence(events, "sampling");
  validateSeed(masterSeed);
  validateTrialIndex(trialIndex);
  const k = sampleSize(events.length, ratePercent);
  // Boundary paths do not even initialise the generator.
  if (k === 0) return { events: [] as T[], random_word_count: 0 };
  if (k === events.length) return { events: [...events], random_word_count: 0 };
  const random = createPcg32(masterSeed, trialIndex);
  const positions = Array.from({ length: events.length }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + random.boundedUint(events.length - i);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const selected = positions.slice(0, k).sort((a, b) => a - b);
  return { events: selected.map(i => events[i]), random_word_count: random.snapshot().random_word_count };
}
