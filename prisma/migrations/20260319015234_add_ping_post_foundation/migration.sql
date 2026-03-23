/*
  Warnings:

  - You are about to drop the column `slug` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Campaign` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropIndex
DROP INDEX "Campaign_organizationId_slug_key";

-- DropIndex
DROP INDEX "Organization_slug_key";

-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "minBid" DECIMAL(10,2),
ADD COLUMN     "pingUrl" TEXT,
ADD COLUMN     "postUrl" TEXT,
ADD COLUMN     "timeoutMs" INTEGER DEFAULT 1500;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "slug";

-- DropTable
DROP TABLE "User";

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
