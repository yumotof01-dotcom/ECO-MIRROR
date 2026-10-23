// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readBrowserMetadata } from "./metadata.ts";
import { readExecutionContext } from "../simulation/context.ts";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { ROOT, sha256 } from "../data/io.ts";

describe("browser provenance from actual Git and bytes", () => {
  it("retains the exact verified computation context and hashes real application inputs", async () => {
    const [metadata, core] = await Promise.all([readBrowserMetadata(), readExecutionContext()]);
    expect(metadata.context).toEqual(core.context);
    expect(metadata.data_provenance_sha256).toBe(core.data_provenance_sha256);
    expect(metadata.application_input_sha256).toHaveProperty("src/features/execution/worker.ts");
    for (const [path, hash] of Object.entries(metadata.application_input_sha256)) expect(sha256(await readFile(`${ROOT}/${path}`))).toBe(hash);
    if (metadata.verification === "verified") {
      expect(metadata.reason).toBeNull();
      expect(execFileSync("git", ["cat-file", "-t", metadata.application_git_revision!], { cwd: ROOT, encoding: "utf8" }).trim()).toBe("commit");
      for (const [path, hash] of Object.entries(metadata.application_input_sha256)) expect(sha256(execFileSync("git", ["show", `${metadata.application_git_revision}:${path}`], { cwd: ROOT }))).toBe(hash);
    } else expect(metadata.reason).toMatch(/未コミット|コミット/);
  });
});
