/*
  Warnings:

  - A unique constraint covering the columns `[ic]` on the table `customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[passport]` on the table `customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "customer_ic_key" ON "customer"("ic");

-- CreateIndex
CREATE UNIQUE INDEX "customer_passport_key" ON "customer"("passport");
