-- Rename Package.validUntil to Package.message (preserves existing data)
ALTER TABLE "Package" RENAME COLUMN "validUntil" TO "message";
