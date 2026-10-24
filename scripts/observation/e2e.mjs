/** Real browser + existing Worker/data/core. Reports go outside the checkout by default. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
const require = createRequire(
  `${process.env.ECO_QA_NODE_MODULES || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`,
);
const { chromium } = require("playwright");
const output = process.env.ECO_OBSERVATION_OUTPUT || "/tmp/eco-observation-v2";
await mkdir(output, { recursive: true });
const report = {
  status: "running",
  source_revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  checks: [],
  runs: [],
  errors: [],
  screenshots: [],
  limitations: [
    "Chromium automated touch/pinch is not physical iPad/Safari or VoiceOver validation.",
    "Timing and resource counters do not prove peak memory or low-memory safety.",
  ],
};
const server = await preview({
  preview: { host: "127.0.0.1", port: 5197, strictPort: true },
});
let browser;
const hash = async (file) => {
  const h = createHash("sha256");
  for await (const part of createReadStream(file)) h.update(part);
  return h.digest("hex");
};
try {
  browser = await chromium.launch({
    executablePath: process.env.ECO_MIRROR_BROWSER_PATH || undefined,
  });
  report.browser = await browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    hasTouch: true,
  });
  const p = await context.newPage();
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => report.errors.push(String(e)));
  await p.addInitScript(() => {
    const W = Worker;
    window.__ob = { workers: 0, urls: [], events: [], gaps: [] };
    window.Worker = class extends W {
      constructor(...a) {
        super(...a);
        window.__ob.workers++;
        this.stopped = false;
        this.addEventListener("message", (e) => {
          if (e.data.type === "ready")
            window.__ob.events.push({
              type: "ready",
              ms: e.data.payload.calculation_ms,
              bytes: e.data.payload.ui_payload_bytes,
              verification: e.data.payload.metadata.verification,
            });
        });
      }
      terminate() {
        if (!this.stopped) {
          window.__ob.workers--;
          this.stopped = true;
        }
        super.terminate();
      }
    };
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (b) => {
      const u = create(b);
      window.__ob.urls.push(u);
      return u;
    };
    URL.revokeObjectURL = (u) => {
      window.__ob.urls = window.__ob.urls.filter((v) => v !== u);
      return revoke(u);
    };
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      window.__ob.gaps.push(now - last);
      last = now;
    }, 50);
  });
  const nav = (name) =>
    p
      .getByRole("navigation", { name: "メインナビゲーション" })
      .getByRole("link", { name, exact: true })
      .click();
  const mode = (name) =>
    p
      .getByRole("navigation", { name: "観測モード" })
      .getByRole("link", { name, exact: true })
      .click();
  const coords = () =>
    p
      .locator("[data-scene-node]")
      .evaluateAll((ns) =>
        ns.map((n) => [n.dataset.sceneNode, n.dataset.x, n.dataset.y]),
      );
  const transform = () =>
    p.locator("[data-scene-transform]").getAttribute("data-scene-transform");
  const settle = () =>
    p.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
  const shot = async (name) => {
    await settle();
    await p.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    report.screenshots.push(`${name}.png`);
  };
  async function configure({
    R = 100,
    rate = 50,
    modeValue = "repeated_trials",
  } = {}) {
    await nav("ホーム");
    await p.getByLabel("実行モード", { exact: true }).selectOption(modeValue);
    if (modeValue === "repeated_trials")
      await p.getByLabel("反復回数", { exact: true }).fill(String(R));
    await p.getByLabel("乱数シード", { exact: true }).fill("42");
    const slider = p.getByLabel("観測割合", { exact: true });
    await slider.press("Home");
    if (rate === 100) await slider.press("End");
    else for (let i = 0; i < rate; i++) await slider.press("ArrowRight");
  }
  async function run(name) {
    const t = performance.now();
    await p
      .getByRole("button", { name: "シミュレーションを実行", exact: true })
      .click();
    await p
      .getByText("試行 0 の結果", { exact: true })
      .waitFor({ timeout: 180000 });
    await settle();
    const meta = await p.evaluate(() => window.__ob.events.at(-1));
    assert.equal(meta.verification, "verified");
    report.runs.push({
      name,
      click_to_result_ms: performance.now() - t,
      ...meta,
    });
  }
  async function save(name, expected) {
    await mode("記録");
    await p
      .getByRole("button", { name: "保存ファイルを準備", exact: true })
      .click();
    await p
      .getByRole("link", { name: "正式JSONを保存", exact: true })
      .waitFor({ timeout: 120000 });
    const paths = {};
    for (const [label, key] of [
      ["正式JSONを保存", "result"],
      ["来歴JSONを保存", "provenance"],
      ["試行別CSVを保存", "csv"],
    ]) {
      const wait = p.waitForEvent("download");
      await p.getByRole("link", { name: label, exact: true }).click();
      const d = await wait;
      assert.equal(await d.failure(), null);
      const path = `${output}/${name}-${key}.${key === "csv" ? "csv" : "json"}`;
      await d.saveAs(path);
      paths[key] = path;
    }
    const digest = await hash(paths.result),
      provenance = JSON.parse(await readFile(paths.provenance));
    assert.equal(digest, provenance.result_sha256);
    if (expected) assert.equal(digest, expected);
    const csv = await readFile(paths.csv, "utf8");
    assert.ok(csv.endsWith("\r\n"));
    assert.equal(csv.replaceAll("\r\n", "").includes("\n"), false);
    report.runs.at(-1).export = {
      sha256: digest,
      bytes: (await import("node:fs/promises")).stat
        ? (await (await import("node:fs/promises")).stat(paths.result)).size
        : null,
      csv_rows: csv.split("\r\n").length - 2,
    };
    return paths;
  }
  await p.goto("http://127.0.0.1:5197/");
  assert.equal(await p.locator("[data-scene-node]").count(), 0);
  assert.equal(await p.getByLabel("選択中の試行の主要指標").count(), 0);
  report.checks.push("idle has no fabricated network or metrics");
  await shot("home-desktop");
  await p.getByLabel("乱数シード").fill("1e2");
  assert.equal(
    await p
      .getByRole("button", { name: "シミュレーションを実行" })
      .isDisabled(),
    true,
  );
  await p.getByLabel("乱数シード").fill("42");
  await run("R100-p50");
  assert.match(
    await p.getByLabel("選択中の試行の主要指標").innerText(),
    /183組/,
  );
  const initial = await coords();
  assert.equal(initial.length, 124);
  assert.equal(await p.locator("[data-scene-link]").count(), 257);
  assert.equal(await p.locator('[data-missing="true"]').count(), 74);
  await shot("comparison-desktop");
  const first = p.locator("[data-scene-node]").first();
  await first.focus();
  await p.keyboard.press("Enter");
  await p.getByRole("complementary", { name: "選択ノードの詳細" }).waitFor();
  await p.getByRole("button", { name: "相手", exact: true }).click();
  assert.ok(await p.locator(".partner-list li").count());
  await shot("node-detail");
  await p.getByRole("button", { name: "詳細を閉じる" }).click();
  for (const label of ["全観測", "差分", "抽出後"]) {
    await p.getByRole("button", { name: label, exact: true }).click();
    assert.deepEqual(await coords(), initial);
  }
  report.checks.push(
    "comparison modes preserve all 124 positions and all 257 pairs",
  );
  await p.getByLabel("表示する試行番号", { exact: true }).selectOption("99");
  await p.getByText("試行 99 の結果", { exact: true }).waitFor();
  assert.deepEqual(await coords(), initial);
  const readyCount = await p.evaluate(() => window.__ob.events.length);
  await p.getByRole("searchbox").fill("Bombus");
  await p.getByText(/件一致/).waitFor();
  assert.equal(await p.locator("[data-scene-link]").count(), 257);
  await p.getByRole("searchbox").fill("");
  const metrics = await p.getByLabel("選択中の試行の主要指標").innerText();
  await p.getByRole("button", { name: "拡大", exact: true }).click();
  assert.notEqual(await transform(), "0,0,1");
  await p.getByRole("button", { name: "表示をリセット" }).click();
  assert.equal(await transform(), "0,0,1");
  const canvas = p.getByRole("group", { name: "植物と昆虫の訪花ネットワーク" });
  await canvas.scrollIntoViewIfNeeded();
  let rect = await canvas.boundingBox();
  await p.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.45);
  await p.mouse.down();
  await p.mouse.move(
    rect.x + rect.width * 0.5 + 60,
    rect.y + rect.height * 0.45 + 30,
    { steps: 8 },
  );
  await p.mouse.up();
  assert.notEqual(await transform(), "0,0,1");
  await p.getByRole("button", { name: "表示をリセット" }).click();
  const cdp = await context.newCDPSession(p);
  rect = await canvas.boundingBox();
  const cx = rect.x + rect.width * 0.5,
    cy = rect.y + rect.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 40, y: cy, id: 1 },
      { x: cx + 40, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 80, y: cy, id: 1 },
      { x: cx + 80, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await settle();
  assert.ok(Number((await transform()).split(",")[2]) > 1);
  assert.equal(
    await p.getByRole("complementary", { name: "選択ノードの詳細" }).count(),
    0,
  );
  await p.getByRole("button", { name: "表示をリセット" }).click();
  await canvas.focus();
  await p.keyboard.press("+");
  await p.keyboard.press("0");
  assert.equal(await transform(), "0,0,1");
  assert.equal(
    await p.getByLabel("選択中の試行の主要指標").innerText(),
    metrics,
  );
  assert.equal(await p.evaluate(() => window.__ob.events.length), readyCount);
  report.checks.push(
    "search, mouse pan, CDP two-finger pinch, keyboard zoom and reset do not recompute or alter results",
  );
  await p.getByLabel("表示する試行番号", { exact: true }).selectOption("0");
  await p.getByText("試行 0 の結果", { exact: true }).waitFor();
  for (const [w, h, name] of [
    [320, 568, "small-phone"],
    [390, 844, "phone"],
    [768, 1024, "tablet-portrait"],
    [1024, 768, "tablet-landscape"],
    [1440, 900, "desktop"],
    [1920, 1080, "wide-desktop"],
  ]) {
    await p.setViewportSize({ width: w, height: h });
    await settle();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert.deepEqual(await coords(), initial);
    await shot(`comparison-${name}`);
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await mode("観測");
  assert.equal(await p.locator("[data-scene-node]").count(), 124);
  await mode("比較");
  await save(
    "R100",
    "723647a1068328e6b038de381a25b1cb42ba4190d62d9ab374c974e95b2f1880",
  );
  await p.getByRole("region", { name: "全7指標の統計サマリー" }).waitFor();
  report.checks.push(
    "records retains exact statistics, legacy bipartite comparison and three real downloads",
  );
  await shot("records-desktop");
  for (const rate of [0, 100, 50]) {
    await configure({ rate, modeValue: "single_trial" });
    await run(`single-${rate}`);
    assert.equal(
      await p.locator('[data-missing="true"]').count(),
      rate === 0 ? 257 : rate === 100 ? 0 : 74,
    );
    const paths = await save(
      `single-${rate}`,
      rate === 50
        ? "c7a9d45480d42834bdee569d94af0441b4e78a95e8d0452b552a63fcfb42fe45"
        : null,
    );
    const value = JSON.parse(await readFile(paths.result));
    assert.equal(
      value.trials[0].sample.event_count,
      rate === 0 ? 0 : rate === 100 ? 3882 : 1941,
    );
    assert.equal(
      value.trials[0].sample.pair_count,
      rate === 0 ? 0 : rate === 100 ? 257 : 183,
    );
  }
  await nav("シミュレーション");
  const form = p.getByRole("form", { name: "観測条件", exact: true });
  await form.getByLabel("2014年", { exact: true }).check();
  await form.getByRole("button", { name: "全区画を解除", exact: true }).click();
  await form.getByLabel("Plot 3", { exact: true }).check();
  for (const name of ["Control", "Heat", "Heat+Water"])
    await form.getByLabel(name, { exact: true }).uncheck();
  await form.getByRole("button", { name: "2014年の調査回を解除" }).click();
  await form.getByLabel("2014年 Round 1", { exact: true }).check();
  await form
    .getByRole("button", { name: "シミュレーションを実行", exact: true })
    .click();
  await p
    .getByRole("heading", {
      name: "選択範囲に観測記録がありません。",
      exact: true,
    })
    .waitFor();
  assert.equal(await p.locator("[data-scene-node]").count(), 0);
  assert.equal(await p.getByLabel("選択中の試行の主要指標").count(), 0);
  report.checks.push("empty_scope is not successful zero extraction");
  await nav("シミュレーション");
  await p.getByRole("button", { name: "初期値に戻す" }).click();
  await p.getByRole("button", { name: "条件設定を閉じる ×" }).click();
  await configure({ R: 1000 });
  await run("R1000-p50");
  await save(
    "R1000",
    "083873fbd56b8b3a7fb30c876a86c878252d18583b906c4354bfe85286c29ab8",
  );
  await configure({ R: 1000 });
  await p
    .getByRole("button", { name: "シミュレーションを実行", exact: true })
    .click();
  await p.getByRole("button", { name: "計算を中止", exact: true }).click();
  await p.getByRole("heading", { name: "処理を中止しました。" }).waitFor();
  assert.equal(await p.evaluate(() => window.__ob.workers), 0);
  assert.equal(await p.evaluate(() => window.__ob.urls.length), 0);
  report.checks.push(
    "cancel terminates current Worker and revokes all saved URLs",
  );
  await configure({ R: 2 });
  await run("recovery-R2");
  await mode("記録");
  await p.getByRole("button", { name: "この条件で再実行" }).click();
  await p
    .getByRole("heading", { name: "試行 0 の結果", exact: true })
    .waitFor();
  await p.reload();
  await p
    .getByRole("heading", { name: "分析結果はまだありません。", exact: true })
    .waitFor();
  await context.route("**/assets/events-*.js", (r) => r.abort("failed"));
  await nav("ホーム");
  await p.getByRole("button", { name: "シミュレーションを実行" }).click();
  await p
    .getByRole("heading", { name: "処理を完了できませんでした。" })
    .waitFor();
  assert.equal(await p.locator("[data-scene-node]").count(), 0);
  await context.unroute("**/assets/events-*.js");
  await configure({ R: 2 });
  await run("network-error-recovery");
  report.checks.push(
    "real data-asset failure is visible, recovery succeeds, rerun restores conditions and reload clears memory",
  );
  assert.deepEqual(report.errors, []);
  report.max_heartbeat_gap_ms = await p.evaluate(() =>
    Math.max(...window.__ob.gaps),
  );
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.failure = String(e);
  throw e;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      runs: report.runs,
      errors: report.errors,
      failure: report.failure,
    }),
  );
  await browser?.close();
  await new Promise((r) => server.httpServer.close(r));
}
