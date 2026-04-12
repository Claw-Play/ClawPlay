import { describe, it, expect } from "vitest";
import { ABILITY_COSTS, DEFAULT_QUOTA_FREE } from "@/lib/redis";

describe("Quota constants", () => {
  it("ABILITY_COSTS maps ability names to costs", () => {
    expect(ABILITY_COSTS["image.generate"]).toBe(10);
    expect(ABILITY_COSTS["tts.synthesize"]).toBe(5);
    expect(ABILITY_COSTS["voice.synthesize"]).toBe(5);
    expect(ABILITY_COSTS["whoami"]).toBe(0);
  });

  it("DEFAULT_QUOTA_FREE is 100000", () => {
    expect(DEFAULT_QUOTA_FREE).toBe(100000);
  });

  it("costs are non-negative integers", () => {
    for (const [, cost] of Object.entries(ABILITY_COSTS)) {
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(cost)).toBe(true);
    }
  });

  it("whoami costs 0 (free operation)", () => {
    expect(ABILITY_COSTS["whoami"]).toBe(0);
  });

  it("image.generate is the most expensive ability", () => {
    const costs = Object.values(ABILITY_COSTS);
    const max = Math.max(...costs);
    expect(ABILITY_COSTS["image.generate"]).toBe(max);
  });
});
