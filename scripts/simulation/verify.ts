/** Developer verification only; no UI, arbitrary report export or repeated-simulation mode. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { ROUNDS, TREATMENTS } from "../../src/features/data/contract.ts";
import { canonicalJson } from "../../src/features/simulation/core/serialization.ts";
import type { Selection } from "../../src/features/simulation/core/types.ts";
import { ROOT, sha256 } from "../data/io.ts";
import { makeRunProvenance, readExecutionContext } from "./context.ts";

const write = process.argv.slice(2).join(" ") === "--write-verification";
assert(write || process.argv.length === 2, "usage: node scripts/simulation/verify.ts [--write-verification]");
const snapshot = await readExecutionContext(); // Rejects dirty/nonexistent revisions before executing.
const selection: Selection = {
  years: [2014, 2015], plot_ids: Array.from({ length: 24 }, (_, i) => String(i + 1)),
  treatments: [...TREATMENTS], rounds_by_year: { 2014: [...ROUNDS[2014]], 2015: [...ROUNDS[2015]] },
};
// Vite's in-process loader honours the existing ?raw imports. No server is published/listened on.
const vite = await createServer({ root: ROOT, configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null } });
try {
  const { runObservationSimulation } = await vite.ssrLoadModule("/src/features/simulation/run.ts") as typeof import("../../src/features/simulation/run.ts");
  const request = { selection, rate_percent: 50, master_seed: 42 };
  const result = await runObservationSimulation(request, snapshot.context);
  const bytes = canonicalJson(result);
  assert.equal(bytes, canonicalJson(await runObservationSimulation(request, snapshot.context)), "same input must reproduce every result byte");
  const full = await runObservationSimulation({ ...request, rate_percent: 100 }, snapshot.context);
  assert.deepEqual([full.reference?.event_count, full.reference?.plant_label_count, full.reference?.visitor_label_count, full.reference?.pair_count], [3882, 20, 104, 257]);
  assert.equal(full.trials[0].lost_pair_count, 0);
  assert.equal(full.trials[0].random_word_count, 0);
  assert.deepEqual(full.trials[0].pair_retention_pct, { numerator: "100", denominator: "1" });
  const directory = join(ROOT, "docs/simulation/phase6-verification");
  if (write) {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "run-result.json"), bytes);
    await writeFile(join(directory, "run-provenance.json"), canonicalJson(makeRunProvenance(result, snapshot, new Date().toISOString(), `Node.js ${process.version}; ${process.platform}/${process.arch}`)));
  } else {
    assert.equal(await readFile(join(directory, "run-result.json"), "utf8"), bytes, "saved developer verification result differs");
    const provenance = JSON.parse(await readFile(join(directory, "run-provenance.json"), "utf8"));
    assert.equal(provenance.result_sha256, sha256(bytes));
    assert.equal(provenance.data_provenance_sha256, snapshot.data_provenance_sha256);
    assert.deepEqual(provenance, makeRunProvenance(result, snapshot, provenance.created_at_utc, provenance.runtime));
  }
  process.stdout.write(`PASS: official data 100% audit; identical single-trial bytes; saved 50% developer verification ${write ? "written" : "checked"}. SHA-256 ${sha256(bytes)}\n`);
} finally {
  await vite.close();
}
