/*
  Warnings:

  - You are about to drop the column `supervisor` on the `customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customer" RENAME COLUMN "supervisor" TO "agent_id";
