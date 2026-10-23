import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SOURCE } from "../../src/features/data/contract.ts";
import { ROOT, RAW_DIR, PROCESSED_DIR, PROFILE_PATH, jsonBytes, readBytes, readJson } from "./io.ts";
import { buildArtifacts, buildProvenance } from "./pipeline.ts";

async function main() {
  const result = buildArtifacts(await readBytes(`${RAW_DIR}/${SOURCE.filename}`), await readJson(PROFILE_PATH));
  const provenance = await buildProvenance(result);
  // Validation and code revision checks have completed before any output is written.
  await mkdir(join(ROOT, PROCESSED_DIR), { recursive: true });
  for (const [name, content] of Object.entries({ ...result.files, "provenance.json": jsonBytes(provenance) })) await writeFile(join(ROOT, PROCESSED_DIR, name), content);
  console.log(`Normalized ${result.dataset.events.length} records; phase-3 audit matched; transform commit ${provenance.transform_git_revision}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
