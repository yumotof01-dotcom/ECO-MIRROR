import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readExecutionContext } from "../simulation/context.ts";
import { ROOT } from "../data/io.ts";

const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const digest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
export async function readBrowserMetadata() {
  let snapshot: Awaited<ReturnType<typeof readExecutionContext>>;
  try { snapshot = await readExecutionContext(); }
  catch (error) {
    return { version: 1, verification: "unverified", reason: `計算来歴を確認できません：${String(error)}`, context: null, code_input_sha256: {}, data_provenance_sha256: null, application_git_revision: null, application_input_sha256: {} };
  }
  const paths = git("ls-files", "--cached", "--others", "--exclude-standard", "--", "src", "scripts/browser", "vite.config.ts", "index.html")
    .split("\n").filter(path => path && !/\.test\.[cm]?[jt]sx?$/.test(path) && !path.startsWith("src/test/") && !path.startsWith("src/dev/"))
    .sort();
  const revision = git("log", "-1", "--format=%H", "--", ...paths);
  const hashes: Record<string, string> = {};
  let reason: string | null = null;
  for (const path of paths) {
    const actual = await readFile(resolve(ROOT, path)); hashes[path] = digest(actual);
    try {
      const committed = execFileSync("git", ["show", `${revision}:${path}`], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      if (!actual.equals(committed)) reason = `アプリ実装が未コミットです：${path}`;
    } catch { reason = `アプリ実装を先にコミットしてください：${path}`; }
  }
  return { version: 1, verification: reason ? "unverified" : "verified", reason, context: snapshot.context, code_input_sha256: snapshot.code_input_sha256, data_provenance_sha256: snapshot.data_provenance_sha256, application_git_revision: /^[a-f0-9]{40}$/.test(revision) ? revision : null, application_input_sha256: hashes };
}
