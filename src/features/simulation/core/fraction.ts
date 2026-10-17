import { hasKeys, isObject, requireSimulation } from "./errors.ts";
import type { Fraction } from "./types.ts";

const valid = (condition: unknown, message: string) => requireSimulation(condition, "INVALID_NUMERIC_RESULT", "fraction", message);
function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Constructs a reduced nonnegative rational; never converts through a float. */
export function fraction(numerator: bigint, denominator: bigint): Fraction {
  valid(typeof numerator === "bigint" && typeof denominator === "bigint" && numerator >= 0n && denominator > 0n, "expected nonnegative BigInt numerator and positive BigInt denominator");
  const divisor = gcd(numerator, denominator);
  return { numerator: (numerator / divisor).toString(), denominator: (denominator / divisor).toString() };
}

/** Persisted noncanonical fractions are rejected, not silently repaired. */
export function validateFraction(value: unknown): asserts value is Fraction {
  valid(isObject(value) && hasKeys(value, ["numerator", "denominator"]), "expected exactly numerator and denominator");
  const v = value as Record<string, unknown>;
  valid(typeof v.numerator === "string" && /^(0|[1-9][0-9]*)$/.test(v.numerator), "numerator must be a canonical decimal integer string");
  valid(typeof v.denominator === "string" && /^[1-9][0-9]*$/.test(v.denominator), "denominator must be a positive canonical decimal integer string");
  valid(gcd(BigInt(v.numerator as string), BigInt(v.denominator as string)) === 1n, "fraction must already be reduced (zero is 0/1)");
}
