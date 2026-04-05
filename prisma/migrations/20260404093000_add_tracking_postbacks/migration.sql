ALTER TABLE "TrackingLink"
ADD COLUMN IF NOT EXISTS "publisherPostbackEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TrackingLink"
ADD COLUMN IF NOT EXISTS "publisherPostbackUrl" TEXT;

ALTER TABLE "TrackingLink"
ADD COLUMN IF NOT EXISTS "postbackSecret" TEXT;

UPDATE "TrackingLink"
SET "postbackSecret" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "postbackSecret" IS NULL;

ALTER TABLE "TrackingLink"
ALTER COLUMN "postbackSecret" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TrackingLink_postbackSecret_key"
ON "TrackingLink"("postbackSecret");

CREATE TABLE IF NOT EXISTS "ConversionPostback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trackingLinkId" TEXT,
    "leadId" TEXT,
    "clickId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'sold',
    "source" TEXT,
    "revenue" DECIMAL(10,2),
    "cost" DECIMAL(10,2),
    "profit" DECIMAL(10,2),
    "targetUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'skipped',
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionPostback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConversionPostback_organizationId_idx"
ON "ConversionPostback"("organizationId");

CREATE INDEX IF NOT EXISTS "ConversionPostback_trackingLinkId_idx"
ON "ConversionPostback"("trackingLinkId");

CREATE INDEX IF NOT EXISTS "ConversionPostback_leadId_idx"
ON "ConversionPostback"("leadId");

CREATE INDEX IF NOT EXISTS "ConversionPostback_clickId_idx"
ON "ConversionPostback"("clickId");

CREATE INDEX IF NOT EXISTS "ConversionPostback_createdAt_idx"
ON "ConversionPostback"("createdAt");

ALTER TABLE "ConversionPostback"
ADD CONSTRAINT "ConversionPostback_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConversionPostback"
ADD CONSTRAINT "ConversionPostback_trackingLinkId_fkey"
FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversionPostback"
ADD CONSTRAINT "ConversionPostback_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
