import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type {
  WorkerPort,
  WorkerRequest,
  WorkerResponse,
} from "../features/execution/protocol";
import { historicalPayload } from "../test/execution-fixtures";

class ControlledWorker implements WorkerPort {
  onmessage: WorkerPort["onmessage"] = null;
  onerror: WorkerPort["onerror"] = null;
  onmessageerror: WorkerPort["onmessageerror"] = null;
  requests: WorkerRequest[] = [];
  stopped = false;
  postMessage(value: WorkerRequest) {
    this.requests.push(value);
  }
  terminate() {
    this.stopped = true;
  }
  emit(value: WorkerResponse) {
    act(() =>
      this.onmessage?.({ data: value } as MessageEvent<WorkerResponse>),
    );
  }
}
function setup() {
  const workers: ControlledWorker[] = [];
  render(
    <MemoryRouter initialEntries={["/simulation"]}>
      <App
        workerFactory={() => {
          const worker = new ControlledWorker();
          workers.push(worker);
          return worker;
        }}
      />
    </MemoryRouter>,
  );
  return workers;
}
const nav = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "メインナビゲーション" }),
    ).getByRole("link", { name }),
  );
const run = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "シミュレーションを実行" }),
  );
const configureThree = () =>
  fireEvent.change(screen.getByLabelText("反復回数"), {
    target: { value: "3" },
  });

describe("input → request → result lifecycle", () => {
  it("shows no fabricated values while running and retains the real computed result across navigation", () => {
    const workers = setup();
    configureThree();
    run();
    expect(
      screen.getByRole("heading", { name: "実データを読み込んでいます。" }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("選択中の試行の主要指標"),
    ).not.toBeInTheDocument();
    workers[0].emit({
      type: "phase",
      run_id: 1,
      phase: "running",
      message: "計算中",
    });
    expect(screen.queryByRole("img", { name: /分布/ })).not.toBeInTheDocument();
    workers[0].emit({ type: "ready", run_id: 1, payload: historicalPayload() });
    const metrics = screen.getByLabelText("選択中の試行の主要指標");
    expect(metrics).toHaveTextContent("1,941件");
    expect(metrics).toHaveTextContent("183組");
    expect(metrics).toHaveTextContent("74組");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "観測モード" })).getByRole(
        "link",
        { name: "記録" },
      ),
    );
    expect(
      screen.getByRole("region", { name: "全7指標の統計サマリー" }),
    ).toBeVisible();
    nav("研究情報");
    nav("分析結果");
    expect(screen.getByLabelText("選択中の試行の主要指標")).toHaveTextContent(
      "183組",
    );
  });
  it("labels earlier conditions as stale, and rerun restores and executes exactly those conditions", () => {
    const workers = setup();
    configureThree();
    run();
    workers[0].emit({ type: "ready", run_id: 1, payload: historicalPayload() });
    nav("シミュレーション");
    fireEvent.change(screen.getByLabelText("観測割合"), {
      target: { value: "80" },
    });
    nav("分析結果");
    expect(
      screen.getByText(/現在表示している結果は、以前の条件/),
    ).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "観測モード" })).getByRole(
        "link",
        { name: "記録" },
      ),
    );
    expect(screen.getByText("50% / 50.00%")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "この条件で再実行" }));
    expect(workers[0].stopped).toBe(true);
    expect(workers[1].requests[0]).toMatchObject({
      type: "start",
      input: { request: { rate_percent: 50, repetitions: 3 } },
    });
    nav("シミュレーション");
    expect(screen.getByLabelText("観測割合")).toHaveValue("50");
  });
  it("cancels immediately when input changes and never accepts a captured old completion", () => {
    const workers = setup();
    configureThree();
    run();
    const old = workers[0].onmessage!;
    nav("シミュレーション");
    fireEvent.change(screen.getByLabelText("乱数シード"), {
      target: { value: "99" },
    });
    expect(workers[0].stopped).toBe(true);
    act(() =>
      old({
        data: { type: "ready", run_id: 1, payload: historicalPayload() },
      } as MessageEvent<WorkerResponse>),
    );
    nav("分析結果");
    expect(
      screen.getByRole("heading", { name: "処理を中止しました。" }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("選択中の試行の主要指標"),
    ).not.toBeInTheDocument();
  });
  it("explicitly sends the selected plot, treatment and year-specific round, without implicit all", () => {
    const workers = setup();
    fireEvent.click(screen.getByLabelText("2014年"));
    expect(screen.queryByLabelText("2015年 Round 2")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("2014年 Round 2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "全区画を解除" }));
    expect(
      screen.getByRole("button", { name: "シミュレーションを実行" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Plot 3", { exact: true }));
    for (const name of ["Control", "Heat", "Heat+Water"])
      fireEvent.click(screen.getByLabelText(name, { exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "2014年の調査回を解除" }),
    );
    fireEvent.click(screen.getByLabelText("2014年 Round 1"));
    configureThree();
    run();
    expect(workers[0].requests[0]).toMatchObject({
      input: {
        request: {
          selection: {
            years: [2014],
            plot_ids: ["3"],
            treatments: ["Water"],
            rounds_by_year: { 2014: ["1"] },
          },
        },
      },
    });
  });
  it("keeps loader failures and explicit cancellation distinct from successful zero extraction", () => {
    const workers = setup();
    configureThree();
    run();
    workers[0].emit({
      type: "error",
      run_id: 1,
      stage: "run",
      message: "ARTIFACT_HASH mismatch",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("ARTIFACT_HASH");
    expect(
      screen.queryByLabelText("選択中の試行の主要指標"),
    ).not.toBeInTheDocument();
    nav("シミュレーション");
    run();
    fireEvent.click(screen.getByRole("button", { name: "計算を中止" }));
    expect(
      screen.getByRole("heading", { name: "処理を中止しました。" }),
    ).toBeVisible();
  });
});
