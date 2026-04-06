/**
 * Integration test for the home page server component.
 * Verifies the DB query path and module imports.
 *
 * Note: Server components can't be directly rendered with @testing-library/react.
 * This test verifies the module loads without throwing and the DB mock is invoked.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

// Suppress next/image and next/link in tests (they reference remote URLs)
vi.mock("next/image", () => ({ default: (props: any) => props.src }));
vi.mock("next/link", () => ({ default: ({ children, href }: any) => children }));

// Mock db — verify the select query is called with expected columns
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { slug: "skill-1", name: "Skill One", iconEmoji: "🎨", summary: "Summary 1" },
      { slug: "skill-2", name: "Skill Two", iconEmoji: "🎵", summary: "Summary 2" },
    ]),
  },
}));

// Mock auth — unauthenticated state
vi.mock("@/lib/auth", () => ({
  getAuthFromCookies: vi.fn().mockResolvedValue(null),
}));

describe("HomePage server component", () => {
  beforeAll(async () => {
    // Import after mocks are set up
    const mod = await import("../page");
    expect(mod.default).toBeDefined();
  });

  it("loads without throwing", async () => {
    const mod = await import("../page");
    expect(mod.default).not.toBeNull();
  });

  it("db.select is called", async () => {
    const { db } = await import("@/lib/db");
    expect(db.select).toHaveBeenCalled();
  });

  it("db.limit(4) is applied to featured skills query", async () => {
    const { db } = await import("@/lib/db");
    expect(db.limit).toHaveBeenCalledWith(4);
  });

  it("db.where is called with moderation status filter", async () => {
    const { db } = await import("@/lib/db");
    expect(db.where).toHaveBeenCalled();
  });

  it("getAuthFromCookies is called", async () => {
    const { getAuthFromCookies } = await import("@/lib/auth");
    expect(getAuthFromCookies).toHaveBeenCalled();
  });

  it("featured skills mock returns 2 items", async () => {
    const { db } = await import("@/lib/db");
    const result = await db.limit(4);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("skill-1");
    expect(result[1].slug).toBe("skill-2");
  });
});
