/**
 * Generate internal test accounts with admin role.
 * Usage: node scripts/gen-test-users.js [password]
 *   password  — optional, defaults to "clawplay2026"
 * Outputs credentials to scripts/test-accounts.txt
 */

const path = require("path");
const fs = require("fs");

const DATABASE_URL =
  process.env.DATABASE_URL ?? path.join(__dirname, "..", "..", "data", "clawplay.db");

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database(DATABASE_URL);

const AVATAR_COLORS = [
  "#586330", "#a23f00", "#fa7025", "#8a6040",
  "#5a7a4a", "#4a7a8a", "#7a4a8a", "#8a4a5a",
];
const randomColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

const adjectives = [
  "swift", "bold", "calm", "keen", "warm", "wild", "cool", "deep",
  "dark", "dawn", "dust", "ember", "fern", "flame", "frost", "grove",
  "haze", "iris", "jade", "lark", "maze", "mist", "moon", "moss",
  "neon", "oak", "opal", "pearl", "rain", "reed", "rock", "sage",
  "sand", "snow", "star", "storm", "surf", "tide", "wind", "wren",
];
const nouns = [
  "alpha", "beta", "cipher", "delta", "echo", "flux", "gamma", "halo",
  "index", "juniper", "kappa", "lambda", "matrix", "nexus", "orbit",
  "pixel", "quark", "radix", "sigma", "theta", "ultra", "vertex",
  "wave", "xenon", "yield", "zenith",
];

function randomHandle() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

function randomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj.charAt(0).toUpperCase()}${adj.slice(1)} ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

async function main() {
  const password = process.argv[2] ?? "clawplay2026";
  const count = 10;

  console.log(`Generating ${count} test accounts (admin)...`);
  console.log(`Password: ${password}\n`);

  const insertUser = db.prepare(`
    INSERT INTO users (name, role, quota_free, avatar_color, created_at)
    VALUES (?, 'admin', 100000, ?, ?)
  `);

  const insertIdentity = db.prepare(`
    INSERT INTO user_identities (user_id, provider, provider_account_id, credential)
    VALUES (?, 'email', ?, ?)
  `);

  const checkExisting = db.prepare(`
    SELECT id FROM user_identities
    WHERE provider = 'email' AND provider_account_id = ?
  `);

  const accounts = [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const handle = randomHandle();
    const email = `${handle}@clawplay.internal`;
    const name = randomName();
    const color = randomColor();

    const existing = checkExisting.get(email.toLowerCase());
    if (existing) {
      console.log(`  [skip] ${email} — already exists`);
      skipped++;
      continue;
    }

    const credential = await bcrypt.hash(password, 6);
    const now = Math.floor(Date.now() / 1000);
    const result = insertUser.run(name, color, now);
    const userId = result.lastInsertRowid;
    insertIdentity.run(userId, email.toLowerCase(), credential);

    accounts.push({ email, name, userId });
    console.log(`  [ok] ${email}  (userId=${userId})`);
    created++;
  }

  // Save to file
  const outputPath = path.join(__dirname, "test-accounts.txt");
  const lines = [
    `ClawPlay Internal Test Accounts`,
    `Generated: ${new Date().toISOString()}`,
    `Password: ${password}`,
    ``,
    ...accounts.map((a) => `${a.email}  — ${a.name} (id=${a.userId})`),
  ];
  fs.writeFileSync(outputPath, lines.join("\n") + "\n");

  console.log(`\nCreated: ${created}  |  Skipped: ${skipped}`);
  console.log(`Credentials saved to: ${outputPath}`);

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
