import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TestWrapper } from "../../../test-utils";

const SKILL_MD = "---\nname: Demo\ndescription: Demo\n---\n# Demo";
const DIAGRAM_MERMAID = "flowchart LR\nA-->B";
let nextSkillMdValue = SKILL_MD;

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  submitSectionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}));

vi.mock("../../../components/submit/capability-selector", () => ({
  default: () => <div data-testid="capability-selector" />,
}));

vi.mock("../../../components/submit/workflow-indicator", () => ({
  default: () => <div data-testid="workflow-indicator" />,
}));

vi.mock("../../../components/submit/submit-gate-card", () => ({
  default: ({ diagramMermaid }: { diagramMermaid: string }) => (
    <div data-testid="submit-gate-card" data-diagram-mermaid={diagramMermaid} />
  ),
}));

vi.mock("../../../components/submit/skill-md-editor", () => ({
  clearSubmitDraft: vi.fn(),
  default: ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
    <button type="button" data-testid="skill-md-editor" onClick={() => onChange(nextSkillMdValue)}>
      {value || "empty"}
    </button>
  ),
}));

const submitSectionMock = mocks.submitSectionMock;

submitSectionMock.mockImplementation(
  ({
    initialDiagramMermaid,
    skillSaved,
  }: {
    initialDiagramMermaid?: string;
    skillSaved: boolean;
  }) => (
    <div
      data-testid="submit-section"
      data-initial-diagram={initialDiagramMermaid ?? ""}
      data-skill-saved={skillSaved ? "true" : "false"}
    />
  ),
);

vi.mock("../../../components/submit/submit-section", () => ({
  default: (props: unknown) => submitSectionMock(props as never),
}));

import SubmitPage from "../../../components/submit/submit-page";

describe("SubmitPage diagram restore", () => {
  beforeEach(() => {
    nextSkillMdValue = SKILL_MD;
    localStorage.clear();
    mocks.routerPush.mockClear();
    submitSectionMock.mockClear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch;
    localStorage.setItem(
      "clawplay_submit_diagram",
      JSON.stringify({
        skillMdContent: SKILL_MD,
        diagramMermaid: DIAGRAM_MERMAID,
      }),
    );
  });

  it("restores the saved diagram draft and passes it to the preview section", async () => {
    render(<SubmitPage />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByTestId("skill-md-editor"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-section")).toHaveAttribute("data-initial-diagram", DIAGRAM_MERMAID);
      expect(screen.getByTestId("submit-section")).toHaveAttribute("data-skill-saved", "true");
      expect(screen.getByTestId("submit-gate-card")).toHaveAttribute("data-diagram-mermaid", DIAGRAM_MERMAID);
    });
  });

  it("keeps the restored diagram when SKILL.md changes again", async () => {
    render(<SubmitPage />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByTestId("skill-md-editor"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-section")).toHaveAttribute("data-initial-diagram", DIAGRAM_MERMAID);
    });

    nextSkillMdValue = "---\nname: Demo\ndescription: Updated\n---\n# Demo";
    fireEvent.click(screen.getByTestId("skill-md-editor"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-section")).toHaveAttribute("data-initial-diagram", DIAGRAM_MERMAID);
      expect(screen.getByTestId("submit-section")).toHaveAttribute("data-skill-saved", "false");
    });
  });
});
