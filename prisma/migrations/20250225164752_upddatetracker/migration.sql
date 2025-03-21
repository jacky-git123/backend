/*
  Warnings:

  - You are about to drop the column `month` on the `Tracker` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[category,year]` on the table `Tracker` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Tracker_category_year_month_key";

-- AlterTable
ALTER TABLE "Tracker" DROP COLUMN "month";

-- CreateIndex
CREATE UNIQUE INDEX "Tracker_category_year_key" ON "Tracker"("category", "year");
