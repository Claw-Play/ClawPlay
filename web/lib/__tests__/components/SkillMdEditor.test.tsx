import { useMemo, useState } from "react";
import { vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SkillMdEditor from "../../../components/submit/skill-md-editor";
import { validateSkillMdFormat } from "../../../lib/submit-wizard";

function Harness() {
  const [value, setValue] = useState("");
  const validationResult = useMemo(() => {
    if (!value.trim()) return null;
    const result = validateSkillMdFormat(value);
    return {
      ok: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
    };
  }, [value]);

  return <SkillMdEditor t={(key) => key} value={value} onChange={setValue} validationResult={validationResult} />;
}

describe("SkillMdEditor", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ safe: true, warnings: [] }),
    }) as typeof fetch;
  });

  it("shows live validation feedback while typing", () => {
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText("skill_md_placeholder"), {
      target: {
        value: "---\nname: Demo\n---\n# Title",
      },
    });

    expect(screen.getByText("wizard_live_validation_errors_prefix 1")).toBeInTheDocument();
    expect(screen.getByText("Frontmatter is missing a `description` field.")).toBeInTheDocument();
  });

  it("switches to preview mode without blocking interaction", async () => {
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText("skill_md_placeholder"), {
      target: {
        value: "---\nname: Demo\ndescription: Demo\n---\n# Title",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "wizard_preview" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("skill_md_placeholder")).not.toBeInTheDocument();
    });
  });

  it("only marks the skill as saved after validation succeeds", async () => {
    const onSaveSuccess = vi.fn();
    let resolveValidate: ((value: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveValidate = resolve;
        }),
    ) as typeof fetch;

    render(
      <SkillMdEditor
        t={(key) => key}
        value={"---\nname: Demo\ndescription: Demo\n---\n# Title"}
        onChange={vi.fn()}
        onSaveSuccess={onSaveSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "wizard_save" }));

    expect(onSaveSuccess).not.toHaveBeenCalled();

    resolveValidate?.({
      ok: true,
      json: async () => ({ safe: true, warnings: [] }),
    } as Response);

    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
