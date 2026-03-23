-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
