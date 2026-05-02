import { describe, expect, it } from "vitest";
import { getSubmitGateReason } from "../../../components/submit/submit-section";

describe("getSubmitGateReason", () => {
  it("returns the first incomplete step", () => {
    expect(
      getSubmitGateReason({
        basicInfoDone: false,
        abilitiesSelected: true,
        skillSaved: true,
        diagramDone: true,
        skillMdContent: "# Title",
        validationResult: { ok: true, errors: [], warnings: [] },
      }),
    ).toBe("basic_info");

    expect(
      getSubmitGateReason({
        basicInfoDone: true,
        abilitiesSelected: false,
        skillSaved: true,
        diagramDone: true,
        skillMdContent: "# Title",
        validationResult: { ok: true, errors: [], warnings: [] },
      }),
    ).toBe("abilities");

    expect(
      getSubmitGateReason({
        basicInfoDone: true,
        abilitiesSelected: true,
        skillSaved: false,
        diagramDone: true,
        skillMdContent: "# Title",
        validationResult: { ok: true, errors: [], warnings: [] },
      }),
    ).toBe("save_required");

    expect(
      getSubmitGateReason({
        basicInfoDone: true,
        abilitiesSelected: true,
        skillSaved: true,
        diagramDone: true,
        skillMdContent: "# Title",
        validationResult: { ok: false, errors: ["x"], warnings: [] },
      }),
    ).toBe("skill_md");

    expect(
      getSubmitGateReason({
        basicInfoDone: true,
        abilitiesSelected: true,
        skillSaved: true,
        diagramDone: false,
        skillMdContent: "# Title",
        validationResult: { ok: true, errors: [], warnings: [] },
      }),
    ).toBe("diagram");
  });

  it("returns ready only when all steps are complete", () => {
    expect(
      getSubmitGateReason({
        basicInfoDone: true,
        abilitiesSelected: true,
        skillSaved: true,
        diagramDone: true,
        skillMdContent: "# Title",
        validationResult: { ok: true, errors: [], warnings: [] },
      }),
    ).toBe("ready");
  });
});
