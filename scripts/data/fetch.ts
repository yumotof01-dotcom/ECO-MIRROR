import { mkdir, rename, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { SOURCE, requireData } from "../../src/features/data/contract.ts";
import { ROOT, RAW_DIR, jsonBytes, readBytes, sha256, verifyArchiveMetadata, verifySourceBytes, verifySourceMetadata } from "./io.ts";

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  requireData(response.ok, "DOWNLOAD_HTTP", `${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const path = `${RAW_DIR}/${SOURCE.filename}`;
  let exists = false;
  try { await access(join(ROOT, path)); exists = true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (exists) {
    verifySourceBytes(await readBytes(path));
    await verifySourceMetadata();
    console.log("Verified existing archive bytes and retrieval metadata; first retrieval time retained.");
    return;
  }
  // Neither raw bytes nor their metadata are saved until both checks pass.
  const bytes = await download(SOURCE.url);
  const hashes = verifySourceBytes(bytes);
  const metadataBytes = await download(SOURCE.metadata_url);
  verifyArchiveMetadata(JSON.parse(metadataBytes.toString("utf8")));
  const source = {
    dataset_id: SOURCE.dataset_id, title: SOURCE.title, creators: SOURCE.creators,
    doi: SOURCE.doi, version: SOURCE.version, file_id: SOURCE.file_id,
    download_url: SOURCE.url, retrieved_at_utc: new Date().toISOString(),
    ...hashes, line_endings: "CRLF", license: SOURCE.license,
    metadata_url: SOURCE.metadata_url, metadata_sha256: sha256(metadataBytes),
    changes_to_source_csv: "None; original bytes retained.",
    attribution: "Ellen Moss and Darren Evans (2022), Climate change impacts on plant-pollinator interactions and functioning - experiment data, version 1, https://doi.org/10.25405/data.ncl.17430548.v1. CC BY 4.0 https://creativecommons.org/licenses/by/4.0/. No endorsement is implied.",
    retrieval_command: "npm run data:fetch",
  };
  await mkdir(join(ROOT, RAW_DIR), { recursive: true });
  await writeFile(join(ROOT, RAW_DIR, "archive-metadata.json"), metadataBytes, { flag: "wx" });
  await writeFile(join(ROOT, RAW_DIR, "source.json"), jsonBytes(source), { flag: "wx" });
  await writeFile(join(ROOT, `${path}.partial`), bytes, { flag: "wx" });
  await rename(join(ROOT, `${path}.partial`), join(ROOT, path));
  console.log(`Verified and saved ${hashes.size} original bytes; SHA-256 ${hashes.sha256}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
