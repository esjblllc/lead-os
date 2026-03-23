-- CreateTable
CREATE TABLE "PingResult" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bid" DECIMAL(10,2),
    "won" BOOLEAN NOT NULL DEFAULT false,
    "response" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PingResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PingResult" ADD CONSTRAINT "PingResult_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PingResult" ADD CONSTRAINT "PingResult_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
