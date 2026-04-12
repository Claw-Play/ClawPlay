/**
 * Unit tests for auth/admin.ts guards: requireAdmin, requireReviewer, withAdmin, withReviewer
 */
import { describe, it, expect, vi } from "vitest";
import { requireAdmin, requireReviewer, withAdmin, withReviewer, forbiddenResponse } from "@/lib/auth/admin";

describe("forbiddenResponse", () => {
  it("returns 403 JSON", () => {
    const res = forbiddenResponse();
    expect(res.status).toBe(403);
  });
});

describe("requireAdmin", () => {
  it("throws FORBIDDEN when auth is null", () => {
    expect(() => requireAdmin(null)).toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN when role is 'user'", () => {
    expect(() => requireAdmin({ userId: 1, role: "user" })).toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN when role is 'reviewer'", () => {
    expect(() => requireAdmin({ userId: 1, role: "reviewer" })).toThrow("FORBIDDEN");
  });

  it("returns auth when role is 'admin'", () => {
    const auth = { userId: 1, role: "admin" as const };
    expect(requireAdmin(auth)).toBe(auth);
  });
});

describe("requireReviewer", () => {
  it("throws FORBIDDEN when auth is null", () => {
    expect(() => requireReviewer(null)).toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN when role is 'user'", () => {
    expect(() => requireReviewer({ userId: 1, role: "user" })).toThrow("FORBIDDEN");
  });

  it("returns auth when role is 'reviewer'", () => {
    const auth = { userId: 2, role: "reviewer" as const };
    expect(requireReviewer(auth)).toBe(auth);
  });

  it("returns auth when role is 'admin'", () => {
    const auth = { userId: 1, role: "admin" as const };
    expect(requireReviewer(auth)).toBe(auth);
  });
});

describe("withAdmin", () => {
  it("returns 403 when auth is null", async () => {
    const res = await withAdmin(null, vi.fn());
    expect(res.status).toBe(403);
  });

  it("returns 403 when role is 'user'", async () => {
    const handler = vi.fn();
    const res = await withAdmin({ userId: 1, role: "user" }, handler);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler and returns its response when admin", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const res = await withAdmin({ userId: 1, role: "admin" }, handler);
    expect(handler).toHaveBeenCalledWith({ userId: 1, role: "admin" });
    expect(res.status).toBe(200);
  });

  it("re-throws non-FORBIDDEN errors", async () => {
    const error = new Error("unexpected");
    const handler = vi.fn().mockRejectedValue(error);
    await expect(withAdmin({ userId: 1, role: "admin" }, handler)).rejects.toThrow("unexpected");
  });
});

describe("withReviewer", () => {
  it("returns 403 when auth is null", async () => {
    const res = await withReviewer(null, vi.fn());
    expect(res.status).toBe(403);
  });

  it("returns 403 when role is 'user'", async () => {
    const handler = vi.fn();
    const res = await withReviewer({ userId: 1, role: "user" }, handler);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when role is 'reviewer'", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const auth = { userId: 2, role: "reviewer" as const };
    const res = await withReviewer(auth, handler);
    expect(handler).toHaveBeenCalledWith(auth);
    expect(res.status).toBe(200);
  });

  it("calls handler when role is 'admin'", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const auth = { userId: 1, role: "admin" as const };
    const res = await withReviewer(auth, handler);
    expect(handler).toHaveBeenCalledWith(auth);
    expect(res.status).toBe(200);
  });
});
