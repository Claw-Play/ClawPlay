import { NextResponse } from "next/server";
import type { JWTPayload } from "@/lib/auth";

/** 403 JSON response for unauthorized access */
export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

/** 401 JSON response for unauthenticated access */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

/** Require the auth user to be an admin (role === "admin") */
export function requireAdmin(auth: JWTPayload | null): JWTPayload {
  if (!auth || auth.role !== "admin") {
    throw "FORBIDDEN";
  }
  return auth;
}

/** Require the auth user to be an admin OR reviewer (role === "admin" | "reviewer") */
export function requireReviewer(auth: JWTPayload | null): JWTPayload {
  if (!auth || (auth.role !== "admin" && auth.role !== "reviewer")) {
    throw "FORBIDDEN";
  }
  return auth;
}

/** Guard wrapper for API route handlers */
export function withAdmin(
  auth: JWTPayload | null,
  handler: (auth: JWTPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    if (!auth) throw "UNAUTHORIZED";
    const user = requireAdmin(auth);
    return handler(user);
  } catch (e) {
    if (e === "UNAUTHORIZED") return Promise.resolve(unauthorizedResponse());
    if (e === "FORBIDDEN") return Promise.resolve(forbiddenResponse());
    throw e;
  }
}

/** Guard wrapper for API route handlers (admin or reviewer) */
export function withReviewer(
  auth: JWTPayload | null,
  handler: (auth: JWTPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    if (!auth) throw "UNAUTHORIZED";
    const user = requireReviewer(auth);
    return handler(user);
  } catch (e) {
    if (e === "UNAUTHORIZED") return Promise.resolve(unauthorizedResponse());
    if (e === "FORBIDDEN") return Promise.resolve(forbiddenResponse());
    throw e;
  }
}
