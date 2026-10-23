import { execFileSync } from "node:child_process";
import { SOURCE, requireData } from "../../src/features/data/contract.ts";
import { validateObservationData } from "../../src/features/data/validate.ts";
import { ROOT, RAW_DIR, PROCESSED_DIR, PROFILE_PATH, jsonBytes, readBytes, readJson } from "./io.ts";
import { buildArtifacts, buildProvenance } from "./pipeline.ts";

async function main() {
  const rawPath = `${RAW_DIR}/${SOURCE.filename}`;
  const raw = await readBytes(rawPath);
  const result = buildArtifacts(raw, await readJson(PROFILE_PATH));
  const second = buildArtifacts(raw, await readJson(PROFILE_PATH));
  for (const [name, content] of Object.entries(result.files)) {
    requireData(content === second.files[name], "NONDETERMINISTIC", `${name} changed between identical runs`);
    requireData((await readBytes(`${PROCESSED_DIR}/${name}`)).equals(Buffer.from(content)), "ARTIFACT_STALE", `${name} differs; run data:normalize after reviewing and committing transform changes`);
  }
  validateObservationData(JSON.parse(result.files["events.json"]), JSON.parse(result.files["taxa.json"]));
  const provenance = jsonBytes(await buildProvenance(result));
  requireData((await readBytes(`${PROCESSED_DIR}/provenance.json`)).equals(Buffer.from(provenance)), "PROVENANCE_STALE", "source, code, schema, commands or output hashes differ from provenance.json");
  const attributes = execFileSync("git", ["check-attr", "text", "--", rawPath], { cwd: ROOT, encoding: "utf8" });
  requireData(attributes.trim().endsWith(": text: unset"), "GIT_ATTRIBUTES", "raw CSV must have -text to prevent newline conversion");
  // In CI the checked-out Git blob must also have the original CRLF bytes.
  const indexed = execFileSync("git", ["show", `:${rawPath}`], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  requireData(indexed.equals(raw), "GIT_RAW_BYTES", "Git index differs from verified original bytes");
  console.log(`PASS: ${result.quality.record_count} records; ${result.quality.year_summary.map(year => `${year.Year}=${year.record_count}`).join(", ")}; labels ${result.quality.plant_label_count}/${result.quality.visitor_label_count}; pairs ${result.quality.observed_pair_count}; plot-years ${result.quality.year_plot_counts.length}; no-record/effort-unknown ${result.quality.plot_round_cells_without_records.length}. All artifacts, source rows, Git bytes and provenance verified offline.`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
