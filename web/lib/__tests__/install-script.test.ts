import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("public/install.md", () => {
  const docPath = path.join(process.cwd(), "public", "install.md");
  const doc = fs.readFileSync(docPath, "utf8");

  it("contains the skills configuration step", () => {
    const step = "Use Bash / Write-like tools, or create a soft link, to add the following directory to your own skills configuration";
    expect(doc).toContain(step);
  });

  it("contains the install command step", () => {
    expect(doc).toContain("clawplay setup");
  });

  it("contains npm install step", () => {
    expect(doc).toContain("npm install -g clawplay@latest");
  });
});
