-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "acceptedStates" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "requiredFields" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "trafficSource" TEXT,
    "defaultCost" DECIMAL(10,2),
    "status" TEXT NOT NULL,
    "acceptedVerticals" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
