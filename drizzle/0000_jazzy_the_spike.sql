CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`session_info` text,
	`result` text DEFAULT 'success' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_created_idx` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`export_type` text NOT NULL,
	`file_name` text NOT NULL,
	`filter_state` text NOT NULL,
	`include_test_data` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`r2_key` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ports` (
	`id` text PRIMARY KEY NOT NULL,
	`region_code` text NOT NULL,
	`region_name` text NOT NULL,
	`country_code` text NOT NULL,
	`country_name` text NOT NULL,
	`city_name` text NOT NULL,
	`station_code` text NOT NULL,
	`station_name` text NOT NULL,
	`active_status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ports_station_code_unique` ON `ports` (`station_code`);--> statement-breakpoint
CREATE TABLE `quality_weights` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`completeness` real DEFAULT 0.4 NOT NULL,
	`validity` real DEFAULT 0.3 NOT NULL,
	`uniqueness` real DEFAULT 0.2 NOT NULL,
	`consistency` real DEFAULT 0.1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_code` text NOT NULL,
	`permission_code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permission_unique` ON `role_permissions` (`role_code`,`permission_code`);--> statement-breakpoint
CREATE TABLE `roles` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`filter_state` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `station_performance` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`upload_id` text NOT NULL,
	`provider` text NOT NULL,
	`period` text NOT NULL,
	`station_code` text NOT NULL,
	`flights` integer NOT NULL,
	`passengers` integer NOT NULL,
	`delay_minutes` integer,
	`doc_ratio` real,
	`doc_count` integer,
	`international_passengers` integer,
	`damaged_ratio` real,
	`damaged_count` integer,
	`lost_ratio` real,
	`lost_count` integer,
	`safety_ratio` real,
	`safety_count` integer,
	`non_safety_ratio` real,
	`non_safety_count` integer,
	`safety_reports` integer,
	`otp_ratio` real,
	`ota_ratio` real,
	`complaint_days` real,
	`source_row` integer NOT NULL,
	`validation_status` text DEFAULT 'valid' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `station_upload_unique` ON `station_performance` (`upload_id`,`station_code`);--> statement-breakpoint
CREATE INDEX `station_workspace_period_idx` ON `station_performance` (`workspace_id`,`period`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text NOT NULL,
	`provider` text NOT NULL,
	`period` text NOT NULL,
	`source_sheet` text NOT NULL,
	`row_count` integer NOT NULL,
	`valid_count` integer NOT NULL,
	`warning_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`mapping_version` text NOT NULL,
	`version_number` integer DEFAULT 1 NOT NULL,
	`replaces_upload_id` text,
	`is_active_version` integer DEFAULT true NOT NULL,
	`is_test_data` integer DEFAULT false NOT NULL,
	`import_status` text DEFAULT 'completed' NOT NULL,
	`superseded_at` integer,
	`deleted_at` integer,
	`deleted_by` text,
	`deletion_reason` text,
	`deletion_status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploads_workspace_period_idx` ON `uploads` (`workspace_id`,`period`);--> statement-breakpoint
CREATE INDEX `uploads_owner_idx` ON `uploads` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`default_period` text,
	`comparison_period` text,
	`default_provider` text,
	`default_region` text,
	`default_country` text,
	`default_city` text,
	`default_port` text,
	`sidebar_collapsed` integer DEFAULT false NOT NULL,
	`dashboard_layout` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role_code` text DEFAULT 'analyst' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`force_logout_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_level` text DEFAULT 'owner' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_member_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_member_user_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`workspace_type` text DEFAULT 'personal' NOT NULL,
	`created_at` integer NOT NULL
);
