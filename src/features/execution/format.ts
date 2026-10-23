import { validateFraction } from "../simulation/core/fraction";
import type { Fraction, SqrtFraction } from "../simulation/core/types";

function decimal(scaled: bigint, digits: number): string {
  const scale = 10n ** BigInt(digits), whole = scaled / scale;
  return whole.toLocaleString("ja-JP") + (digits ? `.${(scaled % scale).toString().padStart(digits, "0")}` : "");
}
export function formatFraction(value: Fraction | null, digits = 2): string {
  if (value === null) return "未定義";
  validateFraction(value);
  if (!Number.isInteger(digits) || digits < 0 || digits > 8) throw new Error("表示桁数が不正です。");
  const n = BigInt(value.numerator), d = BigInt(value.denominator), scale = 10n ** BigInt(digits);
  return decimal((2n * n * scale + d) / (2n * d), digits);
}
function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n, next = (x + 1n) / 2n;
  while (next < x) { x = next; next = (x + n / x) / 2n; }
  return x;
}
export function formatSqrt(value: SqrtFraction | null, digits = 2): string {
  if (value === null) return "未定義（1試行）";
  validateFraction(value.radicand);
  if (!Number.isInteger(digits) || digits < 0 || digits > 8) throw new Error("表示桁数が不正です。");
  const n = BigInt(value.radicand.numerator) * 10n ** BigInt(2 * digits), d = BigInt(value.radicand.denominator), floor = isqrt(n / d);
  return decimal(4n * n >= d * (2n * floor + 1n) ** 2n ? floor + 1n : floor, digits);
}
export const count = (n: number) => n.toLocaleString("ja-JP");
