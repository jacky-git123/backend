/*
  Warnings:

  - You are about to drop the column `key` on the `installment` table. All the data in the column will be lost.
  - Added the required column `generate_id` to the `loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "installment" DROP COLUMN "key",
ADD COLUMN     "generate_id" VARCHAR;

-- AlterTable
ALTER TABLE "loan" ADD COLUMN     "generate_id" VARCHAR NOT NULL,
ADD COLUMN     "repayment_term" VARCHAR,
ADD COLUMN     "status" VARCHAR;
