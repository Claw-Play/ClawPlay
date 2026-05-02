import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Users table — identity-agnostic; auth info lives in user_identities
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default(""),
  role: text("role", { enum: ["user", "admin", "reviewer"] })
    .notNull()
    .default("user"),
  quotaFree: integer("quota_free").notNull().default(100000),
  avatarColor: text("avatar_color").notNull().default("#586330"),
  avatarInitials: text("avatar_initials").notNull().default(""),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// UserIdentities table — one user can have multiple auth providers
// provider: 'email' | 'phone' | 'wechat' | 'github' | 'google' | 'x' | 'discord'
// providerAccountId: email / phone / wechat openid / github id / Google sub / X id / Discord id
// credential: bcrypt hash for email provider; null for OAuth/phone providers
export const userIdentities = sqliteTable(
  "user_identities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider", {
      enum: ["email", "phone", "wechat", "github", "google", "x", "discord"],
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
    authorId: integer("author_id").references(() => users.id), // nullable — informational FK
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
    index("skills_pending_by_created").on(
      table.moderationStatus,
      table.deletedAt,
      table.createdAt
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
    workflowMd: text("workflow_md").notNull().default(""), // Mermaid diagram content
    authorId: integer("author_id").references(() => users.id), // nullable — informational FK
    moderationStatus: text("moderation_status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    moderationFlags: text("moderation_flags").notNull().default("[]"), // JSON array
    deprecatedAt: integer("deprecated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("skill_versions_by_skill_version").on(
      table.skillId,
      table.version
    ),
    index("skill_versions_by_skill").on(table.skillId),
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
    userId: integer("user_id"), // NULL = anonymous (no FK — users can be deleted but quota events should still be recorded)
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
    skillsSubmitted: integer("skills_submitted").notNull().default(0),
    skillsDownloaded: integer("skills_downloaded").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  () => []
);

// ProviderKeys table — multi-key pool for rate-limit sharding
// Keys are AES-256-GCM encrypted; server never stores plaintext
export const providerKeys = sqliteTable(
  "provider_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // "ark" | "gemini"
    provider: text("provider").notNull(),
    // "llm" | "image" | "vision"
    ability: text("ability").notNull(),
    // AES-256-GCM encrypted key
    encryptedKey: text("encrypted_key").notNull(),
    // SHA-256 hash for key identification and revocation
    keyHash: text("key_hash").notNull(),
    // Base URL for API requests (auto-filled defaults per provider)
    endpoint: text("endpoint").notNull().default(""),
    // API format: "ark" | "gemini" (determines request structure)
    apiFormat: text("api_format").notNull().default(""),
    // Model name for this provider+ability
    modelName: text("model_name").notNull().default(""),
    // RPM limit for this specific key
    quota: integer("quota").notNull(),
    // Current window usage (reset by cron every minute)
    windowUsed: integer("window_used").notNull().default(0),
    // Window start timestamp in seconds (minute-aligned)
    windowStart: integer("window_start").notNull(),
    // Lifetime total calls — never reset
    totalCalls: integer("total_calls").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("provider_keys_by_ability").on(table.ability),
    index("provider_keys_by_provider").on(table.provider),
    index("provider_keys_enabled").on(table.enabled),
  ]
);

// ProviderModels table — per-provider, per-ability model name overrides
// DB values take precedence over env vars (e.g. IMAGE_MODEL_ARK)
export const providerModels = sqliteTable(
  "provider_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // e.g. "ark_image", "gemini_llm", "ark_vision"
    provider: text("provider").notNull(),
    // e.g. "doubao-seedream-5-0-260128" or "gemini-2.0-flash"
    modelName: text("model_name").notNull(),
    // "image" | "llm" | "vision"
    ability: text("ability").notNull(),
    // Whether this is the active model for this provider+ability
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("provider_models_unique").on(table.provider, table.ability),
  ]
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
export type ProviderKey = typeof providerKeys.$inferSelect;
export type NewProviderKey = typeof providerKeys.$inferInsert;
export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;
