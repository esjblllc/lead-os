/*
  Warnings:

  - A unique constraint covering the columns `[apiKey]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `apiKey` to the `Supplier` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "apiKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_apiKey_key" ON "Supplier"("apiKey");
