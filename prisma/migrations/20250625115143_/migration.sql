/*
  Warnings:

  - The `installment_date` column on the `installment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `receiving_date` column on the `installment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `repayment_date` column on the `loan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `loan_date` column on the `loan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `payment_date` column on the `payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `installment_date` column on the `payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "installment" 
ADD COLUMN "installment_date_old" VARCHAR,
ADD COLUMN "receiving_date_old" VARCHAR;

UPDATE "installment" SET "installment_date_old" = "installment_date", "receiving_date_old" = "receiving_date";

ALTER TABLE "installment"
DROP COLUMN "installment_date",
ADD COLUMN "installment_date" DATE,
DROP COLUMN "receiving_date",
ADD COLUMN "receiving_date" DATE;

-- AlterTable
ALTER TABLE "loan" 
ADD COLUMN "loan_date_old" VARCHAR,
ADD COLUMN "repayment_date_old" VARCHAR;

UPDATE "loan" SET "loan_date_old" = "loan_date", "repayment_date_old" = "repayment_date";

ALTER TABLE "loan"
DROP COLUMN "repayment_date",
ADD COLUMN "repayment_date" DATE,
DROP COLUMN "loan_date",
ADD COLUMN "loan_date" DATE;

-- AlterTable
ALTER TABLE "payment" 
ADD COLUMN "installment_date_oly" VARCHAR,
ADD COLUMN "payment_date_old" VARCHAR;

UPDATE "payment" SET "installment_date_oly" = "installment_date", "payment_date_old" = "payment_date";

ALTER TABLE "payment"
DROP COLUMN "payment_date",
ADD COLUMN "payment_date" DATE,
DROP COLUMN "installment_date",
ADD COLUMN "installment_date" DATE;
