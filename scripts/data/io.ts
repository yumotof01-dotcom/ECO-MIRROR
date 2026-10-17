import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { SOURCE, requireData } from "../../src/features/data/contract.ts";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const RAW_DIR = `data/raw/${SOURCE.dataset_id}`;
export const PROCESSED_DIR = `data/processed/${SOURCE.dataset_id}`;
export const PROFILE_PATH = "docs/data/cc-plant-pollinator/profile.json";
export const MANIFEST_PATH = "docs/data/cc-plant-pollinator/manifest.json";
export const CODE_INPUTS = [
  "package.json", "package-lock.json",
  "src/features/data/contract.ts", "src/features/data/types.ts", "src/features/data/validate.ts",
  "scripts/data/csv.ts", "scripts/data/quality.ts", "scripts/data/pipeline.ts",
  "scripts/data/io.ts", "scripts/data/fetch.ts", "scripts/data/normalize.ts", "scripts/data/check.ts",
  PROFILE_PATH, MANIFEST_PATH,
];

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export const jsonBytes = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const readBytes = (path: string) => readFile(join(ROOT, path));
export async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(ROOT, path), "utf8")) as Record<string, unknown>;
}

export function verifySourceBytes(bytes: Uint8Array) {
  requireData(bytes.byteLength === SOURCE.size, "SOURCE_SIZE", `expected ${SOURCE.size} bytes, received ${bytes.byteLength}; source not accepted`);
  const sha = sha256(bytes);
  requireData(sha === SOURCE.sha256, "SOURCE_SHA256", `expected ${SOURCE.sha256}, received ${sha}; source not accepted`);
  const md5 = createHash("md5").update(bytes).digest("hex");
  requireData(md5 === SOURCE.md5, "SOURCE_MD5", `expected ${SOURCE.md5}, received ${md5}; source not accepted`);
  return { size: bytes.byteLength, sha256: sha, md5 };
}

export async function verifySourceMetadata() {
  const source = await readJson(`${RAW_DIR}/source.json`);
  const manifest = await readJson(MANIFEST_PATH);
  const archive = manifest.archive_file as Record<string, unknown>;
  requireData(manifest.dataset_id === SOURCE.dataset_id && manifest.archive_doi === SOURCE.doi && manifest.archive_version === SOURCE.version && archive.id === SOURCE.file_id && archive.sha256 === SOURCE.sha256 && archive.computed_md5 === SOURCE.md5 && archive.size === SOURCE.size, "SOURCE_CONTRACT", "phase-3 source manifest differs from the fixed contract");
  requireData(source.dataset_id === SOURCE.dataset_id && source.sha256 === SOURCE.sha256 && source.md5 === SOURCE.md5 && source.size === SOURCE.size && source.download_url === SOURCE.url && source.doi === SOURCE.doi && source.version === SOURCE.version && source.file_id === SOURCE.file_id, "SOURCE_METADATA", "source.json differs from the verified archive identity");
  requireData(typeof source.retrieved_at_utc === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(source.retrieved_at_utc) && !Number.isNaN(Date.parse(source.retrieved_at_utc)), "SOURCE_METADATA", "missing or invalid UTC retrieval time");
  const license = source.license as Record<string, unknown> | undefined;
  requireData(license?.name === SOURCE.license.name && license.url === SOURCE.license.url, "SOURCE_LICENSE", "source attribution must retain CC BY 4.0");
  const metadataBytes = await readBytes(`${RAW_DIR}/archive-metadata.json`);
  requireData(sha256(metadataBytes) === source.metadata_sha256, "SOURCE_METADATA_HASH", "archived license evidence bytes differ from source.json");
  verifyArchiveMetadata(JSON.parse(metadataBytes.toString("utf8")));
  return source;
}

export function verifyArchiveMetadata(metadata: Record<string, unknown>) {
  const license = metadata.license as Record<string, unknown> | undefined;
  const files = metadata.files as Record<string, unknown>[] | undefined;
  const file = files?.find(entry => entry.id === SOURCE.file_id);
  requireData(metadata.doi === SOURCE.doi && metadata.version === SOURCE.version && file?.name === SOURCE.filename && file.size === SOURCE.size && file.computed_md5 === SOURCE.md5, "ARCHIVE_METADATA", "university v1 metadata no longer matches the selected file; do not adopt another version");
  requireData(license?.name === SOURCE.license.name && license.url === SOURCE.license.url, "SOURCE_LICENSE", "university metadata does not confirm CC BY 4.0");
}

/** Last commit touching actual transform inputs, not a later documentation commit. */
export async function codeProvenance() {
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: ROOT, encoding: "utf8" }).trim();
  requireData(shallow === "false", "CODE_HISTORY", "full Git history is needed to verify the transform revision; run git fetch --unshallow");
  const revision = execFileSync("git", ["log", "-1", "--format=%H", "--", ...CODE_INPUTS], { cwd: ROOT, encoding: "utf8" }).trim();
  requireData(/^[a-f0-9]{40}$/.test(revision), "CODE_REVISION", "transform inputs need a real Git commit");
  const hashes: Record<string, string> = {};
  for (const path of CODE_INPUTS) {
    let committed: Buffer;
    try {
      committed = execFileSync("git", ["show", `${revision}:${path}`], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      throw new Error(`CODE_REVISION: commit transform inputs before recording provenance (${path})`);
    }
    const actual = await readBytes(path);
    requireData(actual.equals(committed), "CODE_DIRTY", `${path} differs from transform commit ${revision}; commit the transform before normalization`);
    hashes[path] = sha256(actual);
  }
  return { transform_git_revision: revision, transform_input_sha256: hashes };
}
