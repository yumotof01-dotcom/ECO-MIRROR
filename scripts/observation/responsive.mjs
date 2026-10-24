import { createRequire } from "node:module";
import { preview } from "vite";
const require = createRequire(
  `${process.env.ECO_QA_NODE_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`,
);
const { chromium } = require("playwright");
const server = await preview({
  preview: { host: "127.0.0.1", port: 5199, strictPort: true },
});
import { mkdir, writeFile } from "node:fs/promises";
const b = await chromium.launch({
    executablePath: process.env.ECO_MIRROR_BROWSER_PATH || undefined,
  }),
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const out = process.env.ECO_OBSERVATION_AUDIT_OUTPUT || "/tmp/eco-v2-audit";
await mkdir(out, { recursive: true });
const report = { checks: [], errors: [] };
p.on("pageerror", (e) => report.errors.push(String(e)));
await p.goto("http://127.0.0.1:5199/");
await p.getByLabel("反復回数").fill("2");
await p
  .getByRole("button", { name: "シミュレーションを実行", exact: true })
  .click();
await p.getByText("試行 0 の結果", { exact: true }).waitFor();
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await p.setViewportSize({ width: w, height: h });
  for (const mode of [
    "observe",
    "compare",
    "records",
    "research",
    "settings",
  ]) {
    if (await p.getByRole("dialog", { name: "観測条件の詳細設定" }).isVisible())
      await p.getByRole("button", { name: "条件設定を閉じる ×" }).click();
    if (mode === "settings")
      await p
        .getByRole("navigation", { name: "メインナビゲーション" })
        .getByRole("link", { name: "シミュレーション", exact: true })
        .click();
    else if (mode === "research")
      await p
        .getByRole("navigation", { name: "メインナビゲーション" })
        .getByRole("link", { name: "研究情報", exact: true })
        .click();
    else if (mode === "observe")
      await p
        .getByRole("navigation", { name: "メインナビゲーション" })
        .getByRole("link", { name: "ホーム", exact: true })
        .click();
    else
      await p
        .getByRole("navigation", { name: "観測モード" })
        .getByRole("link", {
          name: mode === "compare" ? "比較" : "記録",
          exact: true,
        })
        .click();
    await p.waitForURL(
      mode === "settings"
        ? "**/simulation"
        : mode === "research"
          ? "**/research"
          : mode === "observe"
            ? "**/"
            : mode === "compare"
              ? "**/results"
              : "**/results?mode=records",
    );
    await p.waitForTimeout(100);
    await p.addScriptTag({
      path:
        process.env.ECO_AXE_PATH ||
        "/tmp/eco-audit-qa/node_modules/axe-core/axe.min.js",
    });
    const violations = await p.evaluate(async () =>
      (
        await axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    report.checks.push({ w, h, mode, overflow, violations });
  }
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    report.checks.map((c) => ({
      w: c.w,
      mode: c.mode,
      overflow: c.overflow,
      violations: c.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.slice(0, 2),
      })),
    })),
  ),
);
await b.close();
await new Promise((r) => server.httpServer.close(r));
if (
  report.errors.length ||
  report.checks.some((c) => c.overflow || c.violations.length)
)
  process.exitCode = 1;
