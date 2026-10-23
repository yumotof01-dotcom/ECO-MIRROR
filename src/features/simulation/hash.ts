/** Platform boundary; never substitutes a checksum or an empty result on failure. */
export async function sha256Text(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("CRYPTO_UNAVAILABLE: SHA-256 is required for simulation provenance");
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("");
}
