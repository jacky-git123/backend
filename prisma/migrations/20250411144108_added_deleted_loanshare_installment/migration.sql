-- AlterTable
ALTER TABLE "installment" ADD COLUMN     "deleted" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "loan_share" ADD COLUMN     "deleted" BOOLEAN DEFAULT false;
