-- H9: per-platform inbound webhook DLQ.
--
-- eBay does not retry inbound notifications: a single 5xx / timeout from
-- our side and the event is lost forever (per the eBay developer docs:
-- "the system does not resend the message"). For order-related drops the
-- 15-min getOrders poll backstops us, but PAYMENT_DISPUTE_*, CASE_*, and
-- PAYOUT_* events have no equivalent poll — silent drops cost real money.
--
-- Every verified inbound notification is persisted here before processing
-- so ops can replay failed events manually. The rawBody + headers are
-- retained so a replay can re-verify the signature on disk before
-- re-dispatching to the in-process handler.

CREATE TABLE "marketplace_webhook_events" (
  "id"               TEXT PRIMARY KEY,
  "tenantId"         TEXT,
  "platform"         TEXT NOT NULL,
  "topic"            TEXT NOT NULL,
  "externalEventId"  TEXT,
  "rawBody"          TEXT NOT NULL,
  "headers"          JSONB NOT NULL DEFAULT '{}',
  "receivedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt"      TIMESTAMP,
  "status"           TEXT NOT NULL DEFAULT 'received',
  "attempts"         INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"    TIMESTAMP,
  "errorMessage"     TEXT,

  CONSTRAINT "marketplace_webhook_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL
);

-- Dedup key on externalEventId. Unique with NULL allowed in PostgreSQL
-- treats NULLs as distinct, which is fine for our use (older topics
-- without an event id always re-process).
CREATE UNIQUE INDEX "marketplace_webhook_events_externalEventId_key"
  ON "marketplace_webhook_events"("externalEventId");

-- Operational queries.
CREATE INDEX "marketplace_webhook_events_platform_status_receivedAt_idx"
  ON "marketplace_webhook_events"("platform", "status", "receivedAt");

CREATE INDEX "marketplace_webhook_events_tenantId_platform_receivedAt_idx"
  ON "marketplace_webhook_events"("tenantId", "platform", "receivedAt");
