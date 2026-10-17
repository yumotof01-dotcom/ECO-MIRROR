import { execFileSync } from "node:child_process";
import { SOURCE } from "../../src/features/data/contract.ts";
import { EXPECTED_DATA_IDENTITY, SPECIFICATION_PATHS, validateContext } from "../../src/features/simulation/core/context.ts";
import { requireSimulation } from "../../src/features/simulation/core/errors.ts";
import { canonicalJson } from "../../src/features/simulation/core/serialization.ts";
import type { RunContext, RunResult } from "../../src/features/simulation/core/types.ts";
import { codeProvenance, PROCESSED_DIR, RAW_DIR, ROOT, readBytes, readJson, sha256, verifySourceBytes, verifySourceMetadata } from "../data/io.ts";

function git(args: string[]): Buffer {
  return execFileSync("git", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
}

/** Includes production files, dependencies, config and normative specs; never labels dirty code as a commit. */
async function implementationSnapshot() {
  requireSimulation(git(["rev-parse", "--is-shallow-repository"]).toString().trim() === "false", "INVALID_CONTEXT", "git", "full history required; run git fetch --unshallow");
  const candidates = git(["ls-files", "--cached", "--others", "--exclude-standard", "--",
    "src/features/simulation/core", "src/features/simulation/run.ts", "src/features/simulation/hash.ts", "scripts/simulation/context.ts", "scripts/simulation/verify.ts",
    "src/features/data", "package.json", "package-lock.json", "tsconfig.app.json", "tsconfig.node.json", ...SPECIFICATION_PATHS,
  ]).toString().trim().split("\n");
  const paths = [...new Set(candidates.filter(path => path && !path.endsWith(".test.ts")))].sort();
  const revision = git(["log", "-1", "--format=%H", "--", ...paths]).toString().trim();
  requireSimulation(/^[a-f0-9]{40}$/.test(revision), "INVALID_CONTEXT", "git", "implementation needs a real Git commit");
  const hashes: Record<string, string> = {};
  for (const path of paths) {
    let committed: Buffer;
    try { committed = git(["show", `${revision}:${path}`]); }
    catch { throw new Error(`INVALID_CONTEXT [git]: commit implementation before recording provenance (${path})`); }
    const actual = await readBytes(path);
    requireSimulation(actual.equals(committed), "INVALID_CONTEXT", "git", `${path} differs from ${revision}; commit code before generating results`);
    hashes[path] = sha256(actual);
  }
  return { revision, code_input_sha256: hashes };
}

export async function readExecutionContext() {
  verifySourceBytes(await readBytes(`${RAW_DIR}/${SOURCE.filename}`));
  await verifySourceMetadata();
  const transform = await codeProvenance();
  requireSimulation(transform.transform_git_revision === EXPECTED_DATA_IDENTITY.transform_git_revision, "INVALID_CONTEXT", "data", "phase-4 transform revision changed");
  const artifacts = await readJson(`${PROCESSED_DIR}/artifacts.json`);
  const provenanceBytes = await readBytes(`${PROCESSED_DIR}/provenance.json`);
  const provenance = JSON.parse(provenanceBytes.toString("utf8"));
  requireSimulation(provenance.transform_git_revision === transform.transform_git_revision
    && canonicalJson(provenance.transform_input_sha256) === canonicalJson(transform.transform_input_sha256), "INVALID_CONTEXT", "data", "data provenance differs from committed phase-4 code");
  for (const [name, expected] of [["events.json", EXPECTED_DATA_IDENTITY.normalized_events_sha256], ["taxa.json", EXPECTED_DATA_IDENTITY.taxa_sha256]]) {
    const bytes = await readBytes(`${PROCESSED_DIR}/${name}`);
    const output = (artifacts.outputs as Record<string, { sha256: string; bytes: number }>)[name];
    requireSimulation(output?.sha256 === expected && output.bytes === bytes.length && sha256(bytes) === expected
      && provenance.outputs[name]?.sha256 === expected, "INVALID_CONTEXT", "data", `${name}: fixed normalized artifact hash/size mismatch`);
  }
  const implementation = await implementationSnapshot();
  const specification_sha256 = Object.fromEntries(await Promise.all(SPECIFICATION_PATHS.map(async path => [path, sha256(await readBytes(path))])));
  const context: RunContext = {
    implementation_git_revision: implementation.revision, specification_sha256, data_identity: { ...EXPECTED_DATA_IDENTITY },
  };
  validateContext(context);
  return { context, code_input_sha256: implementation.code_input_sha256, data_provenance_sha256: sha256(provenanceBytes) };
}

export function makeRunProvenance(result: RunResult, snapshot: Awaited<ReturnType<typeof readExecutionContext>>, createdAtUtc: string, runtime: string) {
  requireSimulation(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(createdAtUtc) && !Number.isNaN(Date.parse(createdAtUtc)), "INVALID_CONTEXT", "provenance", "expected explicit UTC timestamp");
  requireSimulation(result.implementation_git_revision === snapshot.context.implementation_git_revision
    && canonicalJson(result.data_identity) === canonicalJson(snapshot.context.data_identity)
    && canonicalJson(result.specification_sha256) === canonicalJson(snapshot.context.specification_sha256), "INVALID_CONTEXT", "provenance", "result and verified execution context differ");
  return {
    result_sha256: sha256(canonicalJson(result)), data_provenance_sha256: snapshot.data_provenance_sha256,
    created_at_utc: createdAtUtc, runtime, code_input_sha256: snapshot.code_input_sha256,
    attribution: {
      creators: SOURCE.creators, title: SOURCE.title, year: 2022, archive_doi: SOURCE.doi, archive_version: SOURCE.version,
      license: SOURCE.license, source_url: SOURCE.url, source_metadata_path: `${RAW_DIR}/source.json`,
      changes: "Source and normalized records unchanged. Single-trial event selection without replacement and verbatim-label binary network summaries derived. UK experiment visits, not pollination success or Japanese grassland condition. No endorsement implied.",
    },
    commands: ["npm run data:check", "npm test", "npm run build", "node scripts/simulation/verify.ts"],
  };
}
