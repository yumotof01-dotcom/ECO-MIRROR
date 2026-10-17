export type SimulationErrorCode =
  | "INVALID_SELECTION" | "INVALID_RATE" | "INVALID_SEED" | "INVALID_TRIAL_INDEX"
  | "INVALID_BOUND" | "SOURCE_ORDER" | "NOT_A_SUBSET" | "INVALID_NUMERIC_RESULT"
  | "INVALID_CONTEXT";

export class SimulationError extends Error {
  constructor(readonly code: SimulationErrorCode, readonly stage: string, message: string) {
    super(`${code} [${stage}]: ${message}`);
    this.name = "SimulationError";
  }
}

export function requireSimulation(condition: unknown, code: SimulationErrorCode, stage: string, message: string): asserts condition {
  if (!condition) throw new SimulationError(code, stage, message);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

export function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

export const asciiCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
