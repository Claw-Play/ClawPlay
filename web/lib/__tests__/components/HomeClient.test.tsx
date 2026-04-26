import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomeClient } from "../../../app/HomeClient";
import { TestWrapper } from "../../../test-utils";
import zhMessages from "../../../messages/zh.json";

describe("HomeClient", () => {
  it("renders the setup section with heading", () => {
    render(<HomeClient />, { wrapper: TestWrapper });
    expect(screen.getByRole("button", { name: "通过对话安装" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(zhMessages.home_cli.chat_install_text)).toBeInTheDocument();
  });

  it("switching to command-line mode updates the command", () => {
    render(<HomeClient />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByRole("button", { name: "命令行安装" }));

    expect(screen.getByRole("button", { name: "命令行安装" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(zhMessages.home_cli.cli_install_text)).toBeInTheDocument();
  });
});
