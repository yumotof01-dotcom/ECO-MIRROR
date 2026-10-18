/** Fixed developer checkpoints, independent of any UI. Full 1000-trial tests live in repeated-data.test.ts. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { ROUNDS, TREATMENTS } from "../../src/features/data/contract.ts";
import { canonicalJson } from "../../src/features/simulation/core/serialization.ts";
import type { RepeatedTrialRequest } from "../../src/features/simulation/core/types.ts";
import { ROOT, sha256 } from "../data/io.ts";
import { makeRunProvenance, readExecutionContext } from "./context.ts";

const write = process.argv.slice(2).join(" ") === "--write-verification";
assert(write || process.argv.length === 2, "usage: node scripts/simulation/verify-repeated.ts [--write-verification]");
const snapshot = await readExecutionContext();
const request: RepeatedTrialRequest = {
  selection: { years: [2014, 2015], plot_ids: Array.from({ length: 24 }, (_, i) => String(i + 1)), treatments: [...TREATMENTS], rounds_by_year: { 2014: [...ROUNDS[2014]], 2015: [...ROUNDS[2015]] } },
  rate_percent: 50, master_seed: 42, repetitions: 3,
};
const cases = [
  { name: "half", input: request },
  { name: "full", input: { ...request, repetitions: 1, rate_percent: 100 } },
  { name: "zero", input: { ...request, repetitions: 1, rate_percent: 0 } },
  { name: "empty", input: { ...request, selection: { years: [2014], plot_ids: ["3"], treatments: ["Water"], rounds_by_year: { 2014: ["1"] } } } },
] as const;
const vite = await createServer({ root: ROOT, configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null } });
try {
  const { runRepeatedObservationSimulation, runObservationSimulation } = await vite.ssrLoadModule("/src/features/simulation/run.ts") as typeof import("../../src/features/simulation/run.ts");
  const directory = join(ROOT, "docs/simulation/phase7-verification");
  if (write) await mkdir(directory, { recursive: true });
  for (const item of cases) {
    const result = await runRepeatedObservationSimulation(item.input, snapshot.context);
    const bytes = canonicalJson(result);
    assert.equal(bytes, canonicalJson(await runRepeatedObservationSimulation(item.input, snapshot.context)), "whole repeated result must be byte reproducible");
    if (item.name === "half") {
      const single = await runObservationSimulation({ selection: request.selection, rate_percent: 50, master_seed: 42 }, snapshot.context);
      assert.deepEqual(result.trials[0], single.trials[0]);
    }
    const resultPath = join(directory, `${item.name}-result.json`), provenancePath = join(directory, `${item.name}-provenance.json`);
    if (write) {
      await writeFile(resultPath, bytes);
      await writeFile(provenancePath, canonicalJson(makeRunProvenance(result, snapshot, new Date().toISOString(), `Node.js ${process.version}; ${process.platform}/${process.arch}`)));
    } else {
      assert.equal(await readFile(resultPath, "utf8"), bytes, `${item.name}: stored whole result differs`);
      const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
      assert.deepEqual(provenance, makeRunProvenance(result, snapshot, provenance.created_at_utc, provenance.runtime));
    }
    process.stdout.write(`PASS repeated ${item.name}: ${result.trials.length} trials; SHA-256 ${sha256(bytes)}\n`);
  }
} finally { await vite.close(); }
