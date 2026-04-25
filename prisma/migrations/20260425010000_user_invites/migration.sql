-- Pending invitation flow. Replaces the old "create User with random password on invite" pattern.
-- A UserInvite row holds the pending state; the User row is created at acceptance time.

CREATE TYPE "UserInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

CREATE TABLE "user_invites" (
    "id"             TEXT             NOT NULL,
    "tenantId"       TEXT             NOT NULL,
    "email"          TEXT             NOT NULL,
    "firstName"      TEXT,
    "lastName"       TEXT,
    "roles"          TEXT[]           DEFAULT ARRAY['staff']::TEXT[],
    "tokenHash"      TEXT             NOT NULL,
    "status"         "UserInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt"      TIMESTAMP(3)     NOT NULL,
    "acceptedAt"     TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "invitedById"    TEXT,
    "resentAt"       TIMESTAMP(3),
    "resentCount"    INTEGER          NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invites_tenantId_tokenHash_key" ON "user_invites"("tenantId", "tokenHash");
CREATE INDEX "user_invites_tenantId_email_idx"     ON "user_invites"("tenantId", "email");
CREATE INDEX "user_invites_tenantId_status_idx"    ON "user_invites"("tenantId", "status");

ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
