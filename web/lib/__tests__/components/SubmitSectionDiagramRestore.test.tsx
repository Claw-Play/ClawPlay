import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubmitSection from "../../../components/submit/submit-section";

vi.mock("../../../components/SkillDiagramPreview", () => ({
  normalizeMermaidCode: (code: string) => code.replace(/^```mermaid\s*([\s\S]*?)```\s*$/i, "$1").trim(),
  validateMermaidCode: vi.fn(async (code: string) => ({
    ok: !code.includes("broken"),
  })),
  default: ({ initialMermaid }: { initialMermaid?: string }) => (
    <div data-testid="diagram-preview">{initialMermaid ?? ""}</div>
  ),
}));

describe("SubmitSection diagram restore", () => {
  it("hides the workflow editor before the first SKILL.md save", () => {
    render(
      <SubmitSection
        t={(key) => key}
        skillSaved={false}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={""}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("diagram-preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "wizard_generate_diagram" })).toBeDisabled();
  });

  it("does not render a blank workflow panel while the first diagram is generating", async () => {
    const pendingFetch = new Promise<Response>(() => {});
    const fetchMock = vi.fn(() => pendingFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SubmitSection
        t={(key) => key}
        skillSaved={true}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={""}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByText("diagram_loading").length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });

  it("renders the restored diagram immediately when initial mermaid is provided", async () => {
    render(
      <SubmitSection
        t={(key) => key}
        skillSaved={true}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={"flowchart LR\nA-->B"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/flowchart LR\s+A--?>B/);
      expect(screen.getByRole("button", { name: "wizard_regenerate_diagram" })).toBeInTheDocument();
    });
  });

  it("switches between preview and edit states and saves diagram edits", async () => {
    render(
      <SubmitSection
        t={(key) => key}
        skillSaved={true}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={"flowchart LR\nA-->B"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/A--?>B/);
    });

    fireEvent.click(screen.getByRole("button", { name: "wizard_edit" }));

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("flowchart LR\nA-->B");

    fireEvent.change(textarea, { target: { value: "flowchart LR\nA-->C" } });
    fireEvent.click(screen.getByRole("button", { name: "wizard_save" }));

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/A--?>C/);
      expect(screen.getByRole("button", { name: "wizard_edit" })).toBeInTheDocument();
    });
  });

  it("keeps edit mode and shows an error when mermaid syntax is invalid", async () => {
    render(
      <SubmitSection
        t={(key) => key}
        skillSaved={true}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={"flowchart LR\nA-->B"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/A--?>B/);
    });

    fireEvent.click(screen.getByRole("button", { name: "wizard_edit" }));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "broken diagram" } });
    fireEvent.click(screen.getByRole("button", { name: "wizard_save" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("broken diagram");
      expect(screen.getByText("wizard_live_validation_errors_prefix 1")).toBeInTheDocument();
      expect(screen.getByText("Mermaid: diagram_syntax_error")).toBeInTheDocument();
    });
  });

  it("keeps the generated diagram visible when SKILL.md changes", async () => {
    const { rerender } = render(
      <SubmitSection
        t={(key) => key}
        skillSaved={true}
        skillMdContent={"---\nname: Demo\ndescription: Demo\n---\n# Demo"}
        initialDiagramMermaid={"flowchart LR\nA-->B"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/A--?>B/);
    });

    rerender(
      <SubmitSection
        t={(key) => key}
        skillSaved={false}
        skillMdContent={"---\nname: Demo\ndescription: Updated\n---\n# Demo"}
        initialDiagramMermaid={"flowchart LR\nA-->B"}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("diagram-preview")).toHaveTextContent(/A--?>B/);
      expect(screen.getByRole("button", { name: "wizard_regenerate_diagram" })).toBeInTheDocument();
    });
  });
});
