CREATE INDEX IF NOT EXISTS "ingestionRuns_source_started_idx" ON "ingestionRuns" ("sourceKey", "startedAt");
CREATE INDEX IF NOT EXISTS "ingestionSourceHandleAuditLogs_source_changed_idx" ON "ingestionSourceHandleAuditLogs" ("sourceKey", "changedAt");
CREATE INDEX IF NOT EXISTS "ingestionSourceActionAuditLogs_source_acted_idx" ON "ingestionSourceActionAuditLogs" ("sourceKey", "actedAt");
CREATE INDEX IF NOT EXISTS "systemHealthTransitions_observed_idx" ON "systemHealthTransitions" ("observedAt");
CREATE INDEX IF NOT EXISTS "catalogSnapshots_created_idx" ON "catalogSnapshots" ("createdAt");
