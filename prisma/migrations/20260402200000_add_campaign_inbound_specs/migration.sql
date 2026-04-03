ALTER TABLE "Campaign"
ADD COLUMN IF NOT EXISTS "inboundRequiredFields" TEXT,
ADD COLUMN IF NOT EXISTS "inboundOptionalFields" TEXT,
ADD COLUMN IF NOT EXISTS "publisherSpecNotes" TEXT;
