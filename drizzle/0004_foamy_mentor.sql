CREATE TABLE `maintenance_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`completed_at` integer NOT NULL,
	`actor_user_id` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_station_performance` (
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
	`port_id` text,
	`location_mapping_status` text DEFAULT 'unresolved' NOT NULL,
	`flights` integer NOT NULL,
	`passengers` integer,
	`unread_documents` integer,
	`visa_passport_issues` integer,
	`gse_damage_reports` integer,
	`digital_boarding_ratio` real,
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
INSERT INTO `__new_station_performance`("id", "tenant_id", "workspace_id", "owner_user_id", "created_by", "updated_by", "upload_id", "provider", "period", "station_code", "port_id", "location_mapping_status", "flights", "passengers", "unread_documents", "visa_passport_issues", "gse_damage_reports", "digital_boarding_ratio", "delay_minutes", "doc_ratio", "doc_count", "international_passengers", "damaged_ratio", "damaged_count", "lost_ratio", "lost_count", "safety_ratio", "safety_count", "non_safety_ratio", "non_safety_count", "safety_reports", "otp_ratio", "ota_ratio", "complaint_days", "source_row", "validation_status", "created_at") SELECT "id", "tenant_id", "workspace_id", "owner_user_id", "created_by", "updated_by", "upload_id", "provider", "period", "station_code", "port_id", "location_mapping_status", "flights", "passengers", NULL, NULL, NULL, NULL, "delay_minutes", "doc_ratio", "doc_count", "international_passengers", "damaged_ratio", "damaged_count", "lost_ratio", "lost_count", "safety_ratio", "safety_count", "non_safety_ratio", "non_safety_count", "safety_reports", "otp_ratio", "ota_ratio", "complaint_days", "source_row", "validation_status", "created_at" FROM `station_performance`;--> statement-breakpoint
DROP TABLE `station_performance`;--> statement-breakpoint
ALTER TABLE `__new_station_performance` RENAME TO `station_performance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `station_upload_unique` ON `station_performance` (`upload_id`,`station_code`);--> statement-breakpoint
CREATE INDEX `station_workspace_period_idx` ON `station_performance` (`workspace_id`,`period`);--> statement-breakpoint
CREATE INDEX `station_port_idx` ON `station_performance` (`port_id`);--> statement-breakpoint
ALTER TABLE `uploads` ADD `title` text;--> statement-breakpoint
ALTER TABLE `uploads` ADD `import_selection` text;