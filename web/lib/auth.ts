import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "clawplay-dev-secret-change-in-production"
);
const COOKIE_NAME = "clawplay_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface JWTPayload {
  userId: number;
  role: "user" | "admin";
}

/** Sign a new JWT and return the token string */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/** Verify a JWT token string and return the payload */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/** Set the auth cookie on a response (used in API routes) */
export function setAuthCookie(token: string): string {
  const value = `${token}`;
  return value;
}

/** Get token from Next.js cookies (server-side) */
export async function getAuthFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

/** Get token from a NextRequest's cookies (middleware / server actions) */
export async function getAuthFromRequest(
  request: NextRequest
): Promise<JWTPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

const isProduction = process.env.NODE_ENV === "production";

/** Build Set-Cookie header value for a JWT */
export function buildSetCookieHeader(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    ...(isProduction ? ["Secure"] : []),
    "SameSite=Strict",
    `Max-Age=${COOKIE_MAX_AGE}`,
    `Path=/`,
  ];
  return parts.join("; ");
}

/** Build Set-Cookie header to delete the auth cookie */
export function buildClearCookieHeader(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    ...(isProduction ? ["Secure"] : []),
    "SameSite=Strict",
    "Max-Age=0",
    `Path=/`,
  ];
  return parts.join("; ");
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
