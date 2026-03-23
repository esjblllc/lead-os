-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "supplierId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
