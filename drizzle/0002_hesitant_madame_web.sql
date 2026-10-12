CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `city_country_name_unique` ON `cities` (`country_id`,`name`);--> statement-breakpoint
CREATE TABLE `countries` (
	`id` text PRIMARY KEY NOT NULL,
	`iso2_code` text NOT NULL,
	`iso3_code` text NOT NULL,
	`name_tr` text NOT NULL,
	`name_en` text NOT NULL,
	`region_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `countries_iso2_code_unique` ON `countries` (`iso2_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `countries_iso3_code_unique` ON `countries` (`iso3_code`);--> statement-breakpoint
CREATE TABLE `country_aliases` (
	`alias` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `port_mapping_history` (
	`id` text PRIMARY KEY NOT NULL,
	`port_id` text,
	`station_code` text NOT NULL,
	`action` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `port_history_code_created_idx` ON `port_mapping_history` (`station_code`,`created_at`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regions_code_unique` ON `regions` (`code`);--> statement-breakpoint
ALTER TABLE `ports` ADD `iata_code` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `airport_name` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `short_name` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `city_id` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `country_id` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `region_id` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `display_city` text;--> statement-breakpoint
ALTER TABLE `ports` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ports` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ports_iata_code_unique` ON `ports` (`iata_code`);--> statement-breakpoint
ALTER TABLE `station_performance` ADD `port_id` text;--> statement-breakpoint
ALTER TABLE `station_performance` ADD `location_mapping_status` text DEFAULT 'unresolved' NOT NULL;--> statement-breakpoint
CREATE INDEX `station_port_idx` ON `station_performance` (`port_id`);