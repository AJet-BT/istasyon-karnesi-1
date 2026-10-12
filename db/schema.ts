import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable("roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const permissions = sqliteTable("permissions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
});

export const rolePermissions = sqliteTable("role_permissions", {
  roleCode: text("role_code").notNull(),
  permissionCode: text("permission_code").notNull(),
}, (table) => [uniqueIndex("role_permission_unique").on(table.roleCode, table.permissionCode)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  passwordHash: text("password_hash"),
  forcePasswordChange: integer("force_password_change", { mode: "boolean" }).notNull().default(false),
  passwordChangedAt: integer("password_changed_at"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: integer("locked_until"),
  roleCode: text("role_code").notNull().default("analyst"),
  status: text("status").notNull().default("active"),
  dataScope: text("data_scope").notNull().default("own_workspace"),
  createdByUserId: text("created_by_user_id"),
  archivedAt: integer("archived_at"),
  archivedByUserId: text("archived_by_user_id"),
  lastLoginAt: integer("last_login_at"),
  forceLogoutAt: integer("force_logout_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
}, (table) => [
  index("user_session_user_idx").on(table.userId),
  index("user_session_token_idx").on(table.tokenHash),
]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  blockedUntil: integer("blocked_until"),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  workspaceType: text("workspace_type").notNull().default("personal"),
  createdAt: integer("created_at").notNull(),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  accessLevel: text("access_level").notNull().default("owner"),
}, (table) => [
  uniqueIndex("workspace_member_unique").on(table.workspaceId, table.userId),
  index("workspace_member_user_idx").on(table.userId),
]);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  defaultPeriod: text("default_period"),
  comparisonPeriod: text("comparison_period"),
  defaultProvider: text("default_provider"),
  defaultRegion: text("default_region"),
  defaultCountry: text("default_country"),
  defaultCity: text("default_city"),
  defaultPort: text("default_port"),
  sidebarCollapsed: integer("sidebar_collapsed", { mode: "boolean" }).notNull().default(false),
  dashboardLayout: text("dashboard_layout"),
  updatedAt: integer("updated_at").notNull(),
});

export const regions = sqliteTable("regions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const countries = sqliteTable("countries", {
  id: text("id").primaryKey(),
  iso2Code: text("iso2_code").notNull().unique(),
  iso3Code: text("iso3_code").notNull().unique(),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull(),
  regionId: text("region_id"),
});

export const countryAliases = sqliteTable("country_aliases", {
  alias: text("alias").primaryKey(),
  countryId: text("country_id").notNull(),
});

export const cities = sqliteTable("cities", {
  id: text("id").primaryKey(),
  countryId: text("country_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
}, (table) => [uniqueIndex("city_country_name_unique").on(table.countryId, table.name)]);

export const ports = sqliteTable("ports", {
  id: text("id").primaryKey(),
  regionCode: text("region_code").notNull(),
  regionName: text("region_name").notNull(),
  countryCode: text("country_code").notNull(),
  countryName: text("country_name").notNull(),
  cityName: text("city_name").notNull(),
  stationCode: text("station_code").notNull().unique(),
  stationName: text("station_name").notNull(),
  iataCode: text("iata_code").unique(),
  airportName: text("airport_name"),
  shortName: text("short_name"),
  cityId: text("city_id"),
  countryId: text("country_id"),
  regionId: text("region_id"),
  displayCity: text("display_city"),
  activeStatus: text("active_status").notNull().default("active"),
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const portMappingHistory = sqliteTable("port_mapping_history", {
  id: text("id").primaryKey(),
  portId: text("port_id"),
  stationCode: text("station_code").notNull(),
  action: text("action").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("port_history_code_created_idx").on(table.stationCode, table.createdAt)]);

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  fileName: text("file_name").notNull(),
  title: text("title"),
  importSelection: text("import_selection"),
  r2Key: text("r2_key").notNull(),
  provider: text("provider").notNull(),
  period: text("period").notNull(),
  sourceSheet: text("source_sheet").notNull(),
  rowCount: integer("row_count").notNull(),
  validCount: integer("valid_count").notNull(),
  warningCount: integer("warning_count").notNull(),
  errorCount: integer("error_count").notNull(),
  mappingVersion: text("mapping_version").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  replacesUploadId: text("replaces_upload_id"),
  isActiveVersion: integer("is_active_version", { mode: "boolean" }).notNull().default(true),
  isTestData: integer("is_test_data", { mode: "boolean" }).notNull().default(false),
  importStatus: text("import_status").notNull().default("completed"),
  supersededAt: integer("superseded_at"),
  deletedAt: integer("deleted_at"),
  deletedBy: text("deleted_by"),
  deletionReason: text("deletion_reason"),
  deletionStatus: text("deletion_status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("uploads_workspace_period_idx").on(table.workspaceId, table.period),
  index("uploads_owner_idx").on(table.ownerUserId),
]);

export const stationPerformance = sqliteTable("station_performance", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  uploadId: text("upload_id").notNull(),
  provider: text("provider").notNull(),
  period: text("period").notNull(),
  stationCode: text("station_code").notNull(),
  portId: text("port_id"),
  locationMappingStatus: text("location_mapping_status").notNull().default("unresolved"),
  flights: integer("flights").notNull(),
  passengers: integer("passengers"),
  unreadDocuments: integer("unread_documents"),
  visaPassportIssues: integer("visa_passport_issues"),
  gseDamageReports: integer("gse_damage_reports"),
  digitalBoardingRatio: real("digital_boarding_ratio"),
  delayMinutes: integer("delay_minutes"),
  docRatio: real("doc_ratio"),
  docCount: integer("doc_count"),
  internationalPassengers: integer("international_passengers"),
  damagedRatio: real("damaged_ratio"),
  damagedCount: integer("damaged_count"),
  lostRatio: real("lost_ratio"),
  lostCount: integer("lost_count"),
  safetyRatio: real("safety_ratio"),
  safetyCount: integer("safety_count"),
  nonSafetyRatio: real("non_safety_ratio"),
  nonSafetyCount: integer("non_safety_count"),
  safetyReports: integer("safety_reports"),
  otpRatio: real("otp_ratio"),
  otaRatio: real("ota_ratio"),
  complaintDays: real("complaint_days"),
  sourceRow: integer("source_row").notNull(),
  validationStatus: text("validation_status").notNull().default("valid"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("station_upload_unique").on(table.uploadId, table.stationCode),
  index("station_workspace_period_idx").on(table.workspaceId, table.period),
  index("station_port_idx").on(table.portId),
]);

export const savedViews = sqliteTable("saved_views", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  filterState: text("filter_state").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const exportJobs = sqliteTable("export_jobs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  exportType: text("export_type").notNull(),
  fileName: text("file_name").notNull(),
  filterState: text("filter_state").notNull(),
  includeTestData: integer("include_test_data", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("completed"),
  r2Key: text("r2_key"),
  sizeBytes: integer("size_bytes"),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  sessionInfo: text("session_info"),
  result: text("result").notNull().default("success"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("audit_workspace_created_idx").on(table.workspaceId, table.createdAt)]);

export const qualityWeights = sqliteTable("quality_weights", {
  workspaceId: text("workspace_id").primaryKey(),
  completeness: real("completeness").notNull().default(0.4),
  validity: real("validity").notNull().default(0.3),
  uniqueness: real("uniqueness").notNull().default(0.2),
  consistency: real("consistency").notNull().default(0.1),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const maintenanceOperations = sqliteTable("maintenance_operations", {
  id: text("id").primaryKey(),
  completedAt: integer("completed_at").notNull(),
  actorUserId: text("actor_user_id").notNull(),
});
