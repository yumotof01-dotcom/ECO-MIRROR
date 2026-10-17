import { asciiCompare, isObject, requireSimulation } from "./errors.ts";
import type { Sha256 } from "./types.ts";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
function canonical(value: unknown, ancestors: Set<object>): JsonValue {
  const fail = (condition: unknown, message: string) => requireSimulation(condition, "INVALID_NUMERIC_RESULT", "serialization", message);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    fail(Number.isSafeInteger(value) && value >= 0, "only safe nonnegative integer Numbers may be serialized");
    return value === 0 ? 0 : value;
  }
  fail(Array.isArray(value) || isObject(value), "expected plain JSON value; undefined/BigInt/non-JSON objects are forbidden");
  const object = value as object;
  fail(!ancestors.has(object), "cyclic value is forbidden");
  ancestors.add(object);
  let result: JsonValue;
  if (Array.isArray(value)) {
    fail(Reflect.ownKeys(value).length === value.length + 1, "sparse arrays or additional array properties are forbidden");
    for (let i = 0; i < value.length; i++) fail(Object.hasOwn(value, i), "sparse arrays are forbidden");
    result = value.map(item => canonical(item, ancestors));
  } else {
    const record = value as Record<string, unknown>;
    fail(Reflect.ownKeys(record).length === Object.keys(record).length, "symbol/nonenumerable keys are forbidden");
    result = Object.fromEntries(Object.keys(record).sort(asciiCompare).map(key => {
      fail(/^[\x20-\x7e]*$/.test(key), "contract object keys must be ASCII");
      return [key, canonical(record[key], ancestors)];
    }));
  }
  ancestors.delete(object);
  return result;
}

/** 1.0.0 canonical result bytes: recursive ASCII keys, semantic array order, final LF. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonical(value, new Set()), null, 2)}\n`;
}

export async function digestText(text: string, sha256: Sha256): Promise<string> {
  const hash = await sha256(text);
  requireSimulation(typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash), "INVALID_CONTEXT", "hash", "SHA-256 boundary must return 64 lowercase hex digits");
  return hash;
}
export function idsHash(ids: readonly string[], sha256: Sha256): Promise<string> {
  requireSimulation(Array.isArray(ids) && ids.every(id => typeof id === "string"), "INVALID_NUMERIC_RESULT", "hash", "expected ordered record_id strings");
  return digestText(`${JSON.stringify(ids)}\n`, sha256);
}
