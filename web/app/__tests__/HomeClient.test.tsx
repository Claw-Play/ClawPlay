import { render, screen, act, fireEvent } from "@testing-library/react";
import { HomeClient } from "../HomeClient";

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
    render(<HomeClient />);
    expect(screen.getByText("🦐 One-click CLI setup")).toBeInTheDocument();
  });

  it("renders the CLI command code block", () => {
    render(<HomeClient />);
    expect(
      screen.getByText("npm install -g clawplay && clawplay setup")
    ).toBeInTheDocument();
  });

  it("Copy button shows 'Copy' initially", () => {
    render(<HomeClient />);
    expect(
      screen.getByRole("button", { name: /copy/i })
    ).toBeInTheDocument();
  });

  it("clicking Copy calls document.execCommand('copy')", () => {
    render(<HomeClient />);
    const btn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(btn);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("clicking Copy changes button text to 'Copied!'", () => {
    render(<HomeClient />);
    const btn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(btn);
    expect(
      screen.getByRole("button", { name: /copied/i })
    ).toBeInTheDocument();
  });

  it("button resets to 'Copy' after 2 seconds", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<HomeClient />);
    const btn = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(btn);

    // Should show Copied! immediately
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Advance time by 2+ seconds
    act(() => {
      vi.advanceTimersByTime(2001);
    });

    // Should be reset to Copy
    expect(
      screen.getByRole("button", { name: /copy/i })
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("multiple clicks before timeout reset the timer", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(<HomeClient />);
    const copyBtn = screen.getByRole("button", { name: /copy/i });

    // Click once — shows Copied!
    fireEvent.click(copyBtn);
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Advance 1.5s — still within 2s window, still Copied!
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Click again — resets the timer
    fireEvent.click(copyBtn);
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Advance 1.5s from second click — original timer would have fired (3s from start),
    // but debounce reset means it should NOT reset yet (only 1.5s since second click)
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    // Advance another 600ms — now 2.1s since second click, timer should fire
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();

    vi.useRealTimers();
  });
});
