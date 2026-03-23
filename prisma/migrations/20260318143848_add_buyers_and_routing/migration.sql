-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedBuyerId" TEXT,
ADD COLUMN     "routingStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBuyer" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignBuyer_campaignId_buyerId_key" ON "CampaignBuyer"("campaignId", "buyerId");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBuyer" ADD CONSTRAINT "CampaignBuyer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBuyer" ADD CONSTRAINT "CampaignBuyer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedBuyerId_fkey" FOREIGN KEY ("assignedBuyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
