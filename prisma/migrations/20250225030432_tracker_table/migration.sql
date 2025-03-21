/*
  Warnings:

  - You are about to drop the column `payment_up_front` on the `loan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "loan" DROP COLUMN "payment_up_front";

-- CreateTable
CREATE TABLE "Tracker" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,

    CONSTRAINT "Tracker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tracker_category_year_month_key" ON "Tracker"("category", "year", "month");
