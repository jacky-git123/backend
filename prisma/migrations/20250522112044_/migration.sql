-- AlterTable
ALTER TABLE "user" ADD COLUMN     "first_failed_attempt" TIMESTAMP(6),
ADD COLUMN     "locked_until" TIMESTAMP(6);
