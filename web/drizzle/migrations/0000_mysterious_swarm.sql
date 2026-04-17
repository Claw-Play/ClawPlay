CREATE TABLE `event_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`user_id` integer,
	`target_type` text,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_event_logs_event` ON `event_logs` (`event`);--> statement-breakpoint
CREATE INDEX `idx_event_logs_target` ON `event_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_event_logs_user` ON `event_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_event_logs_created` ON `event_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`ability` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_hash` text NOT NULL,
	`endpoint` text DEFAULT '' NOT NULL,
	`api_format` text DEFAULT '' NOT NULL,
	`model_name` text DEFAULT '' NOT NULL,
	`quota` integer NOT NULL,
	`window_used` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`total_calls` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_keys_by_ability` ON `provider_keys` (`ability`);--> statement-breakpoint
CREATE INDEX `provider_keys_by_provider` ON `provider_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `provider_keys_enabled` ON `provider_keys` (`enabled`);--> statement-breakpoint
CREATE TABLE `provider_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`model_name` text NOT NULL,
	`ability` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_models_unique` ON `provider_models` (`provider`,`ability`);--> statement-breakpoint
CREATE TABLE `skill_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`skill_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_ratings_user_skill` ON `skill_ratings` (`user_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_ratings_by_skill` ON `skill_ratings` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` text NOT NULL,
	`changelog` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`parsed_metadata` text DEFAULT '{}' NOT NULL,
	`workflow_md` text DEFAULT '' NOT NULL,
	`author_id` integer,
	`moderation_status` text DEFAULT 'pending' NOT NULL,
	`moderation_flags` text DEFAULT '[]' NOT NULL,
	`deprecated_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_versions_by_skill_version` ON `skill_versions` (`skill_id`,`version`);--> statement-breakpoint
CREATE INDEX `skill_versions_by_skill` ON `skill_versions` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`author_email` text DEFAULT '' NOT NULL,
	`author_id` integer,
	`repo_url` text DEFAULT '' NOT NULL,
	`icon_emoji` text DEFAULT '🦐' NOT NULL,
	`moderation_status` text DEFAULT 'pending' NOT NULL,
	`moderation_reason` text DEFAULT '' NOT NULL,
	`moderation_flags` text DEFAULT '[]' NOT NULL,
	`latest_version_id` text,
	`stats_stars` integer DEFAULT 0 NOT NULL,
	`stats_ratings_count` integer DEFAULT 0 NOT NULL,
	`stats_views` integer DEFAULT 0 NOT NULL,
	`stats_downloads` integer DEFAULT 0 NOT NULL,
	`stats_installs` integer DEFAULT 0 NOT NULL,
	`is_featured` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_by_slug` ON `skills` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_by_status_deleted` ON `skills` (`moderation_status`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `sms_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_identities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`credential` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_identities_provider_account` ON `user_identities` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `user_identities_by_user` ON `user_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_stats` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`login_count` integer DEFAULT 0 NOT NULL,
	`last_login_at` integer,
	`last_active_at` integer,
	`skills_submitted` integer DEFAULT 0 NOT NULL,
	`skills_downloaded` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`encrypted_payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_tokens_by_user` ON `user_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`quota_free` integer DEFAULT 100000 NOT NULL,
	`avatar_color` text DEFAULT '#586330' NOT NULL,
	`avatar_initials` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
