import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Users table — identity-agnostic; auth info lives in user_identities
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default(""),
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .default("user"),
  quotaFree: integer("quota_free").notNull().default(1000),
  quotaUsed: integer("quota_used").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// UserIdentities table — one user can have multiple auth providers
// provider: 'email' | 'phone' | 'wechat' | 'github' | 'google'
// providerAccountId: email address / phone number / wechat openid / github id
// credential: bcrypt hash for email provider; null for OAuth/phone providers
export const userIdentities = sqliteTable(
  "user_identities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider", {
      enum: ["email", "phone", "wechat", "github", "google"],
    }).notNull(),
    providerAccountId: text("provider_account_id").notNull(), // email / phone / openid
    credential: text("credential"), // bcrypt hash (email only), null otherwise
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_identities_provider_account").on(
      table.provider,
      table.providerAccountId
    ),
    index("user_identities_by_user").on(table.userId),
  ]
);

// SmsCodes table — short-lived verification codes for phone auth
export const smsCodes = sqliteTable("sms_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Skills table — soft-delete via deletedAt
export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(), // uuid
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    authorName: text("author_name").notNull().default(""),
    authorEmail: text("author_email").notNull().default(""),
    repoUrl: text("repo_url").notNull().default(""),
    iconEmoji: text("icon_emoji").notNull().default("🦐"),
    moderationStatus: text("moderation_status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    moderationReason: text("moderation_reason").notNull().default(""),
    moderationFlags: text("moderation_flags").notNull().default("[]"), // JSON array
    latestVersionId: text("latest_version_id"), // FK → skill_versions.id
    statsStars: integer("stats_stars").notNull().default(0),
    statsRatingsCount: integer("stats_ratings_count").notNull().default(0),
    statsViews: integer("stats_views").notNull().default(0),
    statsDownloads: integer("stats_downloads").notNull().default(0),
    statsInstalls: integer("stats_installs").notNull().default(0),
    isFeatured: integer("is_featured").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("skills_by_slug").on(table.slug),
    // Compound index for listing: approved + not deleted
    uniqueIndex("skills_by_status_deleted").on(
      table.moderationStatus,
      table.deletedAt
    ),
  ]
);

// SkillVersions table — versioned releases (from ClawHub pattern)
export const skillVersions = sqliteTable(
  "skill_versions",
  {
    id: text("id").primaryKey(), // uuid
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
    version: text("version").notNull(), // semver, e.g. "1.0.0"
    changelog: text("changelog").notNull().default(""),
    content: text("content").notNull(), // full SKILL.md content
    parsedMetadata: text("parsed_metadata").notNull().default("{}"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("skill_versions_by_skill_version").on(
      table.skillId,
      table.version
    ),
  ]
);

// UserTokens table — encrypted Token storage
export const userTokens = sqliteTable(
  "user_tokens",
  {
    id: text("id").primaryKey(), // uuid
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(), // hash for enumeration protection
    encryptedPayload: text("encrypted_payload").notNull(), // AES-256-GCM base64
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("user_tokens_by_user").on(table.userId),
  ]
);

// SkillRatings table — one rating + optional comment per user per skill
export const skillRatings = sqliteTable(
  "skill_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(), // 1–5
    comment: text("comment").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("skill_ratings_user_skill").on(table.userId, table.skillId),
    index("skill_ratings_by_skill").on(table.skillId),
  ]
);

// EventLogs table — generic analytics event stream
// Tracks user actions, skill events, quota usage, token lifecycle
export const eventLogs = sqliteTable(
  "event_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    event: text("event").notNull(), // e.g. "skill.view", "user.login", "quota.use"
    userId: integer("user_id").references(() => users.id), // NULL = anonymous
    targetType: text("target_type"), // "skill" | "user" | "token" | "quota" | "ability"
    targetId: text("target_id"), // skill slug, user id, token id, etc.
    metadata: text("metadata").notNull().default("{}"), // JSON string
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_event_logs_event").on(table.event),
    index("idx_event_logs_target").on(table.targetType, table.targetId),
    index("idx_event_logs_user").on(table.userId),
    index("idx_event_logs_created").on(table.createdAt),
  ]
);

// UserStats table — aggregated user-level metrics
export const userStats = sqliteTable(
  "user_stats",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id),
    loginCount: integer("login_count").notNull().default(0),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
    totalQuotaUsed: integer("total_quota_used").notNull().default(0),
    skillsSubmitted: integer("skills_submitted").notNull().default(0),
    skillsDownloaded: integer("skills_downloaded").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => []
);

// Type exports for use in API routes
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserIdentity = typeof userIdentities.$inferSelect;
export type NewUserIdentity = typeof userIdentities.$inferInsert;
export type SmsCode = typeof smsCodes.$inferSelect;
export type NewSmsCode = typeof smsCodes.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillVersion = typeof skillVersions.$inferSelect;
export type NewSkillVersion = typeof skillVersions.$inferInsert;
export type UserToken = typeof userTokens.$inferSelect;
export type NewUserToken = typeof userTokens.$inferInsert;
export type SkillRating = typeof skillRatings.$inferSelect;
export type NewSkillRating = typeof skillRatings.$inferInsert;
export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;
export type UserStats = typeof userStats.$inferSelect;
export type NewUserStats = typeof userStats.$inferInsert;
