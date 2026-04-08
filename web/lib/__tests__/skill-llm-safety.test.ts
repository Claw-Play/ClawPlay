/**
 * Unit tests for lib/skill-llm-safety.ts
 * Tests llmSafetyReview() with mocked generate() function.
 */
import { describe, it, expect, vi } from "vitest";
import { llmSafetyReview } from "@/lib/skill-llm-safety";

function mockGenerate(resolveWith: string) {
  return vi.fn().mockResolvedValue({ text: resolveWith });
}

describe("llmSafetyReview — successful parses", () => {
  it('returns SAFE with reason and empty flags', async () => {
    const generate = mockGenerate(
      '{"verdict":"SAFE","reason":"No safety concerns found.","flags":[]}'
    );
    const result = await llmSafetyReview("# My Skill\n\nDoes image generation.", generate);
    expect(result).toEqual({
      verdict: "SAFE",
      reason: "No safety concerns found.",
      flags: [],
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns REVIEW with flags', async () => {
    const generate = mockGenerate(
      '{"verdict":"REVIEW","reason":"Suspicious content found.","flags":[{"code":"POLITICS","description":"Political topic detected."}]}'
    );
    const result = await llmSafetyReview("# Something suspicious", generate);
    expect(result).toEqual({
      verdict: "REVIEW",
      reason: "Suspicious content found.",
      flags: [{ code: "POLITICS", description: "Political topic detected." }],
    });
  });

  it('returns UNSAFE with flags', async () => {
    const generate = mockGenerate(
      '{"verdict":"UNSAFE","reason":"Clearly harmful instructions found.","flags":[{"code":"MALWARE","description":"Instructions to install malware."}]}'
    );
    const result = await llmSafetyReview("# Malware instructions", generate);
    expect(result).toEqual({
      verdict: "UNSAFE",
      reason: "Clearly harmful instructions found.",
      flags: [{ code: "MALWARE", description: "Instructions to install malware." }],
    });
  });

  it("uses correct system prompt", async () => {
    const generate = mockGenerate('{"verdict":"SAFE","reason":"","flags":[]}');
    await llmSafetyReview("# Skill content", generate);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("content-safety reviewer"),
        maxTokens: 300,
        temperature: 0,
      })
    );
  });

  it("passes truncated content (4000 chars max) in prompt", async () => {
    const generate = mockGenerate('{"verdict":"SAFE","reason":"","flags":[]}');
    const longContent = "a".repeat(5000);
    await llmSafetyReview(longContent, generate);
    const callArg = (generate.mock.calls[0] as [{ prompt: string }])[0];
    expect(callArg.prompt).toContain("a".repeat(4000));
    expect(callArg.prompt).not.toContain("a".repeat(4001));
  });
});

describe("llmSafetyReview — malformed LLM responses", () => {
  it("returns null for non-JSON text", async () => {
    const generate = mockGenerate("This is not JSON output from the model");
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("returns null for empty response", async () => {
    const generate = mockGenerate("");
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("returns null for valid JSON but missing verdict key", async () => {
    const generate = mockGenerate('{"reason":"no verdict","flags":[]}');
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("defaults unknown verdict to SAFE", async () => {
    const generate = mockGenerate('{"verdict":"MAYBE","reason":"uncertain","flags":[]}');
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.verdict).toBe("SAFE");
  });

  it("handles verdict with different casing", async () => {
    const generate = mockGenerate('{"verdict":"safe","reason":"ok","flags":[]}');
    const result = await llmSafetyReview("# Skill", generate);
    // verdict is not in the allowed set, so defaults to SAFE
    expect(result!.verdict).toBe("SAFE");
  });

  it("handles missing reason field", async () => {
    const generate = mockGenerate('{"verdict":"REVIEW","flags":[]}');
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toEqual({
      verdict: "REVIEW",
      reason: "",
      flags: [],
    });
  });

  it("handles missing flags field", async () => {
    const generate = mockGenerate('{"verdict":"SAFE","reason":"ok"}');
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toEqual({
      verdict: "SAFE",
      reason: "ok",
      flags: [],
    });
  });

  it("handles flags with missing code field", async () => {
    const generate = mockGenerate(
      '{"verdict":"REVIEW","reason":"suspicious","flags":[{"description":"found something"}]}'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.flags[0]).toEqual({
      code: "UNKNOWN",
      description: "found something",
    });
  });

  it("handles missing description field", async () => {
    const generate = mockGenerate(
      '{"verdict":"REVIEW","reason":"suspicious","flags":[{"code":"POLITICS"}]}'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.flags[0]).toEqual({
      code: "POLITICS",
      description: "",
    });
  });

  it("handles flags with null values", async () => {
    const generate = mockGenerate(
      '{"verdict":"REVIEW","reason":"ok","flags":[{"code":null,"description":null}]}'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.flags[0]).toEqual({
      code: "UNKNOWN",
      description: "",
    });
  });

  it("handles non-array flags field", async () => {
    const generate = mockGenerate(
      '{"verdict":"SAFE","reason":"ok","flags":"not-an-array"}'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toEqual({
      verdict: "SAFE",
      reason: "ok",
      flags: [],
    });
  });

  it("extracts JSON from text with surrounding explanation", async () => {
    const generate = mockGenerate(
      'Here is my analysis: {"verdict":"SAFE","reason":"looks good","flags":[]}\nThank you.'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.verdict).toBe("SAFE");
    expect(result!.reason).toBe("looks good");
  });

  it("extracts JSON from text with markdown code fences", async () => {
    const generate = mockGenerate(
      '```json\n{"verdict":"UNSAFE","reason":"bad","flags":[{"code":"MALWARE","description":"malware"}]}\n```'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.verdict).toBe("UNSAFE");
    expect(result!.flags[0].code).toBe("MALWARE");
  });

  it("extracts JSON when response has whitespace around braces", async () => {
    const generate = mockGenerate(
      '  \n  {"verdict":"SAFE","reason":"ok","flags":[]}  \n'
    );
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.verdict).toBe("SAFE");
  });
});

describe("llmSafetyReview — generate() errors", () => {
  it("returns null when generate() throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("API failure"));
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("returns null when generate() resolves with undefined", async () => {
    const generate = vi.fn().mockResolvedValue({ text: undefined as unknown as string });
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("returns null when generate() resolves with null", async () => {
    const generate = vi.fn().mockResolvedValue({ text: null as unknown as string });
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("returns null when generate() returns text with only whitespace", async () => {
    const generate = mockGenerate("   \n\t\n  ");
    const result = await llmSafetyReview("# Skill", generate);
    expect(result).toBeNull();
  });

  it("calls generate exactly once", async () => {
    const generate = mockGenerate('{"verdict":"SAFE","reason":"","flags":[]}');
    await llmSafetyReview("# Skill", generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("llmSafetyReview — all verdict values", () => {
  it.each(["SAFE", "REVIEW", "UNSAFE"])("accepts verdict '%s'", async (verdict) => {
    const generate = mockGenerate(`{"verdict":"${verdict}","reason":"test","flags":[]}`);
    const result = await llmSafetyReview("# Skill", generate);
    expect(result!.verdict).toBe(verdict);
  });
});
