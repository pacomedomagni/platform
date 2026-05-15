-- =================================================================
-- H9: marketplace_webhook_events
--
-- DLQ + audit table for inbound marketplace webhook notifications.
-- Records EVERY signature-verified event so handler crashes don't lose
-- data (eBay does not retry inbound notifications, so a single 5xx from
-- the handler is permanent loss without this table).
--
-- Lifecycle column 'status':
--   received   → inserted at controller AFTER signature verify
--   processing → claimed by worker / async dispatch
--   done       → handler succeeded
--   failed     → handler threw; replay via admin endpoint
--
-- tenantId is nullable because some notifications (account deletion,
-- platform-level) fan out across tenants and the resolution happens
-- during processing.
-- =================================================================

CREATE TABLE "marketplace_webhook_events" (
    "id"                TEXT PRIMARY KEY,
    "tenantId"          TEXT,
    "platform"          TEXT NOT NULL,
    "topic"             TEXT NOT NULL,
    "externalEventId"   TEXT,
    "rawBody"           TEXT NOT NULL,
    "headers"           JSONB NOT NULL DEFAULT '{}'::jsonb,
    "receivedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"       TIMESTAMP(3),
    "status"            TEXT NOT NULL DEFAULT 'received',
    "attempts"          INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt"     TIMESTAMP(3),
    "errorMessage"      TEXT,

    CONSTRAINT "marketplace_webhook_events_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "marketplace_webhook_events_externalEventId_key"
    ON "marketplace_webhook_events"("externalEventId")
    WHERE "externalEventId" IS NOT NULL;

CREATE INDEX "marketplace_webhook_events_platform_status_receivedAt_idx"
    ON "marketplace_webhook_events"("platform", "status", "receivedAt");

CREATE INDEX "marketplace_webhook_events_tenantId_platform_receivedAt_idx"
    ON "marketplace_webhook_events"("tenantId", "platform", "receivedAt");
