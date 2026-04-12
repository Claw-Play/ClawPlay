import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

export function tempDbPath(): string {
  return path.join(
    os.tmpdir(),
    `clawplay-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
}

export function cleanupDb(dbPath: string) {
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      // ok if file doesn't exist
    }
  }
}

/**
 * Seed a test user directly into the DB.
 * Returns { user, password, cookie } where cookie is a ready-made "Cookie:" header value.
 */
export async function seedUser(
  db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<Record<string, never>>,
  opts: {
    email?: string;
    password?: string;
    name?: string;
    role?: "user" | "admin";
  } = {}
) {
  const { users, userIdentities } = await import("@/lib/db/schema");
  const { signJWT } = await import("@/lib/auth");

  const email = opts.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = opts.password ?? "password123";
  const credential = await bcrypt.hash(password, 4); // cost=4 for test speed

  const [user] = await (db as any)
    .insert(users)
    .values({
      name: opts.name ?? "Test User",
      role: opts.role ?? "user",
      quotaFree: 1000,
    })
    .returning();

  // Mirror the real registration flow: email lives in userIdentities
  await (db as any).insert(userIdentities).values({
    userId: user.id,
    provider: "email",
    providerAccountId: email,
    credential,
  });

  const jwtToken = await signJWT({
    userId: user.id,
    role: user.role as "user" | "admin" | "reviewer",
  });

  return {
    user: { ...user, email },
    email,
    password,
    cookie: `clawplay_token=${jwtToken}`,
  };
}

/**
 * Seed a test user with phone identity (no email/password).
 */
export async function seedPhoneUser(
  db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<Record<string, never>>,
  opts: { phone?: string; name?: string } = {}
) {
  const { users, userIdentities } = await import("@/lib/db/schema");
  const { signJWT } = await import("@/lib/auth");

  const phone = opts.phone ?? `138${String(Date.now()).slice(-8)}`;

  const [user] = await (db as any)
    .insert(users)
    .values({
      name: opts.name ?? "Phone User",
      role: "user",
      quotaFree: 1000,
    })
    .returning();

  await (db as any).insert(userIdentities).values({
    userId: user.id,
    provider: "phone",
    providerAccountId: phone,
    credential: null,
  });

  const jwtToken = await signJWT({ userId: user.id, role: "user" });

  return { user, phone, cookie: `clawplay_token=${jwtToken}` };
}

export async function seedAdmin(
  db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<Record<string, never>>,
  opts: { email?: string } = {}
) {
  return seedUser(db, { ...opts, role: "admin" });
}

export async function seedReviewer(
  db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<Record<string, never>>,
  opts: { email?: string } = {}
) {
  return seedUser(db, { ...opts, role: "reviewer" });
}
