/*
  Warnings:

  - You are about to drop the `GalleryItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "notes" TEXT;

-- DropTable
DROP TABLE "GalleryItem";

-- CreateTable
CREATE TABLE "Transformation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "beforeUrl" TEXT NOT NULL,
    "afterUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transformation_pkey" PRIMARY KEY ("id")
);
