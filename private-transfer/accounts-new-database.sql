-- Private account migration. Only for a new empty database. No sessions or plaintext passwords.
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
CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL
);
CREATE TABLE `countries` (
	`id` text PRIMARY KEY NOT NULL,
	`iso2_code` text NOT NULL,
	`iso3_code` text NOT NULL,
	`name_tr` text NOT NULL,
	`name_en` text NOT NULL,
	`region_id` text
);
CREATE TABLE `country_aliases` (
	`alias` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL
);
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
, `size_bytes` integer);
CREATE TABLE `maintenance_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`completed_at` integer NOT NULL,
	`actor_user_id` text NOT NULL
);
CREATE TABLE `permissions` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
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
, `iata_code` text, `airport_name` text, `short_name` text, `city_id` text, `country_id` text, `region_id` text, `display_city` text, `created_at` integer DEFAULT 0 NOT NULL, `updated_at` integer DEFAULT 0 NOT NULL);
CREATE TABLE `quality_weights` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`completeness` real DEFAULT 0.4 NOT NULL,
	`validity` real DEFAULT 0.3 NOT NULL,
	`uniqueness` real DEFAULT 0.2 NOT NULL,
	`consistency` real DEFAULT 0.1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer
);
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
CREATE TABLE `role_permissions` (
	`role_code` text NOT NULL,
	`permission_code` text NOT NULL
);
CREATE TABLE `roles` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`filter_state` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE "station_performance" (
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
, `title` text, `import_selection` text);
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
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`ip_hash` text,
	`user_agent` text
);
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
, `first_name` text, `last_name` text, `password_hash` text, `force_password_change` integer DEFAULT false NOT NULL, `password_changed_at` integer, `failed_login_attempts` integer DEFAULT 0 NOT NULL, `locked_until` integer, `data_scope` text DEFAULT 'own_workspace' NOT NULL, `created_by_user_id` text, `archived_at` integer, `archived_by_user_id` text);
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_level` text DEFAULT 'owner' NOT NULL
);
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`workspace_type` text DEFAULT 'personal' NOT NULL,
	`created_at` integer NOT NULL
);
CREATE INDEX `audit_workspace_created_idx` ON `audit_logs` (`workspace_id`,`created_at`);
CREATE UNIQUE INDEX `city_country_name_unique` ON `cities` (`country_id`,`name`);
CREATE UNIQUE INDEX `countries_iso2_code_unique` ON `countries` (`iso2_code`);
CREATE UNIQUE INDEX `countries_iso3_code_unique` ON `countries` (`iso3_code`);
CREATE INDEX `port_history_code_created_idx` ON `port_mapping_history` (`station_code`,`created_at`);
CREATE UNIQUE INDEX `ports_iata_code_unique` ON `ports` (`iata_code`);
CREATE UNIQUE INDEX `ports_station_code_unique` ON `ports` (`station_code`);
CREATE UNIQUE INDEX `regions_code_unique` ON `regions` (`code`);
CREATE UNIQUE INDEX `role_permission_unique` ON `role_permissions` (`role_code`,`permission_code`);
CREATE INDEX `station_port_idx` ON `station_performance` (`port_id`);
CREATE UNIQUE INDEX `station_upload_unique` ON `station_performance` (`upload_id`,`station_code`);
CREATE INDEX `station_workspace_period_idx` ON `station_performance` (`workspace_id`,`period`);
CREATE INDEX `uploads_owner_idx` ON `uploads` (`owner_user_id`);
CREATE INDEX `uploads_workspace_period_idx` ON `uploads` (`workspace_id`,`period`);
CREATE INDEX `user_session_token_idx` ON `user_sessions` (`token_hash`);
CREATE INDEX `user_session_user_idx` ON `user_sessions` (`user_id`);
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
CREATE UNIQUE INDEX `workspace_member_unique` ON `workspace_members` (`workspace_id`,`user_id`);
CREATE INDEX `workspace_member_user_idx` ON `workspace_members` (`user_id`);
INSERT INTO "roles" ("code","name","description") VALUES ('admin','Admin','Kullanıcı, kapsam ve dosya yaşam döngüsünü yönetir.');
INSERT INTO "roles" ("code","name","description") VALUES ('analyst','Analist','Dashboard, analiz ve export özelliklerini kullanır.');
INSERT INTO "roles" ("code","name","description") VALUES ('data_manager','Veri Yöneticisi','Dosya, mapping ve veri kalitesi işlemlerini yönetir.');
INSERT INTO "roles" ("code","name","description") VALUES ('manager','Yönetici','Yönetici özetlerini ve raporları görüntüler.');
INSERT INTO "roles" ("code","name","description") VALUES ('readonly','Salt Okunur Kullanıcı','Yalnızca yetkili dashboard kapsamını görüntüler.');
INSERT INTO "roles" ("code","name","description") VALUES ('super_admin','Super Admin','Tüm workspacelere ve sistem ayarlarına erişir.');
INSERT INTO "roles" ("code","name","description") VALUES ('viewer','Salt Okunur Kullanıcı','Yalnızca yetkili dashboard kapsamını görüntüler.');
INSERT INTO "permissions" ("code","name") VALUES ('audit.view','audit.view');
INSERT INTO "permissions" ("code","name") VALUES ('dashboard.view','dashboard.view');
INSERT INTO "permissions" ("code","name") VALUES ('export.excel','export.excel');
INSERT INTO "permissions" ("code","name") VALUES ('export.pdf','export.pdf');
INSERT INTO "permissions" ("code","name") VALUES ('kpi.manage','kpi.manage');
INSERT INTO "permissions" ("code","name") VALUES ('mapping.manage','mapping.manage');
INSERT INTO "permissions" ("code","name") VALUES ('upload.create','upload.create');
INSERT INTO "permissions" ("code","name") VALUES ('upload.delete','upload.delete');
INSERT INTO "permissions" ("code","name") VALUES ('upload.restore','upload.restore');
INSERT INTO "permissions" ("code","name") VALUES ('user.create','user.create');
INSERT INTO "permissions" ("code","name") VALUES ('user.deactivate','user.deactivate');
INSERT INTO "permissions" ("code","name") VALUES ('user.update','user.update');
INSERT INTO "permissions" ("code","name") VALUES ('workspace.view_all','workspace.view_all');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','user.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','user.update');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','user.deactivate');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','upload.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','upload.delete');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','upload.restore');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','mapping.manage');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','export.pdf');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','export.excel');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','kpi.manage');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','audit.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('super_admin','workspace.view_all');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','user.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','user.update');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','user.deactivate');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','upload.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','upload.delete');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','upload.restore');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','mapping.manage');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','export.pdf');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','export.excel');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','kpi.manage');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','audit.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('admin','workspace.view_all');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','upload.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','upload.delete');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','upload.restore');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','mapping.manage');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','export.pdf');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('data_manager','export.excel');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('analyst','upload.create');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('analyst','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('analyst','export.pdf');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('analyst','export.excel');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('manager','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('manager','export.pdf');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('readonly','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('viewer','dashboard.view');
INSERT INTO "role_permissions" ("role_code","permission_code") VALUES ('viewer','export.pdf');
INSERT INTO "users" ("id","email","full_name","role_code","status","last_login_at","force_logout_at","created_at","updated_at","first_name","last_name","password_hash","force_password_change","password_changed_at","failed_login_attempts","locked_until","data_scope","created_by_user_id","archived_at","archived_by_user_id") VALUES ('usr_1e8eaa3379b5eb4b8f85230e','zecesoy@ajet.com','Zeynep Ecesoy','analyst','active',1791799872281,NULL,1791799839589,1791799872281,'Zeynep','Ecesoy','$2b$12$dthIi771jbGmtORzBAe0L.CiS9t.HxNi0nmX89CgpmIFcHSPDeqPW',0,NULL,0,NULL,'tenant','usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d',NULL,NULL);
INSERT INTO "users" ("id","email","full_name","role_code","status","last_login_at","force_logout_at","created_at","updated_at","first_name","last_name","password_hash","force_password_change","password_changed_at","failed_login_attempts","locked_until","data_scope","created_by_user_id","archived_at","archived_by_user_id") VALUES ('usr_1eef2027d921280d07989567','mirsat20021@gmail.com','mirsat adıyaman','super_admin','inactive',1787647439088,1791792283181,1785933410733,1791792283181,NULL,NULL,'$2b$12$kRtpJA3o0u1xjbzyI8AqJOA9.eTWHr2Bd.NPeVPcNmcUw/E/vbvvq',0,1786524303924,0,NULL,'own_workspace',NULL,1791792283181,'usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d');
INSERT INTO "users" ("id","email","full_name","role_code","status","last_login_at","force_logout_at","created_at","updated_at","first_name","last_name","password_hash","force_password_change","password_changed_at","failed_login_attempts","locked_until","data_scope","created_by_user_id","archived_at","archived_by_user_id") VALUES ('usr_4b2943885b581f0e479198a1','sites-screenshot-service-noreply@chatgpt.com','Sites Screenshot Service','analyst','inactive',1791792282534,1791792283181,1786301021913,1791792283181,'Sites','Screenshot Service',NULL,0,NULL,0,NULL,'own_workspace',NULL,1791792283181,'usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d');
INSERT INTO "users" ("id","email","full_name","role_code","status","last_login_at","force_logout_at","created_at","updated_at","first_name","last_name","password_hash","force_password_change","password_changed_at","failed_login_attempts","locked_until","data_scope","created_by_user_id","archived_at","archived_by_user_id") VALUES ('usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d','madiyaman@ajet.com','AJet Sistem Yöneticisi','super_admin','active',1791793308823,1791792283181,1791792283181,1791793308823,'AJet','Sistem Yöneticisi','$2b$12$qzDpTWUftrsMwlKppcyzo.8FdR81j0aGfdn0nGoiZcarmZT.A.PD6',0,1791792283181,0,NULL,'tenant','usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d',NULL,NULL);
INSERT INTO "workspaces" ("id","name","owner_user_id","tenant_id","workspace_type","created_at") VALUES ('wsp_1e8eaa3379b5eb4b8f85230e','madiyaman@ajet.com','usr_1e8eaa3379b5eb4b8f85230e','tnt_591bfe88c880df9685d3e298','personal',1791799839589);
INSERT INTO "workspaces" ("id","name","owner_user_id","tenant_id","workspace_type","created_at") VALUES ('wsp_1eef2027d921280d07989567','mirsat adıyaman Çalışma Alanı','usr_1eef2027d921280d07989567','tnt_591bfe88c880df9685d3e298','personal',1785933410733);
INSERT INTO "workspaces" ("id","name","owner_user_id","tenant_id","workspace_type","created_at") VALUES ('wsp_4b2943885b581f0e479198a1','Sites Screenshot Service Çalışma Alanı','usr_4b2943885b581f0e479198a1','tnt_c6240ca88eed5b237451d4ce','personal',1786301021913);
INSERT INTO "workspace_members" ("workspace_id","user_id","access_level") VALUES ('wsp_1eef2027d921280d07989567','usr_1eef2027d921280d07989567','owner');
INSERT INTO "workspace_members" ("workspace_id","user_id","access_level") VALUES ('wsp_4b2943885b581f0e479198a1','usr_4b2943885b581f0e479198a1','owner');
INSERT INTO "workspace_members" ("workspace_id","user_id","access_level") VALUES ('wsp_1eef2027d921280d07989567','usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d','owner');
INSERT INTO "workspace_members" ("workspace_id","user_id","access_level") VALUES ('wsp_4b2943885b581f0e479198a1','usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d','owner');
INSERT INTO "workspace_members" ("workspace_id","user_id","access_level") VALUES ('wsp_1e8eaa3379b5eb4b8f85230e','usr_1e8eaa3379b5eb4b8f85230e','owner');
INSERT INTO "user_preferences" ("user_id","default_period","comparison_period","default_provider","default_region","default_country","default_city","default_port","sidebar_collapsed","dashboard_layout","updated_at") VALUES ('usr_1e8eaa3379b5eb4b8f85230e',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,1791799839589);
INSERT INTO "user_preferences" ("user_id","default_period","comparison_period","default_provider","default_region","default_country","default_city","default_port","sidebar_collapsed","dashboard_layout","updated_at") VALUES ('usr_1eef2027d921280d07989567','2026-06','2026-05','TGS',NULL,NULL,NULL,NULL,0,NULL,1785933410733);
INSERT INTO "user_preferences" ("user_id","default_period","comparison_period","default_provider","default_region","default_country","default_city","default_port","sidebar_collapsed","dashboard_layout","updated_at") VALUES ('usr_4b2943885b581f0e479198a1','2026-06','2026-05','TGS',NULL,NULL,NULL,NULL,0,NULL,1786301021913);
INSERT INTO "user_preferences" ("user_id","default_period","comparison_period","default_provider","default_region","default_country","default_city","default_port","sidebar_collapsed","dashboard_layout","updated_at") VALUES ('usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,1791792283181);
INSERT INTO "maintenance_operations" ("id","completed_at","actor_user_id") VALUES ('ajet-account-reset-v1',1791792283181,'usr_f789bd1c-dad3-48f8-b68f-5c2b4bf0ae3d');
