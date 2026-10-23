import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function navigate(label: string) {
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "メインナビゲーション" }),
    ).getByRole("link", { name: label }),
  );
}

describe("ECO MIRRORの画面基盤", () => {
  it("説明図を実データと区別し、ホームから条件画面へ移動できる", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "見えている自然が、すべてとは限らない。",
    );
    expect(
      screen.getByText("説明用イラスト · 実データではありません"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "観測条件を見てみる" }));
    expect(
      screen.getByRole("form", { name: "観測条件の下書き" }),
    ).toBeVisible();
    expect(document.title).toBe("シミュレーション | ECO MIRROR");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it.each([
    ["/simulation", "観測条件を、組み立てる。", "シミュレーション"],
    ["/results", "見え方の違いを、読み解く。", "分析結果"],
    ["/research", "根拠と、限界をたどる。", "研究情報"],
  ])("%s を直接開けて、現在地を表示する", (path, title, label) => {
    renderApp(path);
    expect(
      screen.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("navigation")).getByRole("link", { name: label }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("条件の下書きを画面間で保持し、初期値に戻せる", () => {
    renderApp("/simulation");
    fireEvent.change(screen.getByLabelText("観測割合"), {
      target: { value: "75" },
    });
    fireEvent.change(screen.getByLabelText("反復回数"), {
      target: { value: "250" },
    });
    fireEvent.change(screen.getByLabelText("乱数シード"), {
      target: { value: "123" },
    });
    navigate("分析結果");
    expect(screen.getByText("分析結果はまだありません。")).toBeVisible();
    navigate("シミュレーション");
    expect(screen.getByLabelText("観測割合")).toHaveValue("75");
    expect(screen.getByLabelText("反復回数")).toHaveValue(250);
    expect(screen.getByLabelText("乱数シード")).toHaveValue(123);
    fireEvent.click(screen.getByRole("button", { name: "初期値に戻す" }));
    expect(screen.getByLabelText("観測割合")).toHaveValue("50");
    expect(screen.getByLabelText("反復回数")).toHaveValue(100);
    expect(screen.getByLabelText("乱数シード")).toHaveValue(42);
  });

  it("空欄・小数・範囲外の入力を示し、入力しても計算を有効にしない", () => {
    renderApp("/simulation");
    const repetitions = screen.getByLabelText("反復回数");
    for (const value of ["", "0", "1.5", "1001"]) {
      fireEvent.change(repetitions, { target: { value } });
      expect(repetitions).toHaveAttribute("aria-invalid", "true");
    }
    fireEvent.change(repetitions, { target: { value: "1" } });
    expect(repetitions).toHaveAttribute("aria-invalid", "false");
    const seed = screen.getByLabelText("乱数シード");
    for (const value of ["", "-1", "0.5", "4294967296"]) {
      fireEvent.change(seed, { target: { value } });
      expect(seed).toHaveAttribute("aria-invalid", "true");
    }
    fireEvent.change(seed, { target: { value: "0" } });
    expect(seed).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.getByRole("combobox", { name: "使用するデータセット" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "シミュレーションを実行" }),
    ).toBeDisabled();
  });

  it("分析画面を直接開いても、未実行をゼロの結果として扱わない", () => {
    renderApp("/results");
    expect(screen.getByText("未実行")).toBeVisible();
    expect(screen.getByText("分析結果はまだありません。")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "結果を書き出す" }),
    ).toBeDisabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("main").querySelector('canvas, svg[role="img"]'),
    ).toBeNull();
  });

  it("研究情報でデータが未接続であることと、出典を確認できる", () => {
    renderApp("/research");
    expect(
      screen.getByText(/現在、アプリに接続済みのデータセットはありません/),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /^Web of Life/ })).toHaveAttribute(
      "href",
      "https://www.web-of-life.es/",
    );
    expect(
      screen.getByRole("link", { name: /^Evaluating sampling completeness/ }),
    ).toHaveAttribute(
      "href",
      "https://doi.org/10.1111/j.1365-2656.2011.01883.x",
    );
  });

  it("不明なURLからホームに復帰できる", () => {
    renderApp("/unknown");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "ページが見つかりません。",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "ホームへ戻る" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "見えている自然が、すべてとは限らない。",
    );
  });
});
