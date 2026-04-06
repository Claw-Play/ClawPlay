import { render, screen, act, fireEvent } from "@testing-library/react";
import { HomeClient } from "../HomeClient";
import { TestWrapper } from "../../test-utils";

describe("HomeClient", () => {
  beforeEach(() => {
    // document.execCommand is not available in jsdom — define it manually
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });
  });

  it("renders the setup section with heading", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    expect(screen.getByText("🦐 一键安装 CLI")).toBeInTheDocument();
  });

  it("renders the CLI command code block", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    expect(
      screen.getByText("npm install -g clawplay && clawplay setup")
    ).toBeInTheDocument();
  });

  it("Copy button shows '复制' initially", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    expect(
      screen.getByRole("button", { name: "复制" })
    ).toBeInTheDocument();
  });

  it("clicking Copy calls document.execCommand('copy')", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    const btn = screen.getByRole("button", { name: "复制" });
    fireEvent.click(btn);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("clicking Copy changes button text to '✅ 已复制！'", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    const btn = screen.getByRole("button", { name: "复制" });
    fireEvent.click(btn);
    expect(
      screen.getByRole("button", { name: /已复制/ })
    ).toBeInTheDocument();
  });

  it("button resets to '复制' after 2 seconds", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<HomeClient />, { wrapper: TestWrapper });
    const btn = screen.getByRole("button", { name: "复制" });
    fireEvent.click(btn);

    // Should show 已复制 immediately
    expect(screen.getByRole("button", { name: /已复制/ })).toBeInTheDocument();

    // Advance time by 2+ seconds
    act(() => {
      vi.advanceTimersByTime(2001);
    });

    // Should be reset to 复制
    expect(
      screen.getByRole("button", { name: "复制" })
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("multiple clicks before timeout reset the timer", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<HomeClient />, { wrapper: TestWrapper });
    const copyBtn = screen.getByRole("button", { name: "复制" });

    // Click once — shows 已复制
    fireEvent.click(copyBtn);
    expect(screen.getByRole("button", { name: /已复制/ })).toBeInTheDocument();

    // Advance 1.5s — still within 2s window, still 已复制
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByRole("button", { name: /已复制/ })).toBeInTheDocument();

    // Click again — resets the timer
    fireEvent.click(copyBtn);
    expect(screen.getByRole("button", { name: /已复制/ })).toBeInTheDocument();

    // Advance 1.5s from second click — original timer would have fired (3s from start),
    // but debounce reset means it should NOT reset yet (only 1.5s since second click)
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByRole("button", { name: /已复制/ })).toBeInTheDocument();

    // Advance another 600ms — now 2.1s since second click, timer should fire
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();

    vi.useRealTimers();
  });
});
