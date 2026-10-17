// @vitest-environment node
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { ROOT } from "../data/io.ts";

it("replays saved verification bytes through native Node, the actual phase-4 loader and the committed implementation", () => {
  const output = execFileSync(process.execPath, ["scripts/simulation/verify.ts"], { cwd: ROOT, encoding: "utf8", timeout: 20000 });
  expect(output).toContain("PASS: official data 100% audit; identical single-trial bytes; saved 50% developer verification checked.");
}, 25000);
