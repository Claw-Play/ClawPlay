import { describe, it, expect, vi, beforeEach } from "vitest";

const decryptTokenMock = vi.hoisted(() => vi.fn());
const hashTokenMock = vi.hoisted(() => vi.fn());
const userTokensFindFirstMock = vi.hoisted(() => vi.fn());
const usersFindFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      userTokens: {
        findFirst: userTokensFindFirstMock,
      },
      users: {
        findFirst: usersFindFirstMock,
      },
    },
  },
}));

vi.mock("@/lib/token", () => ({
  decryptToken: decryptTokenMock,
  hashToken: hashTokenMock,
}));

const { authenticateClawplayToken } = await import("@/lib/token-auth");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(authorization?: string) {
  return {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "authorization" ? authorization ?? null : null;
      },
    },
  } as any;
}

describe("authenticateClawplayToken", () => {
  it("returns null when Authorization header is missing", async () => {
    const result = await authenticateClawplayToken(makeRequest());
    expect(result).toBeNull();
    expect(decryptTokenMock).not.toHaveBeenCalled();
  });

  it("accepts mixed-case Bearer header with surrounding whitespace", async () => {
    decryptTokenMock.mockReturnValue({ userId: 42 });
    hashTokenMock.mockReturnValue("token-hash");
    userTokensFindFirstMock.mockResolvedValue({
      id: "token-1",
      userId: 42,
      tokenHash: "token-hash",
      revokedAt: null,
    });
    usersFindFirstMock.mockResolvedValue({
      id: 42,
      role: "admin",
    });

    const result = await authenticateClawplayToken(
      makeRequest("Bearer   encrypted-token-value   ")
    );

    expect(result).toEqual({
      userId: 42,
      userRole: "admin",
      token: "encrypted-token-value",
      tokenId: "token-1",
    });
    expect(hashTokenMock).toHaveBeenCalledWith("encrypted-token-value");
  });

  it("returns null when token decryption fails", async () => {
    decryptTokenMock.mockImplementation(() => {
      throw new Error("bad token");
    });

    const result = await authenticateClawplayToken(
      makeRequest("Bearer invalid-token")
    );

    expect(result).toBeNull();
    expect(hashTokenMock).not.toHaveBeenCalled();
  });

  it("returns null when the token record is missing", async () => {
    decryptTokenMock.mockReturnValue({ userId: 42 });
    hashTokenMock.mockReturnValue("token-hash");
    userTokensFindFirstMock.mockResolvedValue(null);

    const result = await authenticateClawplayToken(
      makeRequest("Bearer encrypted-token-value")
    );

    expect(result).toBeNull();
    expect(usersFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns null when the token belongs to a different userId", async () => {
    decryptTokenMock.mockReturnValue({ userId: 42 });
    hashTokenMock.mockReturnValue("token-hash");
    userTokensFindFirstMock.mockResolvedValue({
      id: "token-1",
      userId: 7,
      tokenHash: "token-hash",
      revokedAt: null,
    });

    const result = await authenticateClawplayToken(
      makeRequest("Bearer encrypted-token-value")
    );

    expect(result).toBeNull();
    expect(usersFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns null when the user no longer exists", async () => {
    decryptTokenMock.mockReturnValue({ userId: 42 });
    hashTokenMock.mockReturnValue("token-hash");
    userTokensFindFirstMock.mockResolvedValue({
      id: "token-1",
      userId: 42,
      tokenHash: "token-hash",
      revokedAt: null,
    });
    usersFindFirstMock.mockResolvedValue(null);

    const result = await authenticateClawplayToken(
      makeRequest("Bearer encrypted-token-value")
    );

    expect(result).toBeNull();
  });
});
