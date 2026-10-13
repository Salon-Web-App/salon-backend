/*
  Warnings:

  - You are about to drop the column `role` on the `Staff` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_serviceId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "packageId" TEXT,
ALTER COLUMN "serviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "role";

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalPrice" DECIMAL(65,30) NOT NULL,
    "offerPrice" DECIMAL(65,30) NOT NULL,
    "discountLabel" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "validUntil" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PackageServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PackageServices_AB_unique" ON "_PackageServices"("A", "B");

-- CreateIndex
CREATE INDEX "_PackageServices_B_index" ON "_PackageServices"("B");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageServices" ADD CONSTRAINT "_PackageServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PackageServices" ADD CONSTRAINT "_PackageServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
