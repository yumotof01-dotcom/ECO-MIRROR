import { requireData } from "./contract.ts";
import type { ObservationData } from "./types.ts";
import { validateIdentity, validateObservationData } from "./validate.ts";

/** Verify the exact UTF-8 artifacts before parsing them; no network or mock fallback. */
export async function decodeObservationData(eventsText: string, taxaText: string, manifest: unknown): Promise<ObservationData> {
  validateIdentity(manifest);
  requireData(globalThis.crypto?.subtle, "CRYPTO_UNAVAILABLE", "Web Crypto SHA-256 is required to verify the processed dataset");
  requireData(manifest.outputs !== null && typeof manifest.outputs === "object", "ARTIFACT_MANIFEST", "missing processed file hashes");
  const outputs = manifest.outputs as Record<string, { sha256?: unknown; bytes?: unknown }>;
  for (const [name, content] of [["events.json", eventsText], ["taxa.json", taxaText]]) {
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    requireData(outputs[name]?.sha256 === actual && outputs[name].bytes === bytes.byteLength, "ARTIFACT_HASH", `${name}: size/SHA-256 differs from committed artifact manifest`);
  }
  return validateObservationData(JSON.parse(eventsText), JSON.parse(taxaText));
}

/** Reserved for later phases. No page or simulation currently calls this loader. */
export async function loadObservationData(): Promise<ObservationData> {
  const [events, taxa, manifest] = await Promise.all([
    import("../../../data/processed/moss-evans-2022-flower-visits-v1/events.json?raw"),
    import("../../../data/processed/moss-evans-2022-flower-visits-v1/taxa.json?raw"),
    import("../../../data/processed/moss-evans-2022-flower-visits-v1/artifacts.json?raw"),
  ]);
  return decodeObservationData(events.default, taxa.default, JSON.parse(manifest.default));
}
